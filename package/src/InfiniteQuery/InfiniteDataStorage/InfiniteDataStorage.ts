import { makeAutoObservable } from 'mobx';

import { CacheKey, QueryStorage } from '../../types';

/**
 * @description хранилище данных для InfiniteQuery
 */
export class InfiniteDataStorage<TData extends unknown[]>
  implements QueryStorage<TData>
{
  /**
   * @description поле, отвечающее за непосредственное хранение данных
   */
  private internalData?: TData;

  public id = Math.random();

  constructor() {
    makeAutoObservable(this, { id: false });
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
   * @description метод для прибавления нового набора данных к уже имеющимся
   */
  public increment = (value: TData) => {
    if (!this.internalData) {
      this.setData(value);
    } else {
      this.internalData = [...this.internalData, ...value] as TData;
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
export class InfiniteDataStorageFactory {
  /**
   * @description Map хранящий инстансы хранилищ по хэшу ключа
   */
  private storageMap = new Map<string, InfiniteDataStorage<unknown[]>>();

  /**
   * @description фабричный метод получения/создания инстанса хранилища по ключу
   */
  public getStorage = <TData>(key: CacheKey[]) => {
    const keyHash = JSON.stringify(key);

    if (!this.storageMap.has(keyHash)) {
      return this.storageMap.set(keyHash, new InfiniteDataStorage());
    }

    return this.storageMap.get(keyHash) as InfiniteDataStorage<TData[]>;
  };
}
