import { makeAutoObservable } from 'mobx';

import { AuxiliaryQuery } from '../AuxiliaryQuery';
import { QueryBaseActions, Sync, SyncParams } from '../types';

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

  private internalData: TResult | undefined;

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

  constructor(
    executor: QueryExecutor<TResult>,
    { onError, enabledAutoFetch }: QueryParams<TResult, TError> = {},
  ) {
    this.executor = executor;
    this.defaultOnError = onError;
    this.enabledAutoFetch = enabledAutoFetch;
    makeAutoObservable(this);
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
    if (Boolean(this.internalData)) {
      params?.onSuccess?.(this.internalData as TResult);

      return;
    }

    this.proceedSync(params);
  };

  /**
   * @description обработчик успешного ответа
   */
  private submitSuccess = (resData: TResult) => {
    this.internalData = resData;
    this.isInvalid = false;

    return resData;
  };

  /**
   * @description метод для переиспользования синхронной логики запроса
   */
  private proceedSync: Sync<TResult, TError> = (options) => {
    const { onSuccess, onError } = options || {};

    this.auxiliary
      .getSingletonePromise(this.executor)
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
    if (Boolean(this.internalData)) {
      return Promise.resolve(this.internalData as TResult);
    }

    return this.auxiliary
      .getSingletonePromise(this.executor)
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
      this.enabledAutoFetch &&
      !Boolean(this.internalData) &&
      !this.isLoading &&
      !this.isError;

    if (this.isInvalid || shouldSync) {
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
