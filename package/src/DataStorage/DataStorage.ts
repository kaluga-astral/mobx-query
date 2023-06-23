import { makeAutoObservable } from 'mobx';

import { CacheKey } from '../types';

/**
 * @description хранилище данных, предназначено для обеспечения единого интерфейса при работе с данными
 */
export class DataStorage<TData> {
  /**
   * @description поле, отвечающее за непосредственное хранение данных
   */
  private internalData?: TData = undefined;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * @description флаг, отображающий наличие данных
   */
  public get hasData() {
    return Boolean(this.internalData);
  }

  /**
   * @description метод для установки данных
   */
  public setData = (value: TData) => {
    this.internalData = value;
  };

  /**
   * @description геттер данных
   */
  public get data() {
    return this.internalData;
  }
}

/**
 * @description фабрика ответственная за создание и хранение экземляров хранилищ
 */
export class DataStorageFactory {
  /**
   * @description Map хранящий инстансы хранилищ по хэшу ключа
   */
  private storageMap = new Map<string, DataStorage<unknown>>();

  /**
   * @description фабричный метод получения/создания инстанса хранилища по ключу
   */
  public getStorage = <TData>(key: CacheKey[]) => {
    const keyHash = JSON.stringify(key);

    if (!this.storageMap.has(keyHash)) {
      this.storageMap.set(keyHash, new DataStorage());
    }

    return this.storageMap.get(keyHash) as DataStorage<TData>;
  };
}
