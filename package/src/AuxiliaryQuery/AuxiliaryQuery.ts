import { action, makeObservable, observable, runInAction } from 'mobx';

import { type StatusStorage } from '../StatusStorage';

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

  constructor(private readonly statusStorage: StatusStorage<TError>) {
    makeObservable(this as ThisType<this>, {
      getUnifiedPromise: action,
      isIdle: observable,
      isInvalid: observable,
      submitSuccess: action,
      submitError: action,
      startLoading: action,
      invalidate: action,
    });
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
            this.statusStorage.isLoading = false;
          });
        });
    }

    return this.unifiedPromise as Promise<TResult>;
  };

  /**
   * обработчик успешного ответа
   */
  public submitSuccess = () => {
    this.statusStorage.isError = false;
    this.statusStorage.isSuccess = true;
    this.isInvalid = false;
  };

  /**
   * обработчик ошибки
   */
  public submitError = (e: TError) => {
    this.statusStorage.isSuccess = false;
    this.statusStorage.isError = true;
    this.statusStorage.error = e;
  };

  /**
   * метод, вызываемый в самом начале запроса, чтобы сбросить флаги в соответствующее значение
   */
  public startLoading = () => {
    this.isIdle = false;
    this.statusStorage.isLoading = true;
    this.statusStorage.isError = false;
    this.statusStorage.isSuccess = false;
  };

  /**
   * метод для инвалидации данных
   */
  public invalidate = () => {
    this.isInvalid = true;
  };
}
