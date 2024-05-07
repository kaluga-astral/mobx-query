import { makeAutoObservable } from 'mobx';

import { AuxiliaryQuery } from '../AuxiliaryQuery';
import type { QueryBaseActions, Sync, SyncParams } from '../types';

/**
 * @description исполнитель запроса
 */
export type MutationExecutor<TResult, TParams> = (
  params: TParams,
) => Promise<TResult>;

export type MutationParams<TResult, TError> = {
  /**
   * @description обработчик ошибки, вызываемый по умолчанию
   */
  onError?: SyncParams<TResult, TError>['onError'];
};

/**
 * @description простой стор для запросов, которые не требуют кэширования,
 * пример - POST запросы
 */
export class Mutation<TResult, TError = void, TExecutorParams = void>
  implements QueryBaseActions<TResult, TError, TExecutorParams>
{
  /**
   * @description инстанс вспомогательного стора
   */
  private auxiliary = new AuxiliaryQuery<TResult, TError>();

  /**
   * @description исполнитель запроса, ожидается,
   * что будет использоваться что-то из слоя sources
   */
  private executor: MutationExecutor<TResult, TExecutorParams>;

  /**
   * @description обработчик ошибки, вызываемый по умолчанию
   */
  private defaultOnError?: SyncParams<TResult, TError>['onError'];

  constructor(
    executor: MutationExecutor<TResult, TExecutorParams>,
    { onError }: MutationParams<TResult, TError> = {},
  ) {
    this.executor = executor;
    this.defaultOnError = onError;
    makeAutoObservable(this);
  }

  /**
   * @description синхронный метод получения/отправки данных
   */
  public sync: Sync<TResult, TError, TExecutorParams> = (options) => {
    const { onSuccess, onError, params } = options || {};

    this.auxiliary
      .getUnifiedPromise(() => this.executor(params as TExecutorParams))
      .then((resData) => {
        onSuccess?.(resData);
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
   * @description асинхронный метод получения/отправки данных,
   * предполагается, что нужно будет самостоятельно обрабатывать ошибку
   */
  public async = (params: TExecutorParams) => {
    return this.auxiliary.getUnifiedPromise(() => this.executor(params));
  };

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

  public get isIdle() {
    return this.auxiliary.isIdle;
  }
}
