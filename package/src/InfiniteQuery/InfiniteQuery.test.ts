import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { InfiniteQuery } from './InfiniteQuery';
import { InfiniteDataStorage } from './InfiniteDataStorage';

describe('InfiniteQuery tests', () => {
  const getDataStorage = () => new InfiniteDataStorage();

  it('Проверяем инит состояние, пока ничего не запросили', () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: getDataStorage(),
    });

    expect(store.isError).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.error).toBe(undefined);
  });

  it('Проверяем положительный кейс', async () => {
    const onSuccess = vi.fn();
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: getDataStorage(),
    });

    store.sync({ onSuccess });
    expect(store.isLoading).toBe(true);
    expect(store.data).toBe(undefined);
    await when(() => !store.isLoading);
    expect(onSuccess).toBeCalled();
    expect(store.isLoading).toBe(false);
    expect(store.data).toStrictEqual(['foo']);
  });

  it('Проверяем отрицательный кейс', async () => {
    const onDefaultError = vi.fn();
    const store = new InfiniteQuery(() => Promise.reject('error'), {
      onError: onDefaultError,
      dataStorage: getDataStorage(),
    });

    store.sync({
      onError: (e) => {
        expect(e).toBe('error');
        expect(onDefaultError).not.toBeCalled();
        expect(store.isLoading).toBe(false);
        expect(store.data).toBe(undefined);
        expect(store.isError).toBe(true);
        expect(store.error).toBe('error');
      },
    });
  });

  it('Проверяем отрицательный кейс, когда передан только стандартный обработчик ошибки', async () => {
    const store = new InfiniteQuery(() => Promise.reject('error'), {
      onError: (e) => {
        expect(e).toBe('error');
      },
      dataStorage: getDataStorage(),
    });

    store.sync();
  });

  it('Проверяем инвалидацию', async () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: getDataStorage(),
    });

    expect(store.data).toBe(undefined);
    store.invalidate();
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(store.isLoading).toBe(false);
    expect(store.data).toStrictEqual(['foo']);
  });

  it('Проверяем автоматический запрос данных при обращении к data', async () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      enabledAutoFetch: true,
      dataStorage: getDataStorage(),
    });

    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(store.data).toStrictEqual(['foo']);
  });

  it('Проверяем fetchMore', async () => {
    const insideExecutor = vi.fn();

    const store = new InfiniteQuery(
      (params) => {
        insideExecutor(params);

        // эмулируем ситуацию, что у нас на бэке есть данные для первых двух страниц,
        // на каждой странице всего по 1му элементу
        if (params.offset <= 1) {
          return Promise.resolve(['foo']);
        }

        // если запросили больше чем 2ю страницу, отдаем пустотой массив
        return Promise.resolve([]);
      },
      {
        incrementCount: 1,
        dataStorage: getDataStorage(),
      },
    );

    // проверяем запрос
    store.sync();
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(store.isLoading).toBe(false);
    expect(store.data).toStrictEqual(['foo']);
    expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 0, count: 1 });
    // запускаем fetchMore метод
    store.fetchMore();
    expect(store.isLoading).toBe(true);
    expect(store.isEndReached).toBe(false);
    await when(() => !store.isLoading);
    expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 1, count: 1 });
    expect(store.isLoading).toBe(false);
    expect(store.isEndReached).toBe(false);
    // проверяем что данные именно добавились, а не заменились
    expect(store.data).toStrictEqual(['foo', 'foo']);
    // снова запускаем fetchMore
    store.fetchMore();
    expect(store.isLoading).toBe(true);
    expect(store.isEndReached).toBe(false);
    await when(() => !store.isLoading);
    expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 2, count: 1 });
    expect(store.isLoading).toBe(false);
    // ожидаем, что бэк отдал пустой массив, следовательно, мы достигли конца списка
    expect(store.isEndReached).toBe(true);
    expect(store.data).toStrictEqual(['foo', 'foo']);
    // при еще одной попытке сделать запрос
    store.fetchMore();
    // ожидаем что вызов будет проигнорирован, и флаг загрузки false
    expect(store.isLoading).toBe(false);
    expect(store.isEndReached).toBe(true);
    // ожидаем, что при инвалидации, данные будут заменены на начальный набор
    store.invalidate();
    store.sync();
    await when(() => !store.isLoading);
    expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 0, count: 1 });
    expect(store.data).toStrictEqual(['foo']);
  });

  it('Проверяем синхронизацию данных между двумя сторами, если они используют одно хранилище', async () => {
    const unifiedDataStorage = getDataStorage();

    const storeA = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: unifiedDataStorage,
    });

    const storeB = new InfiniteQuery(() => Promise.resolve(['bar']), {
      dataStorage: unifiedDataStorage,
    });

    await storeA.async();

    expect(
      storeB.data,
      'ожидаем что в стор B попали данные, запрошенные в сторе A',
    ).toStrictEqual(['foo']);

    await storeB.async();

    expect(
      storeA.data,
      'ожидаем что в стор A попали данные, запрошенные в сторе B',
    ).toStrictEqual(['bar']);
  });

  it('Проверяем "network-only" политику c async', async () => {
    // счетчик запроса, для эмуляции меняющихся данных
    let counter = 0;

    const store = new InfiniteQuery(
      () => {
        counter++;

        return Promise.resolve([counter]);
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
    ).toStrictEqual([1]);

    // запускаем сразу второй запрос, который по обычной политике должен быть проигнорирован
    await store.async();

    expect(
      store.data,
      'ожидаем что новые данные после второго запроса так же попадут в стор',
    ).toStrictEqual([2]);
  });

  it('Проверяем "network-only" политику c sync', async () => {
    // счетчик запроса, для эмуляции меняющихся данных
    let counter = 0;

    const store = new InfiniteQuery(
      () => {
        counter++;

        return Promise.resolve([counter]);
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
    ).toStrictEqual([1]);

    // запускаем сразу второй запрос, который по обычной политике должен быть проигнорирован
    store.sync();
    expect(store.isLoading, 'ожидаем что загрузка началась').toBe(true);
    await when(() => !store.isLoading);

    expect(
      store.data,
      'ожидаем что новые данные после второго запроса так же попадут в стор',
    ).toStrictEqual([2]);
  });
});
