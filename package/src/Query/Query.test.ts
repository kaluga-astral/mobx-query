import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { DataStorage } from '../DataStorage';
import { StatusStorage } from '../StatusStorage';

import { Query } from './Query';

describe('Query', () => {
  const getDataStorage = <TData = unknown>() => new DataStorage<TData>();
  const getStatusStorage = () => new StatusStorage();

  describe('При начальном состоянии', () => {
    const query = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
      statusStorage: getStatusStorage(),
    });

    it('Флаг загрузки false', () => {
      expect(query.isLoading).toBeFalsy();
    });

    it('Флаг ошибки false', () => {
      expect(query.isError).toBeFalsy();
    });

    it('Флаг успеха false', () => {
      expect(query.isSuccess).toBeFalsy();
    });

    it('Флаг простаивания true', () => {
      expect(query.isIdle).toBeTruthy();
    });

    it('data undefined', () => {
      expect(query.data).toBeUndefined();
    });

    it('Данные ошибки undefined', () => {
      expect(query.error).toBeUndefined();
    });
  });

  it('Флаг простаивания false сразу после запуска запроса', () => {
    const query = new Query(() => Promise.resolve('foo'), {
      dataStorage: getDataStorage(),
      statusStorage: getStatusStorage(),
    });

    query.sync();
    expect(query.isIdle).toBeFalsy();
  });

  describe('При успешной загрузке', () => {
    const createQuery = () =>
      new Query(() => Promise.resolve('foo'), {
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
      });

    it('Данные ответа попадают в поле data', async () => {
      const query = createQuery();

      query.sync();
      await when(() => !query.isLoading);
      expect(query.data).toBe('foo');
    });

    it('Переданный onSuccess вызывается', async () => {
      const onSuccess = vi.fn();
      const query = createQuery();

      query.sync({ onSuccess });
      await when(() => !query.isLoading);
      expect(onSuccess).toBeCalledWith('foo');
    });

    it('Статусные флаги принимают изначальное состояние', async () => {
      const query = createQuery();

      await query.async();
      expect(query.isSuccess).toBeTruthy();
      expect(query.isError).toBeFalsy();
    });
  });

  describe('При провальном запросе', () => {
    it('Статусные флаги принимают соответсвующее значение', async () => {
      const query = new Query(() => Promise.reject('foo'), {
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
      });

      await query.async().catch((e) => e);
      expect(query.isSuccess).toBeFalsy();
      expect(query.isError).toBeTruthy();
    });

    it('Обработчик ошибки вызывается', async () => {
      const onError = vi.fn();
      const query = new Query(() => Promise.reject('foo'), {
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
      });

      query.sync({ onError });
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(query.error).toBe('foo');
      expect(onError).toBeCalledWith('foo');
    });

    it('Обработчик ошибки по умолчанию вызывается', async () => {
      const onDefaultError = vi.fn();
      const query = new Query(() => Promise.reject('foo'), {
        onError: onDefaultError,
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
      });

      query.sync();
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(query.error).toBe('foo');
      expect(onDefaultError).toBeCalledWith('foo');
    });

    it('Обработчик ошибки по умолчанию не вызывается при использовании async', async () => {
      const onDefaultError = vi.fn();
      const query = new Query(() => Promise.reject('foo'), {
        onError: onDefaultError,
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
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
      const query = new Query(() => Promise.reject('error'), {
        dataStorage: getDataStorage(),
        onError: onDefaultError,
        statusStorage: getStatusStorage(),
      });

      query.sync({ onError });
      await when(() => !query.isLoading);
      await when(() => query.error !== undefined);
      expect(onDefaultError).not.toBeCalledWith('error');
    });
  });

  describe('При использовании флага enabledAutoFetch', () => {
    it('Автоматический запрос данных при обращении к data', async () => {
      const query = new Query(() => Promise.resolve('foo'), {
        enabledAutoFetch: true,
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
      });

      // эмулируем обращение к data
      JSON.stringify(query.data);
      expect(query.isLoading).toBeTruthy();
    });

    it('Автоматический запрос данных не происходит при обращении к data и при enabledAutoFetch: false', async () => {
      const inExecutor = vi.fn();
      const query = new Query(
        () => {
          inExecutor();

          return Promise.resolve('foo');
        },
        {
          enabledAutoFetch: false,
          dataStorage: getDataStorage(),
          statusStorage: getStatusStorage(),
        },
      );

      // эмулируем обращение к data
      JSON.stringify(query.data);
      expect(inExecutor).not.toBeCalled();
    });

    it('Повторные обращения к data не приводят к повторным запросам, при фейле запроса', async () => {
      const insideExecutor = vi.fn();
      const store = new Query(
        () => {
          insideExecutor();

          return Promise.reject('foo');
        },
        {
          enabledAutoFetch: true,
          dataStorage: getDataStorage(),
          statusStorage: getStatusStorage(),
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

  describe('При использовании invalidate', () => {
    it('Считывание data приводит к перезапросу данных', async () => {
      const query = new Query(
        // executor эмулирует постоянно меняющиеся данные
        () => Promise.resolve(Math.random()),
        {
          dataStorage: getDataStorage(),
          enabledAutoFetch: true,
          statusStorage: getStatusStorage(),
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

    it('Вызов sync приводит к перезапросу данных', async () => {
      const query = new Query(() => Promise.resolve('foo'), {
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
      });

      // добавляем данные в квери
      query.sync();
      await when(() => !query.isLoading);
      query.invalidate();
      query.sync();
      expect(query.isLoading).toBeTruthy();
    });

    it('Вызов async приводит к перезапросу данных', async () => {
      const query = new Query(() => Promise.resolve('foo'), {
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
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

  it('Данные синхронизируются при использовании одного dataStorage', async () => {
    const unifiedDataStorage = getDataStorage();
    const unifiedStatusStorage = getStatusStorage();

    const queryA = new Query(() => Promise.resolve('foo'), {
      dataStorage: unifiedDataStorage,
      statusStorage: unifiedStatusStorage,
    });

    const queryB = new Query(() => Promise.resolve('bar'), {
      dataStorage: unifiedDataStorage,
      statusStorage: unifiedStatusStorage,
    });

    await queryA.async();
    expect(queryB.data).toBe('foo');
  });

  it('Статусы синхронизируются при использовании одного statusStorage', async () => {
    const unifiedDataStorage = getDataStorage();
    const unifiedStatusStorage = getStatusStorage();

    const queryA = new Query(() => Promise.resolve('foo'), {
      dataStorage: unifiedDataStorage,
      statusStorage: unifiedStatusStorage,
    });

    const queryB = new Query(() => Promise.resolve('bar'), {
      dataStorage: unifiedDataStorage,
      statusStorage: unifiedStatusStorage,
    });

    await queryA.async();
    expect(queryB.isSuccess).toBeTruthy();
  });

  it('Статусы не синхронизируются при использовании разных statusStorage', async () => {
    const unifiedDataStorage = getDataStorage();

    const queryA = new Query(() => Promise.resolve('foo'), {
      dataStorage: unifiedDataStorage,
      statusStorage: getStatusStorage(),
      backgroundStatusStorage: null,
    });

    const queryB = new Query(() => Promise.resolve('bar'), {
      dataStorage: unifiedDataStorage,
      statusStorage: getStatusStorage(),
      backgroundStatusStorage: null,
    });

    await queryA.async();
    expect(queryB.isSuccess).toBeFalsy();
  });

  describe('При использовании backgroundStatusStorage', () => {
    const buildQuery = () =>
      new Query<string, unknown, true>(() => Promise.resolve('foo'), {
        dataStorage: getDataStorage(),
        statusStorage: getStatusStorage(),
        backgroundStatusStorage: getStatusStorage(),
      });

    it('Статус isSuccess == true при успешном первом запросе', async () => {
      const query = buildQuery();

      await query.async();
      expect(query.isSuccess).toBeTruthy();
    });

    it('Статус isError == false при успешном первом запросе', async () => {
      const query = buildQuery();

      await query.async();
      expect(query.isError).toBeFalsy();
    });

    it('Статус error == undefined при успешном первом запросе', async () => {
      const query = buildQuery();

      await query.async();
      expect(query.error).toBeUndefined();
    });

    it('Статус isLoading == true при запуске первого запроса', async () => {
      const query = buildQuery();

      query.async();
      expect(query.isLoading).toBeTruthy();
    });

    it('Статус background.isSuccess == false при успешном первом запросе', async () => {
      const query = buildQuery();

      await query.async();
      expect(query.background.isSuccess).toBeFalsy();
    });

    it('Статус background.isError == false при успешном первом запросе', async () => {
      const query = buildQuery();

      await query.async();
      expect(query.background.isError).toBeFalsy();
    });

    it('Статус background.isLoading == false при старте первого запроса', async () => {
      const query = buildQuery();

      query.async();
      expect(query.background.isLoading).toBeFalsy();
    });

    it('Статус background.error == undefined при успешном первом запросе', async () => {
      const query = buildQuery();

      await query.async();
      expect(query.background.error).toBeUndefined();
    });

    it('Статус isLoading не изменяется при повторных запросах', async () => {
      const query = buildQuery();

      await query.async();
      query.invalidate();
      query.async();
      expect(query.isLoading).toBeFalsy();
    });

    it('Статус background.isLoading изменяется при повторных запросах', async () => {
      const query = buildQuery();

      await query.async();
      query.invalidate();
      query.async();
      expect(query.background.isLoading).toBeTruthy();
    });

    it('Статус background.isSuccess == true при повторном успешном запросе', async () => {
      const query = buildQuery();

      await query.async();
      query.invalidate();
      await query.async();
      expect(query.background.isSuccess).toBeTruthy();
    });

    const buildSuccessAndFailQuery = () => {
      let count = 0;

      return new Query<string, unknown, true>(
        () => {
          count++;

          if (count <= 1) {
            return Promise.resolve('foo');
          }

          return Promise.reject('bar');
        },
        {
          dataStorage: getDataStorage(),
          statusStorage: getStatusStorage(),
          backgroundStatusStorage: getStatusStorage(),
        },
      );
    };

    it('Статус isSuccess == true при первом успешном и последующих провальных запросах', async () => {
      const query = buildSuccessAndFailQuery();

      await query.async();
      query.invalidate();
      await query.async().catch(() => {});
      expect(query.isSuccess).toBeTruthy();
    });

    it('Статус isError == false при первом успешном и последующих провальных запросах', async () => {
      const query = buildSuccessAndFailQuery();

      await query.async();
      query.invalidate();
      await query.async().catch(() => {});
      expect(query.isError).toBeFalsy();
    });

    it('Статус error == undefined при первом успешном и последующих провальных запросах', async () => {
      const query = buildSuccessAndFailQuery();

      await query.async();
      query.invalidate();
      await query.async().catch(() => {});
      expect(query.error).toBeUndefined();
    });

    it('Статус background.isSuccess == false при первом успешном и последующих провальных запросах', async () => {
      const query = buildSuccessAndFailQuery();

      await query.async();
      query.invalidate();
      await query.async().catch(() => {});
      expect(query.background.isSuccess).toBeFalsy();
    });

    it('Статус background.isError == true при первом успешном и последующих провальных запросах', async () => {
      const query = buildSuccessAndFailQuery();

      await query.async();
      query.invalidate();
      await query.async().catch(() => {});
      expect(query.background.isError).toBeTruthy();
    });

    it('Статус background.error содержит ошибку при первом успешном и последующих провальных запросах', async () => {
      const query = buildSuccessAndFailQuery();

      await query.async();
      query.invalidate();
      await query.async().catch(() => {});
      expect(query.background.error).toBe('bar');
    });
  });

  describe('При использовании политики network-only', () => {
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
          statusStorage: getStatusStorage(),
          fetchPolicy: 'network-only',
        },
      );
    };

    it('Данные запрашиваются при каждом вызове async', async () => {
      const query = createQuery();

      await query.async();
      // ожидаем что данные после первого запроса попадут в квери как обычно
      expect(query.data).toBe(1);
      // запускаем сразу второй запрос, который по политике cache-first должен быть проигнорирован,
      // но т.к. мы используем networkOnly запрос все таки произойдет
      await query.async();
      expect(query.data).toBe(2);
    });

    it('Данные запрашиваются при каждом вызове sync', async () => {
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
  });

  describe('При использование forceUpdate', () => {
    const createQuery = () => {
      const onInsideExecutor = vi.fn();
      const query = new Query(
        () => {
          onInsideExecutor();

          return Promise.resolve('foo');
        },
        {
          dataStorage: getDataStorage(),
          statusStorage: getStatusStorage(),
        },
      );

      return { query, onInsideExecutor };
    };

    it('Данные устанавливаются снаружи', () => {
      const { query } = createQuery();

      query.forceUpdate('foo');
      expect(query.data).toBe('foo');
    });

    it('Запрос не происходит', () => {
      const { query, onInsideExecutor } = createQuery();

      query.forceUpdate('foo');
      expect(onInsideExecutor).not.toBeCalled();
    });

    it('Все статусные флаги устанавливаются в значение соответствующее успешному запросу', () => {
      const { query } = createQuery();

      query.forceUpdate('foo');
      expect(query.isSuccess).toBeTruthy();
      expect(query.isError).toBeFalsy();
    });
  });
});
