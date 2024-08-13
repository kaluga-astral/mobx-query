import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { MobxQuery } from './MobxQuery';

const checkLoading = (items: { isLoading: boolean }[]) =>
  items.every((item) => item.isLoading === false);

describe('MobxQuery', () => {
  vi.useFakeTimers({ toFake: ['Date'] });

  const createMobx = () => {
    const mobxQuery = new MobxQuery();
    const queryA = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );

    return { mobxQuery, queryA };
  };

  it('Квери создаются разные при разных ключах', () => {
    const { mobxQuery, queryA } = createMobx();
    const query = mobxQuery.createInfiniteQuery(
      [['foo', 'bar'], { foo: 'bar' }],
      () => Promise.resolve([]),
    );

    expect(queryA).not.toBe(query);
  });

  it('Квери создаются те же самые, при одинаковом ключе', () => {
    const { mobxQuery, queryA } = createMobx();
    const query = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );

    expect(queryA).toBe(query);
  });

  it('Квери создаются разные, при разных режимах isBackground и одинаковых ключах', () => {
    const { mobxQuery, queryA } = createMobx();
    const query = mobxQuery.createInfiniteQuery(
      ['foo'],
      () => Promise.resolve([]),
      { isBackground: true },
    );

    expect(queryA).not.toBe(query);
  });

  it('Квери созданный с "cache-first" то же самый, что и без политики', () => {
    const { mobxQuery, queryA } = createMobx();
    const query = mobxQuery.createInfiniteQuery(
      ['foo'],
      () => Promise.resolve([]),
      { fetchPolicy: 'cache-first' },
    );

    expect(queryA).toBe(query);
  });

  it('Квери создаются разные, при разных политиках и одинаковых ключах', () => {
    const mobxQuery = new MobxQuery();
    const queryB = mobxQuery.createInfiniteQuery(
      ['foo'],
      () => Promise.resolve([]),
      { fetchPolicy: 'cache-first' },
    );
    const queryC = mobxQuery.createInfiniteQuery(
      ['foo'],
      () => Promise.resolve([]),
      { fetchPolicy: 'network-only' },
    );

    expect(queryB).not.toBe(queryC);
  });

  describe('При fetchPolicy="network-only"', () => {
    it('Квери создаются те же самые, если создаются единомоментно', () => {
      const { mobxQuery } = createMobx();

      const queryA = mobxQuery.createInfiniteQuery(
        ['foo'],
        () => Promise.resolve([]),
        { fetchPolicy: 'network-only' },
      );

      const queryB = mobxQuery.createInfiniteQuery(
        ['foo'],
        () => Promise.resolve([]),
        { fetchPolicy: 'network-only' },
      );

      expect(queryA).toBe(queryB);
    });

    it('Квери создаются разные, если создаются с паузой', async () => {
      vi.setSystemTime('2022-02-10T00:00:00.000Z');

      const { mobxQuery } = createMobx();
      const queryA = mobxQuery.createInfiniteQuery(
        ['foo'],
        () => Promise.resolve([]),
        { fetchPolicy: 'network-only' },
      );

      // эмулируем ожидание
      vi.setSystemTime('2022-02-10T00:01:00.000Z');

      const queryB = mobxQuery.createInfiniteQuery(
        ['foo'],
        () => Promise.resolve([]),
        { fetchPolicy: 'network-only' },
      );

      expect(queryA).not.toBe(queryB);
    });

    it('Квери инвалидируется', async () => {
      const executorSpy = vi.fn();
      const { mobxQuery } = createMobx();
      const query = mobxQuery.createInfiniteQuery(
        ['foo'],
        () => {
          executorSpy();

          return Promise.resolve([]);
        },
        { fetchPolicy: 'network-only', enabledAutoFetch: true },
      );

      await query.async();
      mobxQuery.invalidate(['foo']);
      JSON.stringify(query.data);
      await when(() => !query.isLoading);
      expect(executorSpy).toBeCalledTimes(2);
    });
  });

  describe('При вызове инвалидации', async () => {
    const createQueries = async () => {
      const mobxQuery = new MobxQuery();
      const spyExecutorAsc = vi.fn();
      const queryAsc = mobxQuery.createInfiniteQuery(
        ['foo', { direction: 'asc' }],
        () => {
          spyExecutorAsc();

          return Promise.resolve(['foo', 'data']);
        },
      );

      const spyExecutorDesc = vi.fn();
      const queryDesc = mobxQuery.createInfiniteQuery(
        ['foo', { direction: 'desc' }],
        () => {
          spyExecutorDesc();

          return Promise.resolve(['data', 'foo']);
        },
      );

      const spyExecutorUser = vi.fn();
      const queryUser = mobxQuery.createQuery(['user'], () => {
        spyExecutorUser();

        return Promise.resolve({ name: 'Ваня' });
      });

      const queries = [queryAsc, queryDesc, queryUser];

      // запускаем запрос данных везде
      queryAsc.sync();
      queryDesc.sync();
      queryUser.sync();
      await when(() => checkLoading(queries));

      return {
        queryAsc,
        queryDesc,
        queryUser,
        mobxQuery,
        spyExecutorAsc,
        spyExecutorDesc,
        spyExecutorUser,
      };
    };

    it('Запрос инвалидации запускается для простого ключа', async () => {
      const {
        queryAsc,
        queryDesc,
        queryUser,
        mobxQuery,
        spyExecutorAsc,
        spyExecutorDesc,
        spyExecutorUser,
      } = await createQueries();

      mobxQuery.invalidate(['user']);
      // дергаем дату у всех сторов, чтобы тригернуть загрузку
      JSON.stringify([queryAsc.data, queryDesc.data, queryUser.data]);
      // проверяем что загрузка началась только в сторе пользователя
      expect(spyExecutorAsc).toBeCalledTimes(1);
      expect(spyExecutorDesc).toBeCalledTimes(1);
      expect(spyExecutorUser).toBeCalledTimes(2);
    });

    it('Запрос инвалидации запускается для сложного ключа', async () => {
      const {
        queryAsc,
        queryDesc,
        queryUser,
        mobxQuery,
        spyExecutorAsc,
        spyExecutorDesc,
        spyExecutorUser,
      } = await createQueries();

      mobxQuery.invalidate([{ direction: 'asc' }]);
      // дергаем дату у всех сторов, чтобы тригернуть загрузку
      JSON.stringify([queryAsc.data, queryDesc.data, queryUser.data]);
      // ожидаем что загрузка началась только в сторе с direction: "asc"
      expect(spyExecutorAsc).toBeCalledTimes(2);
      expect(spyExecutorDesc).toBeCalledTimes(1);
      expect(spyExecutorUser).toBeCalledTimes(1);
    });

    it('Запрос инвалидации для неактивного стора не запускается, пока мы не обратимся к данным', async () => {
      const { queryUser, mobxQuery, spyExecutorUser } = await createQueries();

      mobxQuery.invalidate(['user']);
      expect(spyExecutorUser).toBeCalledTimes(1);
      // дергаем дату, чтобы тригернуть загрузку
      JSON.stringify(queryUser.data);
      //  проверяем что загрузка началась,
      expect(spyExecutorUser).toBeCalledTimes(2);
    });
  });

  describe('При инвалидации для сложносоставного ключа', async () => {
    const createQuery = async () => {
      const mobxQuery = new MobxQuery();
      const spyExecutor = vi.fn();
      const query = mobxQuery.createQuery([['foo', 'bar']], () => {
        spyExecutor();

        return Promise.resolve('data');
      });

      query.sync();
      await when(() => !query.isLoading);

      return { query, mobxQuery, spyExecutor };
    };

    it('Запрос не начался, если ключ не подходящий', async () => {
      const { query, mobxQuery, spyExecutor } = await createQuery();

      mobxQuery.invalidate(['foo']);
      // эмулируем чтение data
      JSON.stringify(query.data);
      expect(spyExecutor).toBeCalledTimes(1);
    });

    it('Запрос начался, если ключ верный', async () => {
      const { query, mobxQuery, spyExecutor } = await createQuery();

      mobxQuery.invalidate([['foo', 'bar']]);
      // эмулируем чтение data, чтобы тригернуть загрузку
      JSON.stringify(query.data);
      expect(spyExecutor).toBeCalledTimes(2);
    });
  });

  it('invalidateQueries вызывает инвалидацию сразу всех квери', async () => {
    const mobxQuery = new MobxQuery();
    const spyExecutor = vi.fn();
    const queryFoo = mobxQuery.createQuery([['foo']], () => {
      spyExecutor();

      return Promise.resolve('data');
    });

    const queryBar = mobxQuery.createQuery([['bar']], () => {
      spyExecutor();

      return Promise.resolve('data');
    });

    // добавляем данные
    await queryFoo.async();
    await queryBar.async();
    //запускаем массовую инвалидацию
    mobxQuery.invalidateQueries();
    // снова запускаем загрузку в обоих квери
    await queryFoo.async();
    await queryBar.async();
    expect(spyExecutor).toBeCalledTimes(4);
  });

  it('Автозапрос данных вызывается при enabledAutoFetch=true для всего сервиса', async () => {
    const mobxQuery = new MobxQuery({ enabledAutoFetch: true });

    const query = mobxQuery.createQuery([['foo']], () => {
      return Promise.resolve('data');
    });

    // эмулируем обращение к data
    JSON.stringify(query.data);
    expect(query.isLoading).toBeTruthy();
  });

  it('Автозапрос данных не вызывается при enabledAutoFetch=false в фабричном методе и при enabledAutoFetch=true для всего сервиса', async () => {
    const mobxQuery = new MobxQuery({ enabledAutoFetch: true });

    const query = mobxQuery.createQuery(
      [['foo']],
      () => Promise.resolve('data'),
      {
        enabledAutoFetch: false,
      },
    );

    // эмулируем обращение к data
    JSON.stringify(query.data);
    expect(query.isLoading).toBeFalsy();
  });

  it('Создаваемый квери по умолчанию не использует background', () => {
    const mobxQuery = new MobxQuery();

    const query = mobxQuery.createQuery([['foo']], () =>
      Promise.resolve('foo'),
    );

    expect(query.background).toBeNull();
  });

  it('Создаваемый квери использует background при передаче флага isBackground:true', () => {
    const mobxQuery = new MobxQuery();

    const query = mobxQuery.createQuery(
      [['foo']],
      () => Promise.resolve('foo'),
      { isBackground: true },
    );

    expect(query.background).not.toBeNull();
  });
});
