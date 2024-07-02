import { action, computed, makeObservable, when } from 'mobx';

import type { FetchPolicy, QueryBaseActions, Sync, SyncParams } from '../types';
import { AuxiliaryQuery } from '../AuxiliaryQuery';
import type { DataStorage } from '../DataStorage';
import { QueryContainer } from '../QueryContainer';
import { type StatusStorage } from '../StatusStorage';

export const DEFAULT_INFINITE_ITEMS_COUNT = 30;

export type InfiniteParams = {
  offset: number;
  count: number;
};

/**
 * исполнитель запроса, ожидается,
 * что будет использоваться что-то возвращающее массив данных
 */
export type InfiniteExecutor<TResult> = (
  params: InfiniteParams,
) => Promise<Array<TResult>>;

export type InfiniteQueryParams<
  TResult,
  TError,
  TIsBackground extends boolean = false,
> = {
  /**
   * количество запрашиваемых элементов
   * @default 30
   */
  incrementCount?: number;
  /**
   * обработчик ошибки, вызываемый по умолчанию
   */
  onError?: SyncParams<TResult, TError>['onError'];
  /**
   * флаг, отвечающий за автоматический запрос данных при обращении к полю data
   */
  enabledAutoFetch?: boolean;
  /**
   * инстанс хранилища основных статусов
   */
  statusStorage: StatusStorage<TError>;
  fetchPolicy?: FetchPolicy;
  /**
   * инстанс хранилища данных
   */
  dataStorage: DataStorage<TResult[]>;
  /**
   * инстанс хранилища фоновых статусов
   */
  backgroundStatusStorage?: TIsBackground extends true
    ? StatusStorage<TError>
    : null | undefined;
};

/**
 * стор для работы с инфинити запросами,
 * которые должны быть закешированы,
 */
