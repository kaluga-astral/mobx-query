import { action, makeObservable } from 'mobx';

import { AuxiliaryQuery } from '../AuxiliaryQuery';
import type { QueryBaseActions, Sync, SyncParams } from '../types';
import { QueryContainer } from '../QueryContainer';
import { StatusStorage } from '../StatusStorage';

/**
 * исполнитель запроса
 */
export type MutationExecutor<TResult, TParams> = (
  params: TParams,
) => Promise<TResult>;

export type MutationParams<TResult, TError> = {
  /**
   * обработчик ошибки, вызываемый по умолчанию
   */
  onError?: SyncParams<TResult, TError>['onError'];
};

/**
 * простой стор для запросов, которые не требуют кэширования,
 * пример - POST запросы
 */
export class Mutation<TResult, TError = void, TExecutorParams = void>
  extends QueryContainer<TError, AuxiliaryQuery<TResult, TError>>
  implements QueryBaseActions<TResult, TError, TExecutorParams>
{
  /**
   * обработчик ошибки, вызываемый по умолчанию
   */
  private readonly defaultOnError?: SyncParams<TResult, TError>['onError'];

  constructor(
    private readonly executor: MutationExecutor<TResult, TExecutorParams>,
    { onError }: MutationParams<TResult, TError> = {},
  ) {
    const statusStorage = new StatusStorage<TError>();

    super(statusStorage, new AuxiliaryQuery<TResult, TError>(statusStorage));
    this.defaultOnError = onError;
    makeObservable(this, { async: action, sync: action });
  }

  /**
   * синхронный метод получения/отправки данных
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
   * асинхронный метод получения/отправки данных,
   * предполагается, что нужно будет самостоятельно обрабатывать ошибку
   */
  public async = (params: TExecutorParams) => {
    return this.auxiliary.getUnifiedPromise(() => this.executor(params));
  };
}
