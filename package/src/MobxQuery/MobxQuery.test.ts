import { describe, expect, it } from 'vitest';
import { when } from 'mobx';

import { MobxQuery } from './MobxQuery';

const checkLoading = (items: { isLoading: boolean }[]) =>
  items.every((item) => item.isLoading === false);

describe('MobxQuery tests', () => {
  it('Проверяем создание сторов при работе с cacheFirst', async () => {
    const mobxQuery = new MobxQuery({ fetchPolicy: 'cacheFirst' });
    const queryA = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );
    const queryB = mobxQuery.createInfiniteQuery(['bar'], () =>
      Promise.resolve([]),
    );
    const queryC = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );

    expect(queryA === queryB, 'при разных ключах, квери разные').toBe(false);

    expect(queryA === queryC, 'при одинаковом ключе, квери тот же самый').toBe(
      true,
    );
  });

  it('Проверяем создание сторов при работе с networkOnly', async () => {
    const mobxQuery = new MobxQuery({ fetchPolicy: 'networkOnly' });
    const queryA = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );
    const queryB = mobxQuery.createInfiniteQuery(['bar'], () =>
      Promise.resolve([]),
    );
    const queryC = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );

    expect(queryA === queryB, 'при разных ключах, квери разные').toBe(false);

    expect(queryA === queryC, 'при одинаковых ключах, квери разные').toBe(
      false,
    );
  });

  it('Проверяем создание сторов при работе с cacheFirst и networkOnly', async () => {
    const mobxQuery = new MobxQuery({ fetchPolicy: 'cacheFirst' });
    const queryA = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );
    const queryB = mobxQuery.createInfiniteQuery(
      ['foo'],
      () => Promise.resolve([]),
      {
        fetchPolicy: 'networkOnly',
      },
    );

    expect(queryA === queryB, 'при одинаковом ключе, квери разные').toBe(false);

    const query = mobxQuery.createInfiniteQuery(
      ['foo'],
      () => Promise.resolve([]),
      {
        fetchPolicy: 'cacheFirst',
      },
    );

    expect(
      queryB === query,
      'cacheFirst квери, использующий тот же ключ, что и networkOnly квери до него, является тем же инстансом',
    ).toBe(true);
  });

  it('Проверяем работу инвалидации ', async () => {
    const mobxQuery = new MobxQuery({ fetchPolicy: 'cacheFirst' });
    const queryAsc = mobxQuery.createInfiniteQuery(
      ['foo', { direction: 'asc' }],
      () => Promise.resolve(['foo', 'data']),
    );
    const queryDesc = mobxQuery.createInfiniteQuery(
      ['foo', { direction: 'desc' }],
      () => Promise.resolve(['data', 'foo']),
    );

    const queryUser = mobxQuery.createCacheableQuery(['user'], () =>
      Promise.resolve({ name: 'Ваня' }),
    );

    const queries = [queryAsc, queryDesc, queryUser];

    // проверяем что данных действительно нет
    expect(queryAsc.data).toBe(undefined);
    expect(queryDesc.data).toBe(undefined);
    expect(queryUser.data).toBe(undefined);
    // запускаем запрос данных везде
    queryAsc.sync();
    queryDesc.sync();
    queryUser.sync();
    await when(() => checkLoading(queries));
    // проверяем что данные попали в стор
    expect(queryAsc.data).toStrictEqual(['foo', 'data']);
    expect(queryDesc.data).toStrictEqual(['data', 'foo']);
    expect(queryUser.data).toStrictEqual({ name: 'Ваня' });
    // запускаем инвалидацию по одной вариации ключа
    mobxQuery.invalidate(['user']);
    // дергаем дату у всех сторов, что бы тригернуть загрузку
    expect(queryAsc.data).toStrictEqual(['foo', 'data']);
    expect(queryDesc.data).toStrictEqual(['data', 'foo']);
    expect(queryUser.data).toStrictEqual({ name: 'Ваня' });
    // проверяем что загрузка началась только в сторе пользователя
    expect(queryAsc.isLoading).toBe(false);
    expect(queryDesc.isLoading).toBe(false);
    expect(queryUser.isLoading).toBe(true);
    await when(() => checkLoading(queries));
    // проверяем инвалидцию на другие 2 стора
    mobxQuery.invalidate(['foo']);
    // дергаем дату у всех сторов, что бы тригернуть загрузку
    expect(queryAsc.data).toStrictEqual(['foo', 'data']);
    expect(queryDesc.data).toStrictEqual(['data', 'foo']);
    expect(queryUser.data).toStrictEqual({ name: 'Ваня' });
    // проверяем что загрузка в двух с ключом foo
    expect(queryAsc.isLoading).toBe(true);
    expect(queryDesc.isLoading).toBe(true);
    expect(queryUser.isLoading).toBe(false);
    await when(() => checkLoading(queries));
    // проверяем инвалидцию по ключу второго уровня
    mobxQuery.invalidate([{ direction: 'asc' }]);
    // дергаем дату у всех сторов, что бы тригернуть загрузку
    expect(queryAsc.data).toStrictEqual(['foo', 'data']);
    expect(queryDesc.data).toStrictEqual(['data', 'foo']);
    expect(queryUser.data).toStrictEqual({ name: 'Ваня' });
    // проверяем что загрузка началась только в сторе с direction: 'asc'
    expect(queryAsc.isLoading).toBe(true);
    expect(queryDesc.isLoading).toBe(false);
    expect(queryUser.isLoading).toBe(false);
    await when(() => checkLoading(queries));
    // проверяем инвалидацию для не активного стора
    mobxQuery.invalidate(['user']);
    // пока не дернули дату, загрузка не должна начинаться
    expect(queryUser.isLoading).toBe(false);
    // дергаем дату, чтобы тригернуть загрузку
    expect(queryUser.data).toStrictEqual({ name: 'Ваня' });
    // проверяем что загрузка началась
    expect(queryUser.isLoading).toBe(true);
  });
});
