import { makeAutoObservable, runInAction } from 'mobx';

import { QueryBaseActions, Sync, SyncParams } from '../types';
import { AuxiliaryQuery } from '../AuxiliaryQuery';

export const DEFAULT_INFINITE_ITEMS_COUNT = 30;

export type InfiniteParams = {
  offset: number;
  count: number;
};

/**
 * @description исполнитель запроса, ожидается,
 * что будет использоваться что-то возвращающее массив данных
 */
export type InfiniteExecutor<TResult> = (
  params: InfiniteParams,
) => Promise<Array<TResult>>;

export type InfiniteQueryParams<TResult, TError> = {
  /**
   * @description колличество запрашиваемых элементов
   * @default 30
   */
  incrementCount?: number;
  /**
   * @description обработчик ошибки, вызываемый по умолчанию
   */
  onError?: SyncParams<TResult, TError>['onError'];
  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   */
  enabledAutoFetch?: boolean;
};

/**
 * @description стор для работы с инфинити запросами,
 * которые должны быть закешированы,
 */
export class InfiniteQuery<TResult, TError = void>
  implements QueryBaseActions<Array<TResult>, TError>
{
  /**
   * @description инстанс вспомогательного стора
   */
  private auxiliary = new AuxiliaryQuery<Array<TResult>, TError>();

  /**
   * @description счетчик отступа для инфинити запроса
   */
  private offset: number = 0;

  /**
   * @description количество запрашиваемых элементов
   */
  private readonly incrementCount: number;

  /**
   * @description исполнитель запроса, ожидается,
   * что будет использоваться что-то из слоя sources, возвращающее массив данных
   */
  private executor: InfiniteExecutor<TResult>;

  private internalData: Array<TResult> | undefined;

  /**
   * @description флаг того, что мы достигли предела запрашиваемых элементов
   */
  public isEndReached: boolean = false;

  /**
   * @description флаг необходимости выполнить обновления данных
   */
  private isInvalid: boolean = false;

  /**
   * @description обработчик ошибки, вызываемый по умолчанию
   */
  private defaultOnError?: SyncParams<TResult, TError>['onError'];

  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   */
  private enabledAutoFetch?: boolean;

  constructor(
    executor: InfiniteExecutor<TResult>,
    {
      incrementCount = DEFAULT_INFINITE_ITEMS_COUNT,
      onError,
      enabledAutoFetch,
    }: InfiniteQueryParams<TResult, TError> = {},
  ) {
    this.incrementCount = incrementCount;
    this.executor = executor;
    this.defaultOnError = onError;
    this.enabledAutoFetch = enabledAutoFetch;
    makeAutoObservable(this);
  }

  /**
   * @description обработчик успешного запроса, проверяет что мы достигли предела
   */
  private submitSuccess = (
    result: Array<TResult>,
    onSuccess?: (res: Array<TResult>) => void,
    isIncrement?: boolean,
  ) => {
    this.auxiliary.submitSuccess();
    onSuccess?.(result);

    runInAction(() => {
      if (isIncrement && Array.isArray(this.internalData)) {
        this.internalData = [...this.internalData, ...result];
      } else {
        this.internalData = result;
      }

      this.isInvalid = false;

      // убеждаемся что результат запроса действительно массив,
      // и если колличество элементов в ответе меньше,
      // чем запрашивалось, значит у бэка их больше нет
      if (Array.isArray(result) && result.length < this.incrementCount) {
        // включаем флаг достижения предела
        this.isEndReached = true;
      }
    });
  };

  /**
   * @description метод для обогащения параметров текущими значениями для инфинити
   */
  private get infiniteExecutor(): () => Promise<Array<TResult>> {
    return () =>
      this.executor({
        offset: this.offset,
        count: this.incrementCount,
      });
  }

  /**
   * @description метод для инвалидации данных
   */
  public invalidate = () => {
    this.isInvalid = true;
  };

  /**
   * @description метод для запроса следующего набора данных
   */
  public increment = () => {
    // если мы еще не достигли предела
    if (!this.isEndReached && this.internalData) {
      // прибавляем к офсету число запрашиваемых элементов
      this.offset += this.incrementCount;

      // запускаем запрос с последними параметрами, и флагом необходимости инкремента
      this.auxiliary
        .getSingletonePromise(this.infiniteExecutor)
        .then((resData) => {
          this.submitSuccess(resData, undefined, true);
        });
    }
  };

  /**
   * @description синхронный метод получения данных
   */
  public sync: Sync<Array<TResult>, TError> = (params) => {
    if (this.isInvalid || !(this.isLoading || Boolean(this.internalData))) {
      this.proceedSync(params);
    }
  };

  /**
   * @description метод для переиспользования синхронной логики запроса
   */
  private proceedSync: Sync<Array<TResult>, TError> = ({
    onSuccess,
    onError,
  } = {}) => {
    this.offset = 0;

    this.auxiliary
      .getSingletonePromise(this.infiniteExecutor)
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
   * @description aсинхронный метод получения данных,
   * подходит для изменения параметров запроса(фильтров),
   * при котором будет сброшен offset,
   * предполагается, что нужно будет самостоятельно обрабатывать ошибку
   */
  public async = () => {
    if (Array.isArray(this.internalData)) {
      return Promise.resolve(this.internalData);
    }

    this.offset = 0;

    return this.auxiliary
      .getSingletonePromise(this.infiniteExecutor)
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
   * @description вычисляемое свойство, содержащее реактивные данные данные,
   * благодаря mobx, при изменении isInvalid, свойство будет вычисляться заново,
   * следовательно, стриггерится условие невалидности,
   * и начнется запрос, в результате которого, данные обновятся
   */
  public get data() {
    if (
      this.isInvalid ||
      // или если включен флаг автоматического запроса при чтении и данных нет, и нет ошибки
      (this.enabledAutoFetch &&
        !Boolean(this.internalData) &&
        !this.isLoading &&
        !this.isError)
    ) {
      // иначе пытаемся самостоятельно обновить данные с последними вызванными параметрами
      this.proceedSync();
    }

    // возвращаем имеющиеся данные
    return this.internalData;
  }

  /**
   * @description флаг загрузки данных
   */
  public get isLoading() {
    return this.auxiliary.isLoading;
  }

  /**
   * @description флаг обозначающий, что последний запрос был зафейлен
   */
  public get isError() {
    return this.auxiliary.isError;
  }

  /**
   * @description данные о последней ошибке
   */
  public get error() {
    return this.auxiliary.error;
  }

  /**
   * @description флаг обозначающий, что последний запрос был успешно завершен
   */
  public get isSuccess() {
    return this.auxiliary.isSuccess;
  }
}
