import { describe, expect, it } from 'vitest';

import { DataStorage, DataStorageFactory } from './DataStorage';

describe('DataStorage', () => {
  it('Данные меняются, флаг наличия данных меняется', () => {
    const storage = new DataStorage();

    // TODO: для каждого expect должен быть свой тест-кейс: https://track.astral.ru/soft/browse/UIKIT-1081
    // eslint-disable-next-line vitest/valid-expect
    expect(storage.data, 'данных изначально нет').toBeUndefined();
    // eslint-disable-next-line vitest/valid-expect
    expect(storage.hasData, 'флаг данных выключен').toBeFalsy();
    storage.setData(['foo']);
    // eslint-disable-next-line vitest/valid-expect
    expect(storage.hasData, 'флаг данных включен').toBeTruthy();
    // eslint-disable-next-line vitest/valid-expect
    expect(storage.data, 'данные появились').toStrictEqual(['foo']);
  });
});

describe('DataStorageFactory', () => {
  it('Инстансы хранилищ с одинаковым ключом совпадают', () => {
    const factory = new DataStorageFactory();

    const storageA = factory.getStorage(['foo']);
    const storageB = factory.getStorage(['foo']);

    expect(storageA === storageB).toBeTruthy();
  });

  it('Инстансы хранилищ с разными ключами отличаются', () => {
    const factory = new DataStorageFactory();

    const storageA = factory.getStorage(['foo']);
    const storageB = factory.getStorage(['bar']);

    expect(storageA !== storageB).toBeTruthy();
  });
});
