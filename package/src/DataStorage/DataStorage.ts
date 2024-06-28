import { makeAutoObservable } from 'mobx';

import type { CacheKey } from '../types';

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
export class DataStorageFactory {
  /**
   * Map хранящий инстансы хранилищ по хэшу ключа
   */
  private storageMap = new Map<string, DataStorage<unknown>>();

  /**
   * фабричный метод получения/создания инстанса хранилища по ключу
   */
  public getStorage = <TData>(key: CacheKey[]) => {
    const keyHash = JSON.stringify(key);

    if (!this.storageMap.has(keyHash)) {
      this.storageMap.set(keyHash, new DataStorage());
    }

    return this.storageMap.get(keyHash) as DataStorage<TData>;
  };
}
