import { AdaptableMap } from '../AdaptableMap';

export abstract class StorageFactory<TStorage extends {}> {
  private readonly adaptableMap = new AdaptableMap<TStorage>();

  protected constructor(private readonly createStorage: () => TStorage) {}

  /**
   * Фабричный метод получения/создания инстанса хранилища по ключу
   */
  public getInternalStorage = (keyHash: string) => {
    const storage = this.adaptableMap.get(keyHash);

    if (!storage) {
      const createdStorage = this.createStorage();

      this.adaptableMap.set(keyHash, createdStorage);

      return createdStorage;
    }

    return storage;
  };
}
