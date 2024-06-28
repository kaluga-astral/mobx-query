import { computed, makeObservable } from 'mobx';

type Auxiliary<TError> = {
  isLoading: boolean;
  isError: boolean;
  error?: TError;
  isSuccess: boolean;
  isIdle: boolean;
};

/**
 * Контейнер для бойлерплейт части,
 * позволяет не повторять в каждом наследуемом классе использование стандартных статусов
 */
export abstract class QueryContainer<
  TError,
  TAuxiliary extends Auxiliary<TError>,
> {
  protected constructor(protected readonly auxiliary: TAuxiliary) {
    makeObservable(this, {
      error: computed,
      isError: computed,
      isIdle: computed,
      isLoading: computed,
      isSuccess: computed,
    });
  }

  /**
   * флаг загрузки данных
   */
  public get isLoading() {
    return this.auxiliary.isLoading;
  }

  /**
   * флаг обозначающий, что последний запрос был зафейлен
   */
  public get isError() {
    return this.auxiliary.isError;
  }

  /**
   * данные о последней ошибке
   */
  public get error() {
    return this.auxiliary.error;
  }

  /**
   * флаг обозначающий, что последний запрос был успешно завершен
   */
  public get isSuccess() {
    return this.auxiliary.isSuccess;
  }

  /**
   * флаг, обозначающий простаивание, т.е. запроса еще не было
   */
  public get isIdle() {
    return this.auxiliary.isIdle;
  }
}
