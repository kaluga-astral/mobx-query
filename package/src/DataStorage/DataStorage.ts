import { makeAutoObservable } from 'mobx';

import { CacheKey } from '../types';

type DataStorageParams = {
  /**
   * @description коллбэк метод для оповещения об обновлении данных
   */
  onUpdate?: (keys: CacheKey[]) => void;
  key: CacheKey[];
};

/**
 * @description хранилище данных, предназначено для обеспечения единого интерфейса при работе с данными
 */
export class DataStorage<TData> {
  private params?: DataStorageParams;

  /**
   * @description поле, отвечающее за непосредственное хранение данных
   */
  private internalData?: TData = undefined;

  constructor(params?: DataStorageParams) {
    this.params = params;
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
  public setData = (value: TData, skipOnUpdate = false) => {
    this.internalData = value;

    if (!skipOnUpdate) {
      this.params?.onUpdate?.(this.params.key);
    }
  };

  /**
   * @description геттер данных
   */
  public get data() {
    return this.internalData;
  }
}

type DataStorageFactoryParams = {
  /**
   * @description коллбэк метод для оповещения об обновлении данных
   */
  onUpdate?: (keys: CacheKey[]) => void;
};

/**
 * @description фабрика ответственная за создание и хранение экземляров хранилищ
 */
export class DataStorageFactory {
  private params: DataStorageFactoryParams;

  constructor(params: DataStorageFactoryParams) {
    this.params = params;
  }

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
      this.storageMap.set(
        keyHash,
        new DataStorage({ onUpdate: this.params.onUpdate, key }),
      );
    }

    return this.storageMap.get(keyHash) as DataStorage<TData>;
  };
}
