export type SyncParams<TResult, TError, TExecutorParams = void> = {
  onSuccess?: (res: TResult) => void;
  onError?: (e: TError) => void;
  params?: TExecutorParams;
};

/**
 * синхронный метод получения данных
 */
export type Sync<TResult, TError, TExecutorParams = void> = (
  params?: SyncParams<TResult, TError, TExecutorParams>,
) => void;

/**
 * асинхронный метод получения данных
 */
export type Async<TResult, TExecutorParams = void> = (
  params: TExecutorParams,
) => Promise<TResult>;

export type QueryBaseActions<TResult, TError, TExecutorParams = void> = {
  /**
   * синхронный метод получения данных
   */
  sync: Sync<TResult, TError, TExecutorParams>;
  /**
   * асинхронный метод получения данных
   */
  async: Async<TResult, TExecutorParams>;
  /**
   * флаг обозначающий загрузку данных
   */
  isLoading: boolean;
  /**
   * флаг обозначающий, что последний запрос был зафейлен
   */
  isError: boolean;
  /**
   * данные о последней ошибке
   */
  error?: TError;
  /**
   * флаг обзначающий, что последний запрос был успешно выполнен
   */
  isSuccess: boolean;
  /**
   * флаг, обозначающий простаивание, т.е. запроса еще не было
   */
  isIdle: boolean;
};

/**
 * политика получения данных.
 * @enum cache-first - данные сначала берутся из кеша, если их нет, тогда идет обращение к сети, ответ записывается в кэш
 * @enum network-only - данные всегда беруться из сети, при этом ответ записывается в кэш
 */
export type FetchPolicy = 'network-only' | 'cache-first';

/**
 * ключ для кешированя
 */
export type CacheKey =
  | string
  | number
  | boolean
  | null
  | undefined
  | CacheKey[]
  | { [key: string]: CacheKey };
