import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { DataStorage } from '../DataStorage';

import { Query } from './Query';

describe('CacheableQuery tests', () => {
  const getDataStorage = () => new DataStorage();

  it('Проверяем инит состояние, пока ничего не запросили', () => {
    const store = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    expect(store.isError).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.error).toBe(undefined);
  });

  it('Проверяем положительный кейс', async () => {
    const onSuccess = vi.fn();
    const store = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    store.sync({ onSuccess });
    expect(store.isLoading).toBe(true);
    expect(store.data).toBe(undefined);
    await when(() => !store.isLoading);
    expect(onSuccess).toBeCalled();
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe('foo');
    // повторный запрос должен игнорироваться
    store.sync();

    expect(store.isLoading, 'повторный запрос должен игнорироваться').toBe(
      false,
    );
  });

  it('Проверяем отрицательный кейс вызова sync когда передан обработчик ошибки в саму функцию', async () => {
    const onError = vi.fn();
    const store = new Query(() => Promise.reject('foo'), {
      dataStorage: getDataStorage(),
    });

    store.sync({ onError });
    await when(() => !store.isLoading);
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.isError).toBe(true);
    await when(() => store.error !== undefined);
    expect(store.error).toBe('foo');
    expect(onError).toBeCalledWith('foo');
  });

  it('Проверяем отрицательный кейс вызова syc, когда передан обработчик ошибки по умолчанию', async () => {
    const onDefaultError = vi.fn();
    const store = new Query(() => Promise.reject('foo'), {
      onError: onDefaultError,
      dataStorage: getDataStorage(),
    });

    store.sync();
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    await when(() => store.error !== undefined);
    expect(store.error).toBe('foo');
    expect(onDefaultError).toBeCalledWith('foo');
  });

  it('Проверяем автоматический запрос данных при обращении к data', async () => {
    const store = new Query(() => Promise.resolve('foo'), {
      enabledAutoFetch: true,
      dataStorage: getDataStorage(),
    });

    expect(
      store.isLoading,
      'проверяем что загрузка не началась сама по себе',
    ).toBe(false);

    expect(store.data, 'эмулируем обращение к data').toBe(undefined);
    expect(store.isLoading, 'проверяем, что загрузка началась').toBe(true);
    await when(() => !store.isLoading);
    expect(store.data).toStrictEqual('foo');
  });

  it('Проверяем инвалидацию считыванием data', async () => {
    const store = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    expect(store.data, 'проверяем, что данных действительно нет').toBe(
      undefined,
    );

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBe(false);

    expect(store.data, 'эмулируем считывание данных').toBe(undefined);

    expect(
      store.isLoading,
      'ожидаем, что после считывания данных загрузка началась',
    ).toBe(true);
  });

  it('Проверяем инвалидацию запуском sync', async () => {
    const store = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    // добавляем данные в стор
    store.sync();
    await when(() => !store.isLoading);
    expect(store.data, 'проверяем, что данные есть').toBe('foo');
    store.sync();

    expect(
      store.isLoading,
      'ожидаем что загрузка не началась, потому что инвалидация еще не была вызвана',
    ).toBe(false);

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBe(false);

    store.sync();

    expect(
      store.isLoading,
      'ожидаем, что после последовательного вызова инвалидации и sync загрузка все таки началась',
    ).toBe(true);
  });

  it('Проверяем инвалидацию запуском async', async () => {
    const store = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    // добавляем данные в стор
    await store.async();
    expect(store.data, 'проверяем, что данные есть').toBe('foo');
    store.sync();

    expect(
      store.isLoading,
      'ожидаем что загрузка не началась, потому что инвалидация еще не была вызвана',
    ).toBe(false);

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBe(false);

    store.async();

    expect(
      store.isLoading,
      'ожидаем, что после последовательного вызова инвалидации и async загрузка все таки началась',
    ).toBe(true);
  });

  it('Проверяем синхронизацию данных между двумя сторами, если они используют одно хранилище', async () => {
    const unifiedDataStorage = getDataStorage();

    const storeA = new Query(() => Promise.resolve('foo'), {
      dataStorage: unifiedDataStorage,
    });

    const storeB = new Query(() => Promise.resolve('bar'), {
      dataStorage: unifiedDataStorage,
    });

    await storeA.async();

    expect(
      storeB.data,
      'ожидаем что в стор B попали данные, запрошенные в сторе A',
    ).toBe('foo');

    await storeB.async();

    expect(
      storeA.data,
      'ожидаем что в стор A попали данные, запрошенные в сторе B',
    ).toBe('bar');
  });

  it('Проверяем "network-only" политику c async', async () => {
    // счетчик запроса, для эмуляции меняющихся данных
    let counter = 0;

    const store = new Query(
      () => {
        counter++;

        return Promise.resolve(counter);
      },
      {
        dataStorage: getDataStorage(),
        fetchPolicy: 'network-only',
      },
    );

    await store.async();

    expect(
      store.data,
      'ожидаем что данные после первого запроса попадут в стор как обычно',
    ).toBe(1);

    // запускаем сразу второй запрос, который по обычной политике должен быть проигнорирован
    await store.async();

    expect(
      store.data,
      'ожидаем что новые данные после второго запроса так же попадут в стор',
    ).toBe(2);
  });

  it('Проверяем "network-only" политику c sync', async () => {
    // счетчик запроса, для эмуляции меняющихся данных
    let counter = 0;

    const store = new Query(
      () => {
        counter++;

        return Promise.resolve(counter);
      },
      {
        dataStorage: getDataStorage(),
        fetchPolicy: 'network-only',
      },
    );

    store.sync();
    await when(() => !store.isLoading);

    expect(
      store.data,
      'ожидаем что данные после первого запроса попадут в стор как обычно',
    ).toBe(1);

    // запускаем сразу второй запрос, который по обычной политике должен быть проигнорирован
    store.sync();
    expect(store.isLoading, 'ожидаем что загрузка началась').toBe(true);
    await when(() => !store.isLoading);

    expect(
      store.data,
      'ожидаем что новые данные после второго запроса так же попадут в стор',
    ).toBe(2);
  });
});
