// TODO: отрефакторить тест-кейсы в соответствии с Unit Testing Guide: https://track.astral.ru/soft/browse/UIKIT-1081
/* eslint-disable vitest/valid-expect */
/* eslint-disable vitest/max-expects */

import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { DataStorage } from '../DataStorage';

import { Query } from './Query';

describe('Query', () => {
  const getDataStorage = () => new DataStorage();

  it('Init state: флаги false, данные undefined', () => {
    const store = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    expect(store.isError).toBeFalsy();
    expect(store.isLoading).toBeFalsy();
    expect(store.isSuccess).toBeFalsy();
    expect(store.data).toBeUndefined();
    expect(store.error).toBeUndefined();
  });

  it('sync:fetchPolicy=cache-first: стандартная загрузка успешна', async () => {
    const onSuccess = vi.fn();
    const store = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    store.sync({ onSuccess });
    expect(store.data).toBeUndefined();
    await when(() => !store.isLoading);
    expect(onSuccess).toBeCalled();
    expect(store.data).toBe('foo');
  });

  it('isSuccess:isError: При успешном запросе устанавливаются соответствующие флаги', async () => {
    const store = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    await store.async();
    expect(store.isSuccess, 'флаг успешности должен быть включен').toBeTruthy();
    expect(store.isError, 'флаг ошибки должен быть выключен').toBeFalsy();
  });

  it('isSuccess:isError При провальном запросе устанавливаются соответствующие флаги', async () => {
    const store = new Query(() => Promise.reject('foo'), {
      dataStorage: getDataStorage(),
    });

    await store.async().catch((e) => e);
    expect(store.isSuccess, 'флаг успешности должен быть выключен').toBeFalsy();
    expect(store.isError, 'флаг ошибки должен быть включен').toBeTruthy();
  });

  it('isSuccess:isError:fetchPolicy=network-only: флаги переключаются в соответствующее значение, в зависимости от ответа', async () => {
    // эмулируем меняющееся поведение запроса, четные запросы будут падать, нечетные завершаться успешно
    let counter = 0;
    const store = new Query(
      () => {
        counter++;

        if (counter % 2) {
          return Promise.resolve('foo');
        }

        return Promise.reject('bar');
      },
      {
        dataStorage: getDataStorage(),
        fetchPolicy: 'network-only',
      },
    );

    // первый запрос успешный
    await store.async();

    expect(
      store.isSuccess,
      'при успешном запроса, флаг успешности должен быть включен',
    ).toBeTruthy();

    expect(
      store.isError,
      'при успешном запроса, флаг ошибки должен быть выключен',
    ).toBeFalsy();

    // второй запрос зафейлится
    await store.async().catch((e) => e);

    expect(
      store.isSuccess,
      'при фейле запроса, флаг успешности должен переключится в false',
    ).toBeFalsy();

    expect(
      store.isError,
      'при фейле запроса, флаг ошибки должен переключться в true',
    ).toBeTruthy();
  });

  it('sync:onError: Вызывается обработчик ошибки', async () => {
    const onError = vi.fn();
    const store = new Query(() => Promise.reject('foo'), {
      dataStorage: getDataStorage(),
    });

    store.sync({ onError });
    await when(() => !store.isLoading);
    expect(store.data).toBeUndefined();
    expect(store.isError).toBeTruthy();
    await when(() => store.error !== undefined);
    expect(store.error).toBe('foo');
    expect(onError).toBeCalledWith('foo');
  });

  it('sync:defaultOnError: вызывается обработчик ошибки по умолчанию', async () => {
    const onDefaultError = vi.fn();
    const store = new Query(() => Promise.reject('foo'), {
      onError: onDefaultError,
      dataStorage: getDataStorage(),
    });

    store.sync();
    await when(() => !store.isLoading);
    await when(() => store.error !== undefined);
    expect(store.error).toBe('foo');
    expect(onDefaultError).toBeCalledWith('foo');
  });

  it('data: автоматический запрос данных при обращении к data', async () => {
    const store = new Query(() => Promise.resolve('foo'), {
      enabledAutoFetch: true,
      dataStorage: getDataStorage(),
    });

    expect(store.data, 'эмулируем обращение к data').toBeUndefined();
    expect(store.isLoading, 'проверяем, что загрузка началась').toBeTruthy();
    await when(() => !store.isLoading);
    expect(store.data).toBe('foo');
  });

  it('invalidate:data:fetchPolicy=cache-first: После инвалидации считывание data приводит к перезапросу данных', async () => {
    const store = new Query(
      // executor эмулирует постоянно меняющиеся данные
      () => Promise.resolve(Math.random()),
      {
        dataStorage: getDataStorage(),
      },
    );

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

    await when(() => !store.isLoading);

    const firstValue = store.data;

    expect(typeof firstValue).toBe('number');
    store.invalidate();
    expect(store.data, 'эмулируем считывание данных').toBe(firstValue);
    await when(() => !store.isLoading);

    expect(
      store.data !== firstValue,
      'ожидаем, что число изменилось',
    ).toBeTruthy();
  });

  it('invalidate:sync:fetchPolicy=cache-first: после инвалидации запуск sync приводит к перезапросу', async () => {
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
    ).toBeFalsy();

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBeFalsy();

    store.sync();

    expect(
      store.isLoading,
      'ожидаем, что после последовательного вызова инвалидации и sync загрузка все таки началась',
    ).toBeTruthy();
  });

  it('invalidate:async:fetchPolicy=cache-first: После инвалидации вызов async приводит к перезапросу данных', async () => {
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
    ).toBeFalsy();

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBeFalsy();

    store.async();

    expect(
      store.isLoading,
      'ожидаем, что после последовательного вызова инвалидации и async загрузка все таки началась',
    ).toBeTruthy();
  });

  it('enabledAutoFetch:true:request:fail не происходит повторных запросов', async () => {
    const insideExecutor = vi.fn();
    const store = new Query(
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

  it('data-synchronization: Данные между двумя сторами синхронизируются, если они используют одно хранилище', async () => {
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

  it('async:fetchPolicy=network-only данные запрашиваются при каждом вызове', async () => {
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

    // запускаем сразу второй запрос, который по политике cache-first должен быть проигнорирован
    await store.async();

    expect(
      store.data,
      'ожидаем что новые данные после второго запроса так же попадут в стор',
    ).toBe(2);
  });

  it('sync:fetchPolicy=network-only данные запрашиваются при каждом вызове', async () => {
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

    // запускаем сразу второй запрос, который по политике cache-first должен быть проигнорирован
    store.sync();
    await when(() => !store.isLoading);

    expect(
      store.data,
      'ожидаем что новые данные после второго запроса так же попадут в стор',
    ).toBe(2);
  });

  it('forceUpdate, данные устанавливаются снаружи', () => {
    const onInsideExecutor = vi.fn();
    const store = new Query(
      () => {
        onInsideExecutor();

        return Promise.resolve('foo');
      },
      {
        dataStorage: getDataStorage(),
      },
    );

    store.forceUpdate('foo');
    expect(store.data, 'данные установились').toBe('foo');
  });

  it('forceUpdate, запрос не происходит', () => {
    const onInsideExecutor = vi.fn();
    const store = new Query(
      () => {
        onInsideExecutor();

        return Promise.resolve('foo');
      },
      {
        dataStorage: getDataStorage(),
      },
    );

    store.forceUpdate('foo');
    expect(onInsideExecutor, 'executor не вызывался').not.toBeCalled();
  });

  it('При вызове forceUpdate все стаусные флаги устанавливаются в success', () => {
    const onInsideExecutor = vi.fn();
    const store = new Query(
      () => {
        onInsideExecutor();

        return Promise.resolve('foo');
      },
      {
        dataStorage: getDataStorage(),
      },
    );

    store.forceUpdate('foo');
    expect(store.isSuccess).toBeTruthy();
    expect(store.isError).toBeFalsy();
  });
});
