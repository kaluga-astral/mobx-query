
export type SyncParams<TResult, TError, TExecutorParams = void> = {
  onSuccess?: (res: TResult) => void;
  onError?: (e: TError) => void;
  params?: TExecutorParams;
};

export type Sync<TResult, TError, TExecutorParams = void> = (
  params?: SyncParams<TResult, TError, TExecutorParams>,
) => void;

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
