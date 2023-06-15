import { makeAutoObservable } from 'mobx';

import { AuxiliaryQuery } from '../AuxiliaryQuery';
import { FetchPolicy, QueryBaseActions, Sync, SyncParams } from '../types';

import { DataStorage } from './DataStorage';

/**
 * @description исполнитель запроса
 */
export type QueryExecutor<TResult> = () => Promise<TResult>;

export type QueryParams<TResult, TError> = {
  /**
   * @description обработчик ошибки, вызываемый по умолчанию
   */
  onError?: SyncParams<TResult, TError>['onError'];
  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   */
  enabledAutoFetch?: boolean;
  fetchPolicy?: FetchPolicy;
  /**
   * @description инстанс хранилища данных
   */
  dataStorage: DataStorage<TResult>;
};

/**
 * @description стор для работы с запросами,
 * которые должны быть закешированы,
 * но им не требуется усложнение в виде работы с фильтрами и инфинити запросами
 */
export class Query<TResult, TError = void>
  implements QueryBaseActions<TResult, TError, undefined>
{
  /**
   * @description инстанс вспомогательного стора
   */
  private auxiliary = new AuxiliaryQuery<TResult, TError>();

  /**
   * @description флаг, по которому реактивно определяется необходимость запуска инвалидации
   */
  private isInvalid: boolean = false;

  /**
   * @description хранилище данных, для обеспечения синхронизации данных между 'network-only' и 'cache-first' инстансами
   */
  private storage: DataStorage<TResult>;

  /**
   * @description исполнитель запроса, ожидается,
   * что будет использоваться что-то из слоя sources
   */
  private executor: QueryExecutor<TResult>;

  /**
   * @description обработчик ошибки, вызываемый по умолчанию
   */
  private defaultOnError?: SyncParams<TResult, TError>['onError'];

  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   */
  private enabledAutoFetch?: boolean;

  /**
   * @description стандартное поведение политики кеширования
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
   * @description метод для инвалидации данных
   */
  public invalidate = () => {
    this.isInvalid = true;
  };

  /**
   * @description синхронный метод получения данных
   */
  public sync: Sync<TResult, TError, undefined> = (params) => {
    if (
      this.isNetworkOnly ||
      this.isInvalid ||
      !(this.isLoading || this.isSuccess)
    ) {
      this.proceedSync(params);
    }
  };

  /**
   * @description обработчик успешного ответа
   */
  private submitSuccess = (resData: TResult) => {
    this.storage.setData(resData);
    this.isInvalid = false;

    return resData;
  };

  /**
   * @description метод для переиспользования синхронной логики запроса
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
   * @description асинхронный метод получения данных,
   * предполагается, что нужно будет самостоятельно обрабатывать ошибку
   */
  public async = () => {
    if (!this.isNetworkOnly && this.isSuccess && !this.isInvalid) {
      return Promise.resolve(this.storage.data as TResult);
    }

    return this.auxiliary
      .getUnifiedPromise(this.executor)
      .then(this.submitSuccess);
  };

  /**
   * @description содержит реактивные данные
   * благодаря mobx, при изменении isInvalid, свойство будет вычисляться заново,
   * следовательно, стриггерится условие невалидности,
   * и начнется запрос, в результате которого, данные обновятся
   */
  public get data() {
    const shouldSync =
      this.enabledAutoFetch && !this.isSuccess && !this.isLoading;

    if (this.isInvalid || shouldSync) {
      this.proceedSync();
    }

    // возвращаем имеющиеся данные
    return this.storage.data;
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
