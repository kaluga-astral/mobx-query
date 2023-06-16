import { describe, expect, it } from 'vitest';
import { when } from 'mobx';

import { MobxQuery } from './MobxQuery';

const checkLoading = (items: { isLoading: boolean }[]) =>
  items.every((item) => item.isLoading === false);

describe('MobxQuery tests', () => {
  it('Проверяем создание сторов', async () => {
    const mobxQuery = new MobxQuery();
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

  it('Проверяем создание сторов с разными fetchPolicy, с одинаковым ключом', async () => {
    const mobxQuery = new MobxQuery();
    const queryA = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );
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

    const queryD = mobxQuery.createInfiniteQuery(
      ['foo'],
      () => Promise.resolve([]),
      { fetchPolicy: 'network-only' },
    );

    expect(
      queryA === queryB,
      'проверяем что инстантс квери без политики, это тот же инстанс с "cache-first"',
    ).toBe(true);

    expect(
      queryB === queryC,
      'при разных политиках, инстансы сторов должны быть разные',
    ).toBe(false);

    expect(
      queryC !== queryD,
      'два "network-only" квери с одним ключом, это два разных инстанса',
    ).toBe(true);
  });

  it('Проверяем работу инвалидации с простыми ключами', async () => {
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
      'queryAsc дергаем дату, что бы тригернуть загрузку',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc дергаем дату, что бы тригернуть загрузку',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser дергаем дату, что бы тригернуть загрузку',
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
      'queryAsc дергаем data, что бы тригернуть загрузку',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc дергаем data, что бы тригернуть загрузку',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser дергаем data, что бы тригернуть загрузку',
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
    const mobxQuery = new MobxQuery();
    const query = mobxQuery.createQuery([['foo', 'bar']], () =>
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
