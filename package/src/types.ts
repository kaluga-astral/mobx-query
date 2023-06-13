export type SyncParams<TResult, TError, TExecutorParams = void> = {
  onSuccess?: (res: TResult) => void;
  onError?: (e: TError) => void;
  params?: TExecutorParams;
};

/**
 * @description синхронный метод получения данных
 */
export type Sync<TResult, TError, TExecutorParams = void> = (
  params?: SyncParams<TResult, TError, TExecutorParams>,
) => void;

/**
 * @description асинхронный метод получения данных
 */
export type Async<TResult, TExecutorParams = void> = (
  params: TExecutorParams,
) => Promise<TResult>;

export type QueryBaseActions<TResult, TError, TExecutorParams = void> = {
  /**
   * @description синхронный метод получения данных
   */
  sync: Sync<TResult, TError, TExecutorParams>;
  /**
   * @description асинхронный метод получения данных
   */
  async: Async<TResult, TExecutorParams>;
  /**
   * @description флаг обозначающий загрузку данных
   */
  isLoading: boolean;
  /**
   * @description флаг обозначающий, что последний запрос был зафейлен
   */
  isError: boolean;
  /**
   * @description данные о последней ошибке
   */
  error?: TError;
  /**
   * @description флаг обзначающий, что последний запрос был успешно выполнен
   */
  isSuccess: boolean;
};

/**
 * @description политика получения данных.
 * @variation 'cache-first' - данные сначала берутся из кеша, если их нет, тогда идет обращение к сети, ответ записывается в кэш
 * @kind 'network-only' - данные всегда беруться из сети, при этом ответ записывается в кэш
 */
export type FetchPolicy = 'network-only' | 'cache-first';
