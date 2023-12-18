import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { MobxQuery } from './MobxQuery';

const checkLoading = (items: { isLoading: boolean }[]) =>
  items.every((item) => item.isLoading === false);

describe('MobxQuery', () => {
  vi.useFakeTimers();

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

    expect(queryA === query).toBeFalsy();
  });

  it('Квери создаются те же самые, при одинаковом ключе', () => {
    const { mobxQuery, queryA } = createMobx();
    const query = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );

    expect(queryA === query).toBeTruthy();
  });

  it('Квери созданный с "cache-first" то же самый, что и без политики', () => {
    const { mobxQuery, queryA } = createMobx();
    const query = mobxQuery.createInfiniteQuery(
      ['foo'],
      () => Promise.resolve([]),
      { fetchPolicy: 'cache-first' },
    );

    expect(queryA === query).toBeTruthy();
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

    expect(queryB === queryC).toBeFalsy();
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

      expect(queryA === queryB).toBeTruthy();
    });

    it('Квери создаются разные, если создаются с паузой', async () => {
      const { mobxQuery } = createMobx();
      const queryA = mobxQuery.createInfiniteQuery(
        ['foo'],
        () => Promise.resolve([]),
        { fetchPolicy: 'network-only' },
      );

      // эмулируем завершение таймера на удаление квери
      await vi.advanceTimersToNextTimerAsync();

      const queryB = mobxQuery.createInfiniteQuery(
        ['foo'],
        () => Promise.resolve([]),
        { fetchPolicy: 'network-only' },
      );

      expect(queryA === queryB).toBeFalsy();
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
});
