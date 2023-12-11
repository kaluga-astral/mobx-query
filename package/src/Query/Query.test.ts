import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { DataStorage } from '../DataStorage';

import { Query } from './Query';

describe('Query', () => {
  const getDataStorage = () => new DataStorage();

  describe('Начальное состояние', () => {
    const query = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
    });

    it('флаг загрузки false', () => {
      expect(query.isLoading).toBeFalsy();
    });

    it('флаг ошибки false', () => {
      expect(query.isError).toBeFalsy();
    });

    it('флаг успеха false', () => {
      expect(query.isSuccess).toBeFalsy();
    });

    it('data undefined', () => {
      expect(query.data).toBeUndefined();
    });

    it('данные ошибки undefined', () => {
      expect(query.error).toBeUndefined();
    });
  });

  describe('успешная загрузка', () => {
    const createQuery = () =>
      new Query(() => Promise.resolve('foo'), {
        dataStorage: getDataStorage(),
      });

    it('данные ответа попадают в data', async () => {
      const query = createQuery();

      query.sync();
      await when(() => !query.isLoading);
      expect(query.data).toBe('foo');
    });

    it('вызывается переданный onSuccess', async () => {
      const onSuccess = vi.fn();
      const query = createQuery();

      query.sync({ onSuccess });
      await when(() => !query.isLoading);
      expect(onSuccess).toBeCalledWith('foo');
    });

    it('При успешном запросе устанавливаются соответствующие флаги', async () => {
      const query = createQuery();

      await query.async();
      expect(query.isSuccess).toBeTruthy();
      expect(query.isError).toBeFalsy();
    });
  });

  describe('обработка ошибок', () => {
    it('При провальном запросе устанавливаются соответствующие флаги', async () => {
      const query = new Query(() => Promise.reject('foo'), {
        dataStorage: getDataStorage(),
      });

      await query.async().catch((e) => e);
      expect(query.isSuccess).toBeFalsy();
      expect(query.isError).toBeTruthy();
    });

    it('Вызывается обработчик ошибки', async () => {
      const onError = vi.fn();
      const query = new Query(() => Promise.reject('foo'), {
        dataStorage: getDataStorage(),
      });

      query.sync({ onError });
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(query.error).toBe('foo');
      expect(onError).toBeCalledWith('foo');
    });

    it('вызывается обработчик ошибки по умолчанию', async () => {
      const onDefaultError = vi.fn();
      const query = new Query(() => Promise.reject('foo'), {
        onError: onDefaultError,
        dataStorage: getDataStorage(),
      });

      query.sync();
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(query.error).toBe('foo');
      expect(onDefaultError).toBeCalledWith('foo');
    });

    it('обработчик ошибки по умолчанию не вызывается при использовании async', async () => {
      const onDefaultError = vi.fn();
      const query = new Query(() => Promise.reject('foo'), {
        onError: onDefaultError,
        dataStorage: getDataStorage(),
      });

      await query.async().catch((e) => e);
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(query.error).toBe('foo');
      expect(onDefaultError).not.toBeCalled();
    });

    it('обработчик по умолчанию не вызывается, если в sync передан кастомный', async () => {
      const onError = vi.fn();
      const onDefaultError = vi.fn();
      const query = new Query(() => Promise.reject('error'), {
        dataStorage: getDataStorage(),
        onError: onDefaultError,
      });

      query.sync({ onError });
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(onDefaultError).not.toBeCalledWith('error');
    });
  });

  describe('enabledAutoFetch tests', () => {
    it('автоматический запрос данных при обращении к data', async () => {
      const query = new Query(() => Promise.resolve('foo'), {
        enabledAutoFetch: true,
        dataStorage: getDataStorage(),
      });

      // эмулируем обращение к data
      JSON.stringify(query.data);
      expect(query.isLoading).toBeTruthy();
    });

    it('при фейле запроса, повторные обращения к data не происходит повторных запросов', async () => {
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

      // эмулируем считывание данных
      JSON.stringify(store.data);
      await when(() => !store.isLoading);
      expect(insideExecutor).toBeCalled();
      // эмулируем считывание данных
      JSON.stringify(store.data);
      await when(() => !store.isLoading);
      // executor больше не вызывается
      expect(insideExecutor).toBeCalledTimes(1);
    });
  });

  describe('invalidate tests', () => {
    it('После инвалидации считывание data приводит к перезапросу данных', async () => {
      const query = new Query(
        // executor эмулирует постоянно меняющиеся данные
        () => Promise.resolve(Math.random()),
        {
          dataStorage: getDataStorage(),
          enabledAutoFetch: true,
        },
      );

      // эмулируем считывание данных
      JSON.stringify(query.data);
      //ожидаем, что после считывания данных загрузка началась
      expect(query.isLoading).toBeTruthy();
      await when(() => !query.isLoading);

      const firstValue = query.data;

      expect(typeof firstValue).toBe('number');
      query.invalidate();
      // эмулируем считывание данных
      JSON.stringify(query.data);
      await when(() => !query.isLoading);
      // ожидаем, что число изменилось
      expect(query.data !== firstValue).toBeTruthy();
    });

    it('после инвалидации запуск sync приводит к перезапросу', async () => {
      const query = new Query(() => Promise.resolve('foo'), {
        dataStorage: getDataStorage(),
      });

      // добавляем данные в квери
      query.sync();
      await when(() => !query.isLoading);
      query.invalidate();
      query.sync();
      expect(query.isLoading).toBeTruthy();
    });

    it('После инвалидации вызов async приводит к перезапросу данных', async () => {
      const query = new Query(() => Promise.resolve('foo'), {
        dataStorage: getDataStorage(),
      });

      // добавляем данные в квери
      await query.async();
      query.sync();
      // ожидаем что загрузка не началась, потому что инвалидация еще не была вызвана
      expect(query.isLoading).toBeFalsy();
      query.invalidate();
      // ожидаем, что загрузка не началась сама по себе
      expect(query.isLoading).toBeFalsy();
      query.async();
      // ожидаем, что после последовательного вызова инвалидации и async загрузка все таки началась
      expect(query.isLoading).toBeTruthy();
    });
  });

  describe('синхронизация данных через dataStorage', () => {
    const createQuery = () => {
      const unifiedDataStorage = getDataStorage();

      const queryA = new Query(() => Promise.resolve('foo'), {
        dataStorage: unifiedDataStorage,
      });

      const queryB = new Query(() => Promise.resolve('bar'), {
        dataStorage: unifiedDataStorage,
      });

      return { queryA, queryB };
    };

    it('ожидаем что в квери B попали данные, запрошенные в сторе A', async () => {
      const { queryA, queryB } = createQuery();

      await queryA.async();
      expect(queryB.data).toBe('foo');
    });

    it('ожидаем что в квери A попали данные, запрошенные в сторе B', async () => {
      const { queryA, queryB } = createQuery();

      await queryB.async();
      expect(queryA.data).toBe('bar');
    });
  });

  describe('network-only tests', () => {
    const createQuery = () => {
      // счетчик для эмуляции меняющихся данных
      let counter = 0;

      return new Query(
        () => {
          counter++;

          return Promise.resolve(counter);
        },
        {
          dataStorage: getDataStorage(),
          fetchPolicy: 'network-only',
        },
      );
    };

    it('данные запрашиваются при каждом вызове async', async () => {
      const query = createQuery();

      await query.async();
      // ожидаем что данные после первого запроса попадут в квери как обычно
      expect(query.data).toBe(1);
      // запускаем сразу второй запрос, который по политике cache-first должен быть проигнорирован,
      // но т.к. мы используем networkOnly запрос все таки произойдет
      await query.async();
      expect(query.data).toBe(2);
    });

    it('данные запрашиваются при каждом вызове sync', async () => {
      const query = createQuery();

      query.sync();
      await when(() => !query.isLoading);
      // ожидаем что данные после первого запроса попадут в квери как обычно
      expect(query.data).toBe(1);
      // запускаем сразу второй запрос, который по политике cache-first должен быть проигнорирован,
      // но т.к. мы используем networkOnly запрос все таки произойдет
      query.sync();
      await when(() => !query.isLoading);
      // ожидаем что новые данные после второго запроса так же попадут в квери
      expect(query.data).toBe(2);
    });

    it('флаги успеха и ошибки переключаются в соответствующее значение, в зависимости от ответа', async () => {
      // эмулируем меняющееся поведение запроса, четные запросы будут падать, нечетные завершаться успешно
      let counter = 0;
      const query = new Query(
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
      await query.async();
      expect([query.isSuccess, query.isError]).toStrictEqual([true, false]);
      // второй запрос зафейлится
      await query.async().catch((e) => e);
      expect([query.isSuccess, query.isError]).toStrictEqual([false, true]);
    });
  });

  describe('forceUpdate tests', () => {
    const createQuery = () => {
      const onInsideExecutor = vi.fn();
      const query = new Query(
        () => {
          onInsideExecutor();

          return Promise.resolve('foo');
        },
        {
          dataStorage: getDataStorage(),
        },
      );

      return { query, onInsideExecutor };
    };

    it('данные устанавливаются снаружи', () => {
      const { query } = createQuery();

      query.forceUpdate('foo');
      expect(query.data).toBe('foo');
    });

    it('запрос не происходит', () => {
      const { query, onInsideExecutor } = createQuery();

      query.forceUpdate('foo');
      expect(onInsideExecutor).not.toBeCalled();
    });

    it('все стаусные флаги устанавливаются в success', () => {
      const { query } = createQuery();

      query.forceUpdate('foo');
      expect(query.isSuccess).toBeTruthy();
      expect(query.isError).toBeFalsy();
    });
  });
});