export class InfiniteQuery<
    TResult,
    TError = void,
    TIsBackground extends boolean = false,
  >
  extends QueryContainer<
    TError,
    AuxiliaryQuery<Array<TResult>, TError>,
    TIsBackground
  >
  implements QueryBaseActions<Array<TResult>, TError>
{
  /**
   * счетчик отступа для инфинити запроса
   */
  private offset: number = 0;

  /**
   * количество запрашиваемых элементов
   */
  private readonly incrementCount: number;

  /**
   * хранилище данных, для обеспечения возможности синхронизации данных между разными инстансами
   */
  private storage: DataStorage<TResult[]>;

  /**
   * флаг того, что мы достигли предела запрашиваемых элементов
   */
  public isEndReached: boolean = false;

  /**
   * обработчик ошибки, вызываемый по умолчанию
   */
  private defaultOnError?: SyncParams<TResult, TError>['onError'];

  /**
   * флаг, отвечающий за автоматический запрос данных при обращении к полю data
   */
  private enabledAutoFetch?: boolean;

  /**
   * стандартное поведение политики кеширования
   */
  private readonly defaultFetchPolicy?: FetchPolicy;

  constructor(
    private readonly executor: InfiniteExecutor<TResult>,
    {
      incrementCount = DEFAULT_INFINITE_ITEMS_COUNT,
      onError,
      enabledAutoFetch,
      fetchPolicy,
      dataStorage,
      statusStorage,
      backgroundStatusStorage = null,
    }: InfiniteQueryParams<TResult, TError, TIsBackground>,
  ) {
    super(
      statusStorage,
      backgroundStatusStorage,
      new AuxiliaryQuery<Array<TResult>, TError>(
        statusStorage,
        backgroundStatusStorage,
      ),
    );

    this.storage = dataStorage;
    this.incrementCount = incrementCount;
    this.defaultOnError = onError;
    this.enabledAutoFetch = enabledAutoFetch;
    this.defaultFetchPolicy = fetchPolicy;

    makeObservable(this as ThisType<this>, {
      data: computed,
      infiniteExecutor: computed,
      forceUpdate: action,
      async: action,
      sync: action,
      fetchMore: action,
      submitSuccess: action,
    });
  }

  private get isNetworkOnly() {
    return this.defaultFetchPolicy === 'network-only';
  }

  /**
   * обработчик успешного запроса, проверяет что мы достигли предела
   */
  private submitSuccess = (
    result: TResult[],
    onSuccess?: (res: TResult[]) => void,
    isIncrement?: boolean,
  ) => {
    onSuccess?.(result);

    if (isIncrement && this.storage.hasData) {
      this.storage.setData([...this.storage.data!, ...result]);
    } else {
      this.storage.setData(result);
    }

    // убеждаемся что результат запроса действительно массив,
    // и если количество элементов в ответе меньше,
    // чем запрашивалось, значит у бэка их больше нет,
    // другими словами мы допускаем что, может произойти лишний запрос,
    // когда последняя отданная страница содержит ровно то количество,
    // сколько может содержать страница, а следующая уже просто пустая.
    if (Array.isArray(result) && result.length < this.incrementCount) {
      // включаем флаг достижения предела
      this.isEndReached = true;
    }
  };

  /**
   * форс метод для установки данных
   */
  public forceUpdate = (data: TResult[]) => {
    this.offset = 0;
    this.isEndReached = false;
    this.auxiliary.submitSuccess();
    this.submitSuccess(data);
  };

  /**
   * метод для обогащения параметров текущими значениями для инфинити
   */
  private get infiniteExecutor(): () => Promise<Array<TResult>> {
    return () =>
      this.executor({
        offset: this.offset,
        count: this.incrementCount,
      });
  }

  /**
   * метод для инвалидации данных
   */
  public invalidate = () => {
    this.auxiliary.invalidate();
  };

  /**
   * метод для запроса следующего набора данных
   */
  public fetchMore = () => {
    // если мы еще не достигли предела
    if (!this.isEndReached && this.storage.data) {
      // прибавляем к офсету число запрашиваемых элементов
      this.offset += this.incrementCount;

      // запускаем запрос с последними параметрами, и флагом необходимости инкремента
      this.auxiliary
        .getUnifiedPromise(this.infiniteExecutor)
        .then((resData) => {
          this.submitSuccess(resData, undefined, true);
        });
    }
  };

  /**
   * синхронный метод получения данных
   */
  public sync: Sync<Array<TResult>, TError> = (params) => {
    const isInstanceAllow = !(this.isLoading || this.isSuccess);

    if (this.isNetworkOnly || this.auxiliary.isInvalid || isInstanceAllow) {
      this.proceedSync(params);
    }
  };

  /**
   * метод для переиспользования синхронной логики запроса
   */
  private proceedSync: Sync<Array<TResult>, TError> = ({
    onSuccess,
    onError,
  } = {}) => {
    this.offset = 0;
    this.isEndReached = false;

    this.auxiliary
      .getUnifiedPromise(this.infiniteExecutor)
      .then((resData) => {
        this.submitSuccess(resData, onSuccess);
      })
      .catch((e: TError) => {
        if (onError) {
          onError(e);
        } else {
          this.defaultOnError?.(e);
        }
      });
  };

  /**
   * aсинхронный метод получения данных,
   * подходит для изменения параметров запроса(фильтров),
   * при котором будет сброшен offset,
   * предполагается, что нужно будет самостоятельно обрабатывать ошибку
   */
  public async = () => {
    if (!this.isNetworkOnly && this.isSuccess && !this.auxiliary.isInvalid) {
      return Promise.resolve(this.storage.data!);
    }

    this.offset = 0;
    this.isEndReached = false;

    return this.auxiliary
      .getUnifiedPromise(this.infiniteExecutor)
      .then((resData) => {
        this.submitSuccess(resData);

        return resData;
      })
      .catch((e) => {
        this.auxiliary.submitError(e);

        throw e;
      });
  };

  /**
   * вычисляемое свойство, содержащее реактивные данные,
   * благодаря mobx, при изменении isInvalid, свойство будет вычисляться заново,
   * следовательно, стриггерится условие невалидности,
   * и начнется запрос, в результате которого, данные обновятся
   */
  public get data() {
    const shouldSync =
      this.enabledAutoFetch &&
      !this.isSuccess &&
      !this.isLoading &&
      !this.isError;

    if (this.auxiliary.isInvalid || shouldSync) {
      // т.к. при вызове апдейта, изменяются флаги, на которые подписан data,
      // нужно вызывать этот экшн асинхронно
      when(() => true, this.proceedSync);
    }

    // возвращаем имеющиеся данные
    return this.storage.data;
  }
}
