import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { MobxQuery } from './MobxQuery';

const checkLoading = (items: { isLoading: boolean }[]) =>
  items.every((item) => item.isLoading === false);

describe('MobxQuery', () => {
  vi.useFakeTimers();

  describe('Логика создания квери по ключам', () => {
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
      const { mobxQuery } = createMobx();
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
  });

  describe('Cоздание network-only сторов', () => {
    const createMobx = () => ({ mobxQuery: new MobxQuery() });

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

  describe('Инвалидации с простыми ключами', async () => {
    const createQueries = async () => {
      const mobxQuery = new MobxQuery();
      const queryAsc = mobxQuery.createInfiniteQuery(
        ['foo', { direction: 'asc' }],
        () => Promise.resolve(['foo', 'data']),
      );
      const queryDesc = mobxQuery.createInfiniteQuery(
        ['foo', { direction: 'desc' }],
        () => Promise.resolve(['data', 'foo']),
      );

      const queryUser = mobxQuery.createQuery(['user'], () =>
        Promise.resolve({ name: 'Ваня' }),
      );

      const queries = [queryAsc, queryDesc, queryUser];

      // запускаем запрос данных везде
      queryAsc.sync();
      queryDesc.sync();
      queryUser.sync();
      await when(() => checkLoading(queries));

      return { queryAsc, queryDesc, queryUser, mobxQuery };
    };

    it('Запрос инвалидации запускается для простого ключа', async () => {
      const { queryAsc, queryDesc, queryUser, mobxQuery } =
        await createQueries();

      mobxQuery.invalidate(['user']);
      // дергаем дату у всех сторов, чтобы тригернуть загрузку
      JSON.stringify([queryAsc.data, queryDesc.data, queryUser.data]);

      // проверяем что загрузка началась только в сторе пользователя
      expect([
        queryAsc.isLoading,
        queryDesc.isLoading,
        queryUser.isLoading,
      ]).toStrictEqual([false, false, true]);
    });

    it('Запрос инвалидации запускается для сложного ключа', async () => {
      const { queryAsc, queryDesc, queryUser, mobxQuery } =
        await createQueries();

      mobxQuery.invalidate([{ direction: 'asc' }]);
      // дергаем дату у всех сторов, чтобы тригернуть загрузку
      JSON.stringify([queryAsc.data, queryDesc.data, queryUser.data]);

      // ожидаем что загрузка началась только в сторе с direction: "asc"
      expect([
        queryAsc.isLoading,
        queryDesc.isLoading,
        queryUser.isLoading,
      ]).toStrictEqual([true, false, false]);
    });

    it('Запрос инвалидации для неактивного стора не запускается, пока мы не обратимся к данным', async () => {
      const { queryUser, mobxQuery } = await createQueries();

      mobxQuery.invalidate(['user']);
      expect(queryUser.isLoading).toBeFalsy();
      // дергаем дату, чтобы тригернуть загрузку
      JSON.stringify(queryUser.data);
      //  проверяем что загрузка началась,
      expect(queryUser.isLoading).toBeTruthy();
    });
  });

  describe('Инвалидация для сложносоставного ключа', async () => {
    const createQuery = async () => {
      const mobxQuery = new MobxQuery();
      const query = mobxQuery.createQuery([['foo', 'bar']], () =>
        Promise.resolve('data'),
      );

      query.sync();
      await when(() => !query.isLoading);

      return { query, mobxQuery };
    };

    it('Запрос не начался, если ключ не верный', async () => {
      const { query, mobxQuery } = await createQuery();

      mobxQuery.invalidate(['foo']);
      // эмулируем чтение data
      JSON.stringify(query.data);
      expect(query.isLoading).toBeFalsy();
    });

    it('Запрос начался, если ключ верный,', async () => {
      const { query, mobxQuery } = await createQuery();

      mobxQuery.invalidate([['foo', 'bar']]);
      // эмулируем чтение data, чтобы тригернуть загрузку
      JSON.stringify(query.data);
      expect(query.isLoading).toBeTruthy();
    });
  });

  it('invalidateQueries вызывает инвалидацию сразу всех квери', async () => {
    const mobxQuery = new MobxQuery();
    const onLoad = vi.fn();
    const queryFoo = mobxQuery.createQuery([['foo']], () => {
      onLoad();

      return Promise.resolve('data');
    });

    const queryBar = mobxQuery.createQuery([['bar']], () => {
      onLoad();

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
    expect(onLoad).toBeCalledTimes(4);
  });
});
