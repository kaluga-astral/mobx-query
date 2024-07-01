import { describe, expect, it } from 'vitest';

import { DataStorage, DataStorageFactory } from './DataStorage';

describe('DataStorage', () => {
  const createStorage = () => new DataStorage();

  describe('При исходном состоянии', () => {
    it('Данных изначально нет', () => {
      const storage = createStorage();

      expect(storage.data).toBeUndefined();
    });

    it('Флаг данных выключен', () => {
      const storage = createStorage();

      expect(storage.hasData).toBeFalsy();
    });
  });

  describe('При установке данных', () => {
    it('Флаг наличия данных включен', () => {
      const storage = createStorage();

      storage.setData(['foo']);
      expect(storage.hasData).toBeTruthy();
    });

    it('Данные появились', () => {
      const storage = createStorage();

      storage.setData(['foo']);
      expect(storage.data).toStrictEqual(['foo']);
    });
  });
});

describe('DataStorageFactory', () => {
  it('Инстансы хранилищ с одинаковым ключом совпадают', () => {
    const factory = new DataStorageFactory();

    const storageA = factory.getStorage('foo');
    const storageB = factory.getStorage('foo');

    expect(storageA === storageB).toBeTruthy();
  });

  it('Инстансы хранилищ с разными ключами отличаются', () => {
    const factory = new DataStorageFactory();

    const storageA = factory.getStorage('foo');
    const storageB = factory.getStorage('bar');

    expect(storageA !== storageB).toBeTruthy();
  });
});
