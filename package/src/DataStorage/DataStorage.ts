import { makeAutoObservable } from 'mobx';

import { StorageFactory } from '../StorageFactory';

/**
 * Хранилище данных, предназначено для обеспечения единого интерфейса при работе с данными
 */
export class DataStorage<TData> {
  /**
   * Поле, отвечающее за непосредственное хранение данных
   */
  private internalData?: TData = undefined;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Флаг, отображающий наличие данных
   */
  public get hasData() {
    return Boolean(this.internalData);
  }

  /**
   * Метод для установки данных
   */
  public setData = (value: TData) => {
    this.internalData = value;
  };

  /**
   * Геттер данных
   */
  public get data() {
    return this.internalData;
  }
}

/**
 * Фабрика ответственная за создание и хранение экземляров хранилищ
 */
export class DataStorageFactory extends StorageFactory<DataStorage<unknown>> {
  constructor() {
    super(() => new DataStorage());
  }

  /**
   * Фабричный метод получения/создания инстанса хранилища по ключу
   */
  public getStorage = <TData>(keyHash: string) => {
    return this.getInternalStorage(keyHash) as DataStorage<TData>;
  };
}
