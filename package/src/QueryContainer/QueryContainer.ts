import { computed, makeObservable } from 'mobx';

import { type StatusStorage } from '../StatusStorage';

export type QueryContainerAuxiliary = {
  isIdle: boolean;
};

type Statuses<TError> = StatusStorage<TError>;

/**
 * Контейнер для бойлерплейт части,
 * позволяет не повторять в каждом наследуемом классе использование стандартных статусов
 */
export abstract class QueryContainer<
  TError,
  TAuxiliary extends QueryContainerAuxiliary,
  TIsBackground extends boolean,
> implements Statuses<TError>
{
  protected constructor(
    private readonly statusStorage: StatusStorage<TError>,
    private readonly backgroundStatusStorage: StatusStorage<TError> | null,
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

  /**
   * статусы, изменяющиеся после первого успешного запроса в режиме isBackground: true
   * @example
   * const query = mobxQuery.createQuery(
   *     ['some cache key'],
   *     () => Promise.resolve('foo'),
   *     { isBackground: true }
   * );
   *
   * await query.async();
   * console.log(query.isLoading); // переключался в true на момент запроса
   * console.log(query.isSuccess); // true
   *
   * query.invalidate();
   * await query.async();
   * console.log(query.isLoading); // не изменялся
   * console.log(query.isSuccess); // остался неизменным - true
   *
   * console.log(query.backgroundStatus.isLoading); // переключался в true на момент обновления
   * console.log(query.backgroundStatus.isSuccess); // true
   *
   * @exception isBackground:false (а так же по умолчанию) background не доступен, и равен null
   * @exception Mutation не доступен в мутации и равен null
   */
  public get background(): TIsBackground extends true
    ? Statuses<TError>
    : null {
    if (!this.backgroundStatusStorage) {
      return null as never;
    }

    return this.backgroundStatusStorage as TIsBackground extends true
      ? Statuses<TError>
      : null;
  }
}
