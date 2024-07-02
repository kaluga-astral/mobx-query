import { makeAutoObservable } from 'mobx';

import type { CacheKey } from '../types';
import { StorageFactory } from '../StorageFactory';

/**
 * хранилище данных, предназначено для обеспечения единого интерфейса при работе с данными
 */
export class DataStorage<TData> {
  /**
   * поле, отвечающее за непосредственное хранение данных
   */
  private internalData?: TData = undefined;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * флаг, отображающий наличие данных
   */
  public get hasData() {
    return Boolean(this.internalData);
  }

  /**
   * метод для установки данных
   */
  public setData = (value: TData) => {
    this.internalData = value;
  };

  /**
   * геттер данных
   */
  public get data() {
    return this.internalData;
  }
}

/**
 * фабрика ответственная за создание и хранение экземляров хранилищ
 */
export class DataStorageFactory extends StorageFactory<DataStorage<unknown>> {
  constructor() {
    super(() => new DataStorage());
  }

  /**
   * фабричный метод получения/создания инстанса хранилища по ключу
   */
  public getStorage = <TData>(key: CacheKey[]) => {
    return this.getInternalStorage(key) as DataStorage<TData>;
  };
}
