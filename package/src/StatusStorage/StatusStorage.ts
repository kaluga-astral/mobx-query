import { makeObservable, observable } from 'mobx';

import { StorageFactory } from '../StorageFactory';

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
   * Флаг обозначающий загрузку данных
   */
  public isLoading: boolean = false;

  /**
   * Флаг обозначающий, что последний запрос был зафейлен
   */
  public isError: boolean = false;

  /**
   * Данные о последней ошибке
   */
  public error?: TError = undefined;

  /**
   * Флаг, обозначающий успешность завершения последнего запроса
   */
  public isSuccess = false;
}

export class StatusStorageFactory extends StorageFactory<StatusStorage<void>> {
  constructor() {
    super(() => new StatusStorage());
  }

  public getStorage = <TError>(keyHash: string) => {
    return this.getInternalStorage(keyHash) as StatusStorage<TError>;
  };
}
