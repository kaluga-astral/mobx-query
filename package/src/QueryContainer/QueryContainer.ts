import { computed, makeObservable } from 'mobx';

import { type StatusStorage } from '../StatusStorage';

type Auxiliary = {
  isIdle: boolean;
};

/**
 * Контейнер для бойлерплейт части,
 * позволяет не повторять в каждом наследуемом классе использование стандартных статусов
 */
export abstract class QueryContainer<TError, TAuxiliary extends Auxiliary> {
  protected constructor(
    private readonly statusStorage: StatusStorage<TError>,
    protected readonly auxiliary: TAuxiliary,
  ) {
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
    return this.statusStorage.isLoading;
  }

  /**
   * флаг обозначающий, что последний запрос был зафейлен
   */
  public get isError() {
    return this.statusStorage.isError;
  }

  /**
   * данные о последней ошибке
   */
  public get error() {
    return this.statusStorage.error;
  }

  /**
   * флаг обозначающий, что последний запрос был успешно завершен
   */
  public get isSuccess() {
    return this.statusStorage.isSuccess;
  }

  /**
   * флаг, обозначающий простаивание, т.е. запроса еще не было
   */
  public get isIdle() {
    return this.auxiliary.isIdle;
  }
}
