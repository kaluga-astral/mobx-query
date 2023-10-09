import { makeAutoObservable } from 'mobx';

import { CacheKey } from '../types';

type DataStorageParams = {
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

/**
 * @description фабрика ответственная за создание и хранение экземляров хранилищ
 */
export class DataStorageFactory {
  /**
   * @description Map хранящий инстансы хранилищ по хэшу ключа
   */
  private storageMap = new Map<CacheKey[], DataStorage<unknown>>();

  /**
   * @description фабричный метод получения/создания инстанса хранилища по ключу
   */
  public getStorage = <TData>(
    key: CacheKey[],
    onUpdate?: (keys: CacheKey[]) => void,
  ) => {
    if (!this.storageMap.has(key)) {
      this.storageMap.set(key, new DataStorage({ onUpdate, key }));
    }

    return this.storageMap.get(key) as DataStorage<TData>;
  };
}
