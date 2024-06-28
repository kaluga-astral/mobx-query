import { makeAutoObservable, when } from 'mobx';

import { AuxiliaryQuery } from '../AuxiliaryQuery';
import type { FetchPolicy, QueryBaseActions, Sync, SyncParams } from '../types';
import type { DataStorage } from '../DataStorage';

/**
 * исполнитель запроса
 */
export type QueryExecutor<TResult> = () => Promise<TResult>;

export type QueryParams<TResult, TError> = {
  /**
   * обработчик ошибки, вызываемый по умолчанию
   */
  onError?: SyncParams<TResult, TError>['onError'];
  /**
   * флаг, отвечающий за автоматический запрос данных при обращении к полю data
   */
  enabledAutoFetch?: boolean;
  fetchPolicy?: FetchPolicy;
  /**
   * инстанс хранилища данных
   */
  dataStorage: DataStorage<TResult>;
};

/**
 * стор для работы с запросами,
 * которые должны быть закешированы,
 * но им не требуется усложнение в виде работы с фильтрами и инфинити запросами
 */
export class Query<TResult, TError = void>
  implements QueryBaseActions<TResult, TError, undefined>
{
  /**
   * инстанс вспомогательного стора
   */
  private auxiliary = new AuxiliaryQuery<TResult, TError>();

  /**
   * хранилище данных, для обеспечения возможности синхронизации данных между разными инстансами
   */
  private storage: DataStorage<TResult>;

  /**
   * исполнитель запроса, ожидается,
   * что будет использоваться что-то из слоя sources
   */
  private executor: QueryExecutor<TResult>;

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
    executor: QueryExecutor<TResult>,
    {
      onError,
      enabledAutoFetch,
      fetchPolicy,
      dataStorage,
    }: QueryParams<TResult, TError>,
  ) {
    this.executor = executor;
    this.defaultOnError = onError;
    this.enabledAutoFetch = enabledAutoFetch;
    this.defaultFetchPolicy = fetchPolicy;
    this.storage = dataStorage;
    makeAutoObservable(this);
  }

  private get isNetworkOnly() {
    return this.defaultFetchPolicy === 'network-only';
  }

  /**
   * метод для инвалидации данных
   */
  public invalidate = () => {
    this.auxiliary.invalidate();
  };

  /**
   * синхронный метод получения данных
   */
  public sync: Sync<TResult, TError, undefined> = (params) => {
    const isInstanceAllow = !(this.isLoading || this.isSuccess);

    if (this.isNetworkOnly || this.auxiliary.isInvalid || isInstanceAllow) {
      this.proceedSync(params);
    }
  };

  /**
   * обработчик успешного ответа
   */
  private submitSuccess = (resData: TResult) => {
    this.storage.setData(resData);

    return resData;
  };

  /**
   * форс метод для установки данных
   */
  public forceUpdate = (data: TResult) => {
    this.auxiliary.submitSuccess();
    this.submitSuccess(data);
  };

  /**
   * метод для переиспользования синхронной логики запроса
   */
  private proceedSync: Sync<TResult, TError> = (options) => {
    const { onSuccess, onError } = options || {};

    this.auxiliary
      .getUnifiedPromise(this.executor)
      .then((res) => {
        this.submitSuccess(res);
        onSuccess?.(res);
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
   * асинхронный метод получения данных,
   * предполагается, что нужно будет самостоятельно обрабатывать ошибку
   */
  public async = () => {
    if (!this.isNetworkOnly && this.isSuccess && !this.auxiliary.isInvalid) {
      return Promise.resolve(this.storage.data as TResult);
    }

    return this.auxiliary
      .getUnifiedPromise(this.executor)
      .then(this.submitSuccess);
  };

  /**
   * содержит реактивные данные
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

  /**
   * флаг загрузки данных
   */
  public get isLoading() {
    return this.auxiliary.isLoading;
  }

  /**
   * флаг обозначающий, что последний запрос был зафейлен
   */
  public get isError() {
    return this.auxiliary.isError;
  }

  /**
   * данные о последней ошибке
   */
  public get error() {
    return this.auxiliary.error;
  }

  /**
   * флаг обозначающий, что последний запрос был успешно завершен
   */
  public get isSuccess() {
    return this.auxiliary.isSuccess;
  }

  public get isIdle() {
    return this.auxiliary.isIdle;
  }
}
