import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { DataStorage } from '../DataStorage';

import { InfiniteQuery } from './InfiniteQuery';

describe('InfiniteQuery', () => {
  const getDataStorage = <T = unknown[]>() => new DataStorage<T>();

  describe('При начальном состоянии', () => {
    const query = new InfiniteQuery(() => Promise.resolve(['foo']), {
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

  describe('При успешной загрузке', () => {
    const createQuery = () =>
      new InfiniteQuery(() => Promise.resolve(['foo']), {
        dataStorage: getDataStorage(),
      });

    it('Данные ответа попадают в data', async () => {
      const query = createQuery();

      query.sync();
      await when(() => !query.isLoading);
      expect(query.data).toStrictEqual(['foo']);
    });

    it('onSuccess вызывается', async () => {
      const onSuccess = vi.fn();
      const query = createQuery();

      query.sync({ onSuccess });
      await when(() => !query.isLoading);
      expect(onSuccess).toBeCalledWith(['foo']);
    });

    it('Флаги состояний устанавливаются в соответствующее состояние', async () => {
      const query = createQuery();

      await query.async();
      expect(query.isSuccess).toBeTruthy();
      expect(query.isError).toBeFalsy();
    });
  });

  describe('При провальном запросе', () => {
    it('Флаг ошибки устанавливается', async () => {
      const query = new InfiniteQuery(() => Promise.reject('error'), {
        dataStorage: getDataStorage(),
      });

      query.sync();
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(query.isError).toBeTruthy();
    });

    it('Значение ошибки попадает в поле error', async () => {
      const query = new InfiniteQuery(() => Promise.reject('error'), {
        dataStorage: getDataStorage(),
      });

      query.sync();
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(query.error).toBe('error');
    });

    it('Обработчик ошибки вызывается', async () => {
      const onError = vi.fn();
      const query = new InfiniteQuery(() => Promise.reject('error'), {
        dataStorage: getDataStorage(),
      });

      query.sync({ onError });
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(onError).toBeCalledWith('error');
    });

    it('Обработчик ошибки по умолчанию вызывается', async () => {
      const onDefaultError = vi.fn();
      const query = new InfiniteQuery(() => Promise.reject('error'), {
        dataStorage: getDataStorage(),
        onError: onDefaultError,
      });

      query.sync();
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(onDefaultError).toBeCalledWith('error');
    });

    it('Обработчик ошибки по умолчанию не вызывается при использовании async', async () => {
      const onDefaultError = vi.fn();
      const query = new InfiniteQuery(() => Promise.reject('foo'), {
        onError: onDefaultError,
        dataStorage: getDataStorage(),
      });

      await query.async().catch((e) => e);
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(query.error).toBe('foo');
      expect(onDefaultError).not.toBeCalled();
    });

    it('Обработчик по умолчанию не вызывается, если в sync передан кастомный', async () => {
      const onError = vi.fn();
      const onDefaultError = vi.fn();
      const query = new InfiniteQuery(() => Promise.reject('error'), {
        dataStorage: getDataStorage(),
        onError: onDefaultError,
      });

      query.sync({ onError });
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(onDefaultError).not.toBeCalledWith('error');
    });
  });

  describe('При инвалидации', () => {
    it('sync запускает загрузку после invalidate', async () => {
      const query = new InfiniteQuery(
        // executor эмулирует постоянно меняющиеся данные
        () => Promise.resolve([Math.random()]),
        {
          dataStorage: getDataStorage(),
        },
      );

      query.sync();
      await when(() => !query.isLoading);

      const [firstValue] = query.data!;

      query.invalidate();
      query.sync();
      await when(() => !query.isLoading);

      const [secondValue] = query.data!;

      // ожидаем, что число изменилось
      expect(secondValue !== firstValue).toBeTruthy();
    });

    it('async запускает загрузку после invalidate', async () => {
      const query = new InfiniteQuery(
        // executor эмулирует постоянно меняющиеся данные
        () => Promise.resolve([Math.random()]),
        {
          dataStorage: getDataStorage(),
        },
      );

      const [firstValue] = await query.async();

      query.invalidate();
      await query.async();
      await when(() => !query.isLoading);

      const [secondValue] = query.data!;

      // ожидаем, что число изменилось
      expect(secondValue !== firstValue).toBeTruthy();
    });

    it('Обращение к data запускает загрузку после invalidate, если enabledAutoFetch включен', async () => {
      const query = new InfiniteQuery(
        // executor эмулирует постоянно меняющиеся данные
        () => Promise.resolve([Math.random()]),
        {
          dataStorage: getDataStorage(),
          enabledAutoFetch: true,
        },
      );

      // эмулируем считывание данных чтобы тригернуть загрузку
      JSON.stringify(query.data);
      await when(() => !query.isLoading);

      const [firstValue] = query.data!;

      query.invalidate();
      // эмулируем считывание данных чтобы тригернуть загрузку
      JSON.stringify(query.data);
      await when(() => !query.isLoading);

      const [secondValue] = query.data!;

      // ожидаем, что число изменилось
      expect(secondValue !== firstValue).toBeTruthy();
    });
  });

  describe('При включенном enabledAutoFetch', () => {
    it('Автоматический запрос данных при обращении к data', async () => {
      const query = new InfiniteQuery(() => Promise.resolve(['foo']), {
        enabledAutoFetch: true,
        dataStorage: getDataStorage(),
      });

      // эмулируем считывание данных
      JSON.stringify(query.data);
      expect(query.isLoading).toBeTruthy();
    });

    it('Повторные обращения к data не запускают повторных запросов, при фейле запроса', async () => {
      const insideExecutor = vi.fn();
      const query = new InfiniteQuery(
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
      JSON.stringify(query.data);
      await when(() => !query.isLoading);
      // эмулируем повторное считывание данных
      JSON.stringify(query.data);
      await when(() => !query.isLoading);
      expect(insideExecutor).toBeCalledTimes(1);
    });
  });

  describe('При использовании infinite специфик', () => {
    const createQuery = () => {
      const insideExecutor = vi.fn();

      const query = new InfiniteQuery(
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

      return { query, insideExecutor };
    };

    it('Данные конкатенируются', async () => {
      const { query } = createQuery();

      await query.async();
      // запускаем fetchMore метод
      query.fetchMore();
      await when(() => !query.isLoading);
      expect(query.data).toStrictEqual(['foo', 'foo']);
    });

    it('executor вызывается со счетчиками соответствующими количеству вызова fetchMore + первый sync/async', async () => {
      const { query, insideExecutor } = createQuery();

      await query.async();
      expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 0, count: 1 });
      query.fetchMore();
      await when(() => !query.isLoading);
      expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 1, count: 1 });
    });

    it('Флаг достижения окончания списка актуализируется в зависимости от ответа', async () => {
      const { query } = createQuery();

      await query.async();
      query.fetchMore();
      await when(() => !query.isLoading);
      // ожидаем, что бэк отдал ожидаемое количество данных, следовательно, мы еще не достигли конца списка
      expect(query.isEndReached).toBeFalsy();
      query.fetchMore();
      await when(() => !query.isLoading);
      // ожидаем, что бэк отдал пустой массив, следовательно, мы достигли конца списка
      expect(query.isEndReached).toBeTruthy();
    });

    it('Последующие вызовы fetchMore игнорируются, при достижении окончания списка', async () => {
      const { query, insideExecutor } = createQuery();

      await query.async();
      query.fetchMore();
      await when(() => !query.isLoading);
      query.fetchMore();
      await when(() => !query.isLoading);
      // вызываем дополнительный fetchMore, который должен быть проигнорирован
      query.fetchMore();
      await when(() => !query.isLoading);
      expect(insideExecutor).toBeCalledTimes(3);
    });

    it('Флаг окончания списка сбрасывается в соответствии с ответом от бэка, по достижению окончанию списка и последующей инвалидации', async () => {
      const { query } = createQuery();

      await query.async();
      query.fetchMore();
      await when(() => !query.isLoading);
      query.fetchMore();
      await when(() => !query.isLoading);
      query.invalidate();
      query.sync();
      await when(() => !query.isLoading);
      expect(query.isEndReached).toBeFalsy();
    });

    it('Вызов sync/async приведет к вызову executor c начальными счетчиками, после вызова инвалидации', async () => {
      const { query, insideExecutor } = createQuery();

      await query.async();
      query.fetchMore();
      await when(() => !query.isLoading);
      query.invalidate();
      query.sync();
      await when(() => !query.isLoading);
      expect(insideExecutor).toBeCalledWith({ offset: 0, count: 1 });
    });

    it('isEndReached сбрасывается при каждом ручном запросе', async () => {
      const query = new InfiniteQuery(
        // предположим что у бэка есть только 1 элемент, хотя мы запрашиваем 2
        () => Promise.resolve(['foo']),
        {
          incrementCount: 2,
          dataStorage: getDataStorage(),
        },
      );

      await query.async();
      query.invalidate();
      query.sync();
      // не дожидаясь окончания запроса, ожидаем, что флаг окончания списка выключен
      expect(query.isEndReached).toBeFalsy();
    });
  });

  it('Данные синхронизируются при использовании одного dataStorage', async () => {
    const unifiedDataStorage = getDataStorage();

    const queryA = new InfiniteQuery(() => Promise.resolve(['foo']), {
      dataStorage: unifiedDataStorage,
    });

    const queryB = new InfiniteQuery(() => Promise.resolve(['bar']), {
      dataStorage: unifiedDataStorage,
    });

    await queryA.async();
    expect(queryB.data).toStrictEqual(['foo']);
    await queryB.async();
    expect(queryA.data).toStrictEqual(['bar']);
  });

  describe('При политике network-only', () => {
    const createQuery = () => {
      // счетчик для эмуляции меняющихся данных
      let counter = 0;

      return new InfiniteQuery(
        () => {
          counter++;

          return Promise.resolve([counter]);
        },
        {
          dataStorage: getDataStorage(),
          fetchPolicy: 'network-only',
        },
      );
    };

    it('Данные запрашиваются при каждом вызове async', async () => {
      const query = createQuery();

      await query.async();
      // ожидаем что данные после первого запроса попадут в квери как обычно
      expect(query.data).toStrictEqual([1]);
      // запускаем сразу второй запрос, который по политике cache-first должен быть проигнорирован,
      // но т.к. мы используем networkOnly запрос все таки произойдет
      await query.async();
      expect(query.data).toStrictEqual([2]);
    });

    it('Данные запрашиваются при каждом вызове sync', async () => {
      const query = createQuery();

      query.sync();
      await when(() => !query.isLoading);
      // ожидаем что данные после первого запроса попадут в квери как обычно
      expect(query.data).toStrictEqual([1]);
      // запускаем сразу второй запрос, который по политике cache-first должен быть проигнорирован,
      // но т.к. мы используем networkOnly запрос все таки произойдет
      query.sync();
      await when(() => !query.isLoading);
      // ожидаем что новые данные после второго запроса так же попадут в квери
      expect(query.data).toStrictEqual([2]);
    });
  });

  describe('При использование forceUpdate', () => {
    const createQuery = () => {
      const onInsideExecutor = vi.fn();
      const query = new InfiniteQuery(
        () => {
          onInsideExecutor();

          return Promise.resolve(['foo']);
        },
        {
          dataStorage: getDataStorage(),
        },
      );

      return { query, onInsideExecutor };
    };

    it('Данные устанавливаются снаружи', () => {
      const { query } = createQuery();

      query.forceUpdate(['foo']);
      expect(query.data).toStrictEqual(['foo']);
    });

    it('Запрос не происходит', () => {
      const { query, onInsideExecutor } = createQuery();

      query.forceUpdate(['foo']);
      expect(onInsideExecutor).not.toBeCalled();
    });

    it('Все статусные флаги устанавливаются в значение соответствующее успешному запросу', () => {
      const { query } = createQuery();

      query.forceUpdate(['foo']);
      expect(query.isSuccess).toBeTruthy();
      expect(query.isError).toBeFalsy();
    });
  });
});
