import { describe, expect, it } from 'vitest';

import {
  InfiniteDataStorage,
  InfiniteDataStorageFactory,
} from './InfiniteDataStorage';

describe('InfiniteDataStorage tests', () => {
  it('InfiniteDataStorage Проверяем установку данных и работу флага', () => {
    const storage = new InfiniteDataStorage();

    expect(storage.data, 'данных изначально нет').toBe(undefined);
    expect(storage.hasData, 'флаг данных выключен').toBe(false);
    storage.setData(['foo']);
    expect(storage.hasData, 'флаг данных включен').toBe(true);
    expect(storage.data, 'данные появились').toStrictEqual(['foo']);
  });

  it('InfiniteDataStorage Проверяем инкремент данных', () => {
    const storage = new InfiniteDataStorage();

    storage.increment(['foo']);
    expect(storage.data, 'данные появились').toStrictEqual(['foo']);
    storage.increment(['bar']);
    expect(storage.data, 'данные изменились').toStrictEqual(['foo', 'bar']);
    storage.setData(['baz']);

    expect(storage.data, 'данные сбросились к указанному').toStrictEqual([
      'baz',
    ]);
  });

  it('InfiniteDataStorageFactory Проверяем создание инстансов хранилищ', () => {
    const factory = new InfiniteDataStorageFactory();

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
