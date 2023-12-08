// TODO: отрефакторить тест-кейсы в соответствии с Unit Testing Guide: https://track.astral.ru/soft/browse/UIKIT-1081
/* eslint-disable vitest/valid-expect */
/* eslint-disable vitest/max-expects */

import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { DataStorage } from '../DataStorage';

import { InfiniteQuery } from './InfiniteQuery';

describe('InfiniteQuery', () => {
  const getDataStorage = <T = unknown[]>() => new DataStorage<T>();

  it('Init state: флаги false, данные undefined', () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: getDataStorage(),
    });

    expect(store.isError).toBeFalsy();
    expect(store.isLoading).toBeFalsy();
    expect(store.data).toBeUndefined();
    expect(store.error).toBeUndefined();
  });

  it('sync:fetchPolicy=cache-first: стандартная загрузка успешна', async () => {
    const onSuccess = vi.fn();
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: getDataStorage(),
    });

    store.sync({ onSuccess });
    expect(store.data).toBeUndefined();
    await when(() => !store.isLoading);
    expect(onSuccess).toBeCalled();
    expect(store.data).toStrictEqual(['foo']);
  });

  it('sync:onError: Вызывается обработчик ошибки', async () => {
    const onDefaultError = vi.fn();
    const onError = vi.fn();
    const store = new InfiniteQuery(() => Promise.reject('error'), {
      onError: onDefaultError,
      dataStorage: getDataStorage(),
    });

    store.sync({ onError });
    await when(() => !store.isLoading);
    expect(store.data, 'данные не должны появиться').toBeUndefined();
    expect(store.isError, 'флаг ошибки должен включиться').toBeTruthy();
    await when(() => store.error !== undefined);
    expect(store.error, 'поле ошибки содержит данные ошибки').toBe('error');

    expect(
      onDefaultError,
      'стандартный обработчик ошибки не должен быть вызван',
    ).not.toBeCalled();

    // eslint-disable-next-line vitest/max-expects
    expect(
      onError,
      'переданный обработчик ошибки должен быть вызван, и в него должна передаться ошибка',
    ).toBeCalledWith('error');
  });

  it('sync:defaultOnError: вызывается обработчик ошибки по умолчанию', async () => {
    const store = new InfiniteQuery(() => Promise.reject('error'), {
      onError: (e) => {
        expect(e).toBe('error');
      },
      dataStorage: getDataStorage(),
    });

    store.sync();
  });

  it('invalidate:data:fetchPolicy=cache-first: после invalidate обращение к data запускает загрузку', async () => {
    const store = new InfiniteQuery(
      // executor эмулирует постоянно меняющиеся данные
      () => Promise.resolve([Math.random()]),
      {
        dataStorage: getDataStorage(),
      },
    );

    store.invalidate();

    expect(
      store.data,
      'эмулируем обращение к data, чтобы тригернуть загрузку данных',
    ).toBeUndefined();

    await when(() => !store.isLoading);

    const firstValue = store.data?.[0];

    expect(
      typeof firstValue,
      'ожидаем, что действительно пришло какое то число',
    ).toBe('number');

    store.invalidate();

    expect(
      store.data,
      'эмулируем обращение к data, чтобы тригернуть загрузку данных',
    ).toStrictEqual([firstValue]);

    await when(() => !store.isLoading);

    expect(
      store.data?.[0] !== firstValue,
      'ожидаем, что данные изменились',
    ).toBeTruthy();
  });

  it('data: автоматический запрос данных при обращении к data', async () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      enabledAutoFetch: true,
      dataStorage: getDataStorage(),
    });

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBeFalsy();

    expect(store.data, 'эмулируем считывание данных').toBeUndefined();

    expect(
      store.isLoading,
      'ожидаем, что после считывания данных загрузка началась',
    ).toBeTruthy();
  });

  it('enabledAutoFetch:true:request:fail не происходит повторных запросов', async () => {
    const insideExecutor = vi.fn();
    const store = new InfiniteQuery(
      () => {
        insideExecutor();

        return Promise.reject('foo');
      },
      {
        enabledAutoFetch: true,
        dataStorage: getDataStorage(),
      },
    );

    expect(store.data, 'эмулируем считывание данных').toBeUndefined();
    await when(() => !store.isLoading);
    expect(insideExecutor, 'executor вызван в первый раз').toBeCalled();
    expect(store.data, 'эмулируем считывание данных').toBeUndefined();
    await when(() => !store.isLoading);
    expect(insideExecutor, 'executor больше не вызывается').toBeCalledTimes(1);
  });

  it('fetchMore: данные конкатенируются, счетчики увеличиваются, флаг достижения списка актуален', async () => {
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
    await when(() => !store.isLoading);
    expect(store.data, 'данные появились').toStrictEqual(['foo']);

    expect(
      insideExecutor,
      'первый вызов executor произошел с {offset: 0}',
    ).toHaveBeenLastCalledWith({ offset: 0, count: 1 });

    // запускаем fetchMore метод
    store.fetchMore();

    expect(
      store.isEndReached,
      'флаг окончания списка не достигнут',
    ).toBeFalsy();

    await when(() => !store.isLoading);

    expect(
      insideExecutor,
      'второй вызов executor произошел с {offset: 1}',
    ).toHaveBeenLastCalledWith({ offset: 1, count: 1 });

    expect(
      store.isEndReached,
      'флаг окончания списка не достигнут',
    ).toBeFalsy();

    expect(store.data, 'данные добавились').toStrictEqual(['foo', 'foo']);
    // снова запускаем fetchMore
    store.fetchMore();
    await when(() => !store.isLoading);

    expect(
      insideExecutor,
      'третий вызов executor произошел с {offset: 3}',
    ).toHaveBeenLastCalledWith({ offset: 2, count: 1 });

    expect(
      store.isEndReached,
      'ожидаем, что бэк отдал пустой массив, следовательно, мы достигли конца списка',
    ).toBeTruthy();

    // при еще одной попытке сделать запрос
    store.fetchMore();

    expect(
      store.isLoading,
      'ожидаем что вызов будет проигнорирован',
    ).toBeFalsy();

    // ожидаем, что при инвалидации, данные будут заменены на начальный набор
    store.invalidate();
    store.sync();
    await when(() => !store.isLoading);

    expect(
      insideExecutor,
      'после инвалидации, executor будет вызван с {offset: 0}',
    ).toHaveBeenLastCalledWith({ offset: 0, count: 1 });
  });

  it('isEndReached сбрасывается при каждом ручном запросе', async () => {
    const store = new InfiniteQuery(
      // предположим что у бэка есть только 1 элемент, хотя мы запрашиваем 2
      () => Promise.resolve(['foo']),
      {
        incrementCount: 2,
        dataStorage: getDataStorage(),
      },
    );

    await store.async();

    expect(
      store.isEndReached,
      'после запроса флаг окончания списка включен',
    ).toBeTruthy();

    store.invalidate();
    store.sync();

    expect(
      store.isEndReached,
      'не дожидаясь окончания запроса, флаг окончания списка выключен',
    ).toBeFalsy();
  });

  it('data-synchronization: Данные между двумя сторами синхронизируются, если они используют одно хранилище', async () => {
    const unifiedDataStorage = getDataStorage<string[]>();

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

  it('async:fetchPolicy=network-only данные запрашиваются при каждом вызове', async () => {
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

  it('sync:fetchPolicy=network-only данные запрашиваются при каждом вызове', async () => {
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
    expect(store.isLoading, 'ожидаем что загрузка началась').toBeTruthy();
    await when(() => !store.isLoading);

    expect(
      store.data,
      'ожидаем что новые данные после второго запроса так же попадут в стор',
    ).toStrictEqual([2]);
  });

  it('forceUpdate, данные устанавливаются снаружи', () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: getDataStorage(),
    });

    store.forceUpdate(['foo']);
    expect(store.data, 'данные установились').toStrictEqual(['foo']);
  });

  it('forceUpdate, запрос не происходит', () => {
    const onInsideExecutor = vi.fn();
    const store = new InfiniteQuery(
      () => {
        onInsideExecutor();

        return Promise.resolve(['foo']);
      },
      {
        dataStorage: getDataStorage(),
      },
    );

    store.forceUpdate(['foo']);
    expect(onInsideExecutor, 'executor не вызывался').not.toBeCalled();
  });

  it('При вызове forceUpdate все стаусные флаги устанавливаются в success', () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: getDataStorage(),
    });

    store.forceUpdate(['foo']);
    expect(store.isSuccess).toBeTruthy();
    expect(store.isError).toBeFalsy();
  });
});
