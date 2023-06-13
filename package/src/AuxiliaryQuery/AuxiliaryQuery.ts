import { makeAutoObservable, runInAction } from 'mobx';

/**
 * @description испольнитель запроса
 */
type Executor<TResult> = () => Promise<TResult>;

/**
 * @description вспомогательное хранилище данных, для композиции в Query сторах,
 * содержащее флаги загрузки и ошибки,
 * колбэки на успешный запрос и на ошибку,
 * данные последней ошибки,
 * а так же, управляющее синглтон промисом.
 */
export class AuxiliaryQuery<TResult, TError = void> {
  /**
   * @description флаг обозначающий загрузку данных
   */
  public isLoading: boolean = false;

  /**
   * @description флаг обозначающий, что последний запрос был зафейлен
   */
  public isError: boolean = false;

  /**
   * @description данные о последней ошибке
   */
  public error?: TError;

  /**
   * @description флаг, обозначающий успешность завершения последнего запроса
   */
  public isSuccess = false;

  /**
   * @description синглтон промис, для устранения гонки запросов
   */
  private unifiedPromise?: Promise<TResult>;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * @description метод для объединения synс и async логики в одну,
   * чтобы одновременные вызовы sync/async работали бы с одним и тем же инстансом промиса
   */
  public getUnifiedPromise = (executor: Executor<TResult>) => {
    // проверяем, если синглтона нет, то надо создать
    if (!Boolean(this.unifiedPromise)) {
      this.startLoading();

      this.unifiedPromise = executor()
        .then((resData: TResult) => {
          this.submitSuccess();

          return resData;
        })
        .catch((e) => {
          this.submitError(e);

          throw e;
        })
        .finally(() => {
          this.unifiedPromise = undefined;

          runInAction(() => {
            this.isLoading = false;
          });
        });
    }

    return this.unifiedPromise as Promise<TResult>;
  };

  /**
   * @description обработчик успешного ответа
   */
  public submitSuccess = () => {
    runInAction(() => {
      this.isError = false;
      this.isSuccess = true;
    });
  };

  /**
   * @description обработчик ошибки
   */
  public submitError = (e: TError) => {
    runInAction(() => {
      this.isError = true;
      this.error = e;
    });
  };

  /**
   * @description метод, вызываемый в самом начале запроса, чтобы сбросить флаги в соответствующее значение
   */
  public startLoading = () => {
    this.isLoading = true;
    this.isError = false;
    this.isSuccess = false;
  };
}
