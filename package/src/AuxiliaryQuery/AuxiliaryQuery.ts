import { makeAutoObservable, runInAction } from 'mobx';

/**
 * испольнитель запроса
 */
type Executor<TResult> = () => Promise<TResult>;

/**
 * вспомогательное хранилище данных, для композиции в Query сторах,
 * содержащее флаги загрузки и ошибки,
 * колбэки на успешный запрос и на ошибку,
 * данные последней ошибки,
 * а так же, управляющее синглтон промисом.
 */
export class AuxiliaryQuery<TResult, TError = void> {
  /**
   * флаг обозначающий загрузку данных
   */
  public isLoading: boolean = false;

  /**
   * флаг обозначающий, что последний запрос был зафейлен
   */
  public isError: boolean = false;

  /**
   * данные о последней ошибке
   */
  public error?: TError = undefined;

  /**
   * флаг, обозначающий успешность завершения последнего запроса
   */
  public isSuccess = false;

  /**
   * флаг, обозначающий простаивание, т.е. запроса еще не было
   */
  public isIdle = true;

  /**
   * единый промис, для устранения гонки запросов
   */
  private unifiedPromise?: Promise<TResult>;

  /**
   * флаг, по которому реактивно определяется необходимость запуска инвалидации
   */
  public isInvalid: boolean = false;

  constructor() {
    makeAutoObservable(this as ThisType<this>, { unifiedPromise: false });
  }

  /**
   * метод ответственный за создание единого промиса,
   * для устранения гонки запросов
   */
  public getUnifiedPromise = (executor: Executor<TResult>) => {
    // проверяем, если синглтона нет, то надо создать
    if (!Boolean(this.unifiedPromise)) {
      this.startLoading();

      this.unifiedPromise = executor()
        .then((resData: TResult) => {
          runInAction(this.submitSuccess);

          return resData;
        })
        .catch((e) => {
          runInAction(() => {
            this.submitError(e);
          });

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
   * обработчик успешного ответа
   */
  public submitSuccess = () => {
    this.isError = false;
    this.isSuccess = true;
    this.isInvalid = false;
  };

  /**
   * обработчик ошибки
   */
  public submitError = (e: TError) => {
    this.isSuccess = false;
    this.isError = true;
    this.error = e;
  };

  /**
   * метод, вызываемый в самом начале запроса, чтобы сбросить флаги в соответствующее значение
   */
  public startLoading = () => {
    this.isIdle = false;
    this.isLoading = true;
    this.isError = false;
    this.isSuccess = false;
  };

  /**
   * метод для инвалидации данных
   */
  public invalidate = () => {
    this.isInvalid = true;
  };
}
