import { describe, expect, it } from 'vitest';

import { DataStorage, DataStorageFactory } from './DataStorage';

describe('DataStorage tests', () => {
  it('DataStorage Проверяем установку данных и работу флага', () => {
    const storage = new DataStorage();

    expect(storage.data, 'данных изначально нет').toBe(undefined);
    expect(storage.hasData, 'флаг данных выключен').toBe(false);
    storage.setData(['foo']);
    expect(storage.hasData, 'флаг данных включен').toBe(true);
    expect(storage.data, 'данные появились').toStrictEqual(['foo']);
  });

  it('DataStorageFactory Проверяем создание инстансов хранилищ', () => {
    const factory = new DataStorageFactory();

    const storageA = factory.getStorage(['foo']);
    const storageB = factory.getStorage(['foo']);
    const storageC = factory.getStorage(['bar']);

    console.log(storageA, storageB);

    expect(
      storageA === storageB,
      'хранилища с одинаковым ключом одинаковые',
    ).toBe(true);

    expect(storageA !== storageC, 'хранилища с разными ключами разные').toBe(
      true,
    );
  });
});
