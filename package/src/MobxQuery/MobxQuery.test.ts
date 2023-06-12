import { describe, expect, it } from 'vitest';
import { when } from 'mobx';

import { MobxQuery } from './MobxQuery';

const checkLoading = (items: { isLoading: boolean }[]) =>
  items.every((item) => item.isLoading === false);

describe('MobxQuery tests', () => {
  it('Проверяем создание сторов при работе с cacheFirst', async () => {
    const mobxQuery = new MobxQuery({ fetchPolicy: 'cacheFirst' });
    const objKey = ['foo', 'bar'];
    const queryA = mobxQuery.createInfiniteQuery([objKey, { foo: 'bar' }], () =>
      Promise.resolve([]),
    );
    const queryB = mobxQuery.createInfiniteQuery(['bar'], () =>
      Promise.resolve([]),
    );
    const queryC = mobxQuery.createInfiniteQuery(
      [['foo', 'bar'], { foo: 'bar' }],
      () => Promise.resolve([]),
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

  it('Проверяем работу инвалидации с простыми ключами', async () => {
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

    expect(
      queryAsc.data,
      'queryAsc проверяем что данных действительно нет',
    ).toBe(undefined);

    expect(
      queryDesc.data,
      'queryDesc проверяем что данных действительно нет',
    ).toBe(undefined);

    expect(
      queryUser.data,
      'queryUser проверяем что данных действительно нет',
    ).toBe(undefined);

    // запускаем запрос данных везде
    queryAsc.sync();
    queryDesc.sync();
    queryUser.sync();
    await when(() => checkLoading(queries));

    expect(
      queryAsc.data,
      'queryAsc проверяем что данные появились',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc проверяем что данные появились',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser проверяем что данные появились',
    ).toStrictEqual({ name: 'Ваня' });

    // запускаем инвалидацию по одной вариации ключа
    mobxQuery.invalidate(['user']);

    expect(
      queryAsc.data,
      'queryAsc дергаем дату у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc дергаем дату у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser дергаем дату у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual({ name: 'Ваня' });

    expect(
      queryAsc.isLoading,
      'queryAsc проверяем что загрузка началась только в сторе пользователя',
    ).toBe(false);

    expect(
      queryDesc.isLoading,
      'queryDesc проверяем что загрузка началась только в сторе пользователя',
    ).toBe(false);

    expect(
      queryUser.isLoading,
      'queryUser проверяем что загрузка началась только в сторе пользователя',
    ).toBe(true);

    await when(() => checkLoading(queries));
    // проверяем инвалидцию на другие 2 стора
    mobxQuery.invalidate(['foo']);

    expect(
      queryAsc.data,
      'queryAsc дергаем дату у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc дергаем дату у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser дергаем дату у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual({ name: 'Ваня' });

    expect(
      queryAsc.isLoading,
      'queryAsc проверяем что загрузка в двух с ключом foo',
    ).toBe(true);

    expect(
      queryDesc.isLoading,
      'queryDesc проверяем что загрузка в двух с ключом foo',
    ).toBe(true);

    expect(
      queryUser.isLoading,
      'queryUser проверяем что загрузка в двух с ключом foo',
    ).toBe(false);

    await when(() => checkLoading(queries));
    // проверяем инвалидцию по ключу второго уровня
    mobxQuery.invalidate([{ direction: 'asc' }]);

    expect(
      queryAsc.data,
      'queryAsc дергаем data у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc дергаем data у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser дергаем data у всех сторов, что бы тригернуть загрузку',
    ).toStrictEqual({ name: 'Ваня' });

    expect(
      queryAsc.isLoading,
      'queryAsc ожидаем что загрузка началась только в сторе с direction: "asc"',
    ).toBe(true);

    expect(
      queryDesc.isLoading,
      'queryDesc ожидаем что загрузка началась только в сторе с direction: "asc"',
    ).toBe(false);

    expect(
      queryUser.isLoading,
      'queryUser ожидаем что загрузка началась только в сторе с direction: "asc"',
    ).toBe(false);

    await when(() => checkLoading(queries));
    // проверяем инвалидацию для не активного стора
    mobxQuery.invalidate(['user']);

    expect(
      queryUser.isLoading,
      'пока не дернули data, загрузка не должна начинаться',
    ).toBe(false);

    expect(
      queryUser.data,
      'эмулируем чтение data, чтобы тригернуть загрузку',
    ).toStrictEqual({ name: 'Ваня' });

    expect(queryUser.isLoading, 'проверяем что загрузка началась').toBe(true);
  });

  it('Проверяем работу инвалидации со сложным ключом', async () => {
    const mobxQuery = new MobxQuery({ fetchPolicy: 'cacheFirst' });
    const query = mobxQuery.createCacheableQuery([['foo', 'bar']], () =>
      Promise.resolve('data'),
    );

    query.sync();
    await when(() => !query.isLoading);
    mobxQuery.invalidate(['foo']);
    expect(query.data, 'эмулируем чтение data').toBe('data');

    expect(
      query.isLoading,
      'т.к. ключ не верный, ожидаем что загрузка не началась',
    ).toBe(false);

    mobxQuery.invalidate([['foo', 'bar']]);

    expect(query.data, 'эмулируем чтение data, чтобы тригернуть загрузку').toBe(
      'data',
    );

    expect(query.isLoading, 'ожидаем что загрузка началась').toBe(true);
  });
});
