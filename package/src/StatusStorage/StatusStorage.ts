import { makeObservable, observable } from 'mobx';

import { StorageFactory } from '../StorageFactory';
import { type CacheKey } from '../types';

export class StatusStorage<TError> {
  constructor() {
    makeObservable(this, {
      error: observable,
      isError: observable,
      isLoading: observable,
      isSuccess: observable,
    });
  }

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
}

export class StatusStorageFactory extends StorageFactory<StatusStorage<void>> {
  constructor() {
    super(() => new StatusStorage());
  }

  public getStorage = <TError>(key: CacheKey[]) => {
    return this.getInternalStorage(key) as StatusStorage<TError>;
  };
}
