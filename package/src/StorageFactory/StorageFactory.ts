import { type CacheKey } from '../types';

export abstract class StorageFactory<TStorage> {
  protected constructor(private readonly createStorage: () => TStorage) {}

  /**
   * Map хранящий инстансы хранилищ по хэшу ключа
   */
  private storageMap = new Map<string, TStorage>();

  /**
   * фабричный метод получения/создания инстанса хранилища по ключу
   */
  protected getInternalStorage = (key: CacheKey[]) => {
    const keyHash = JSON.stringify(key);

    if (!this.storageMap.has(keyHash)) {
      this.storageMap.set(keyHash, this.createStorage());
    }

    return this.storageMap.get(keyHash);
  };
}
