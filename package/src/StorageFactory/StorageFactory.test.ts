import { describe, expect, it, vi } from 'vitest';

import { StorageFactory } from './StorageFactory';

describe('StorageFactory', () => {
  const buildSut = <TData>(createData: () => TData) => {
    class Factory extends StorageFactory<TData> {
      constructor() {
        super(createData);
      }

      getStorage = (key: string[]) => {
        return this.getInternalStorage(key);
      };
    }

    return new Factory();
  };

  it('Фабрика вызывает метод создания при попытке получить данные', () => {
    const createDataSpy = vi.fn();
    const createData = () => {
      createDataSpy();

      return 'foo';
    };
    const sut = buildSut(createData);

    // эмулируем обращение к данным
    JSON.stringify(sut.getStorage(['foo']));
    expect(createDataSpy).toBeCalled();
  });

  it('GetStorage создает стор при попытке получить данные', () => {
    const createData = () => 'foo';
    const sut = buildSut(createData);

    expect(sut.getStorage([''])).toBe('foo');
  });

  it('GetStorage отдает ранее созданную сущность при вызове получения с одинаковым ключом', () => {
    const sut = buildSut(() => ({}));

    const dataA = sut.getStorage(['foo']);
    const dataB = sut.getStorage(['foo']);

    expect(dataA).toBe(dataB);
  });

  it('GetStorage отдает разные сущности при вызове получения с разными ключами', () => {
    const sut = buildSut(() => ({}));

    const dataA = sut.getStorage(['foo']);
    const dataB = sut.getStorage(['bar']);

    expect(dataA).not.toBe(dataB);
  });
});
