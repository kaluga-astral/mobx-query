import { action, makeObservable, observable, runInAction } from 'mobx';

import { type StatusStorage } from '../StatusStorage';

/**
 * Испольнитель запроса
 */
type Executor<TResult> = () => Promise<TResult>;

type SetStorage<TError> = (storage: StatusStorage<TError>) => void;

/**
 * Вспомогательное хранилище данных, для композиции в Query сторах,
 * содержащее флаги загрузки и ошибки,
 * колбэки на успешный запрос и на ошибку,
 * данные последней ошибки,
 * а так же, управляющее синглтон промисом.
 */
export class AuxiliaryQuery<TResult, TError = void> {
  /**
   * Флаг, обозначающий простаивание, т.е. запроса еще не было
   */
  public isIdle = true;

  /**
   * Единый промис, для устранения гонки запросов
   */
  private unifiedPromise?: Promise<TResult>;

  /**
   * Флаг, по которому реактивно определяется необходимость запуска инвалидации
   */
  public isInvalid: boolean = false;

  constructor(
    private readonly statusStorage: StatusStorage<TError>,
    private readonly backgroundStatusStorage: StatusStorage<TError> | null,
  ) {
    makeObservable(this as ThisType<this>, {
      getUnifiedPromise: action,
      isIdle: observable,
      isInvalid: observable,
      submitSuccess: action,
      setSuccess: action,
      setError: action,
      setLoading: action,
      submitError: action,
      startLoading: action,
      invalidate: action,
    });
  }

  /**
   * Метод ответственный за создание единого промиса,
   * для устранения гонки запросов
   */
  public getUnifiedPromise = (
    executor: Executor<TResult>,
    onSuccess?: (data: TResult) => void,
  ) => {
    // проверяем, если синглтона нет, то надо создать
    if (!Boolean(this.unifiedPromise)) {
      this.startLoading();

      this.unifiedPromise = executor()
        .then((resData: TResult) => {
          runInAction(this.submitSuccess);
          onSuccess?.(resData);

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

  private setSuccess: SetStorage<TError> = (storage) => {
    storage.isError = false;
    storage.isSuccess = true;
  };

  private checkBackgroundAndSet = (setStorage: SetStorage<TError>) => {
    if (this.backgroundStatusStorage && this.statusStorage.isSuccess) {
      setStorage(this.backgroundStatusStorage);
    } else {
      setStorage(this.statusStorage);
    }
  };

  /**
   * Обработчик успешного ответа
   */
  public submitSuccess = () => {
    this.checkBackgroundAndSet(this.setSuccess);
    this.isInvalid = false;
  };

  private setError = (storage: StatusStorage<TError>, error: TError) => {
    storage.isSuccess = false;
    storage.isError = true;
    storage.error = error;
  };

  /**
   * Обработчик ошибки
   */
  public submitError = (error: TError) => {
    this.checkBackgroundAndSet((storage) => this.setError(storage, error));
  };

  private setLoading: SetStorage<TError> = (storage) => {
    storage.isLoading = true;
    storage.isError = false;
    storage.isSuccess = false;
  };

  /**
   * Метод, вызываемый в самом начале запроса, чтобы сбросить флаги в соответствующее значение
   */
  public startLoading = () => {
    this.isIdle = false;
    this.checkBackgroundAndSet(this.setLoading);
  };

  /**
   * Метод для инвалидации данных
   */
  public invalidate = () => {
    this.isInvalid = true;
  };
}
