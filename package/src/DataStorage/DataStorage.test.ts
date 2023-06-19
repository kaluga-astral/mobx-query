import { describe, expect, it } from 'vitest';

import { DataStorage, DataStorageFactory } from './DataStorage';

describe('DataStorage', () => {
  it('Данные меняются, флаг наличия данных меняется', () => {
    const storage = new DataStorage();

    expect(storage.data, 'данных изначально нет').toBe(undefined);
    expect(storage.hasData, 'флаг данных выключен').toBe(false);
    storage.setData(['foo']);
    expect(storage.hasData, 'флаг данных включен').toBe(true);
    expect(storage.data, 'данные появились').toStrictEqual(['foo']);
  });
});

describe('DataStorageFactory', () => {
  it('Инстансы хранилищ с одинаковым ключом совпадают', () => {
    const factory = new DataStorageFactory();

    const storageA = factory.getStorage(['foo']);
    const storageB = factory.getStorage(['foo']);

    expect(storageA === storageB).toBe(true);
  });

  it('Инстансы хранилищ с разными ключами отличаются', () => {
    const factory = new DataStorageFactory();

    const storageA = factory.getStorage(['foo']);
    const storageB = factory.getStorage(['bar']);

    expect(storageA !== storageB).toBe(true);
  });
});
