// TODO: отрефакторить тест-кейсы в соответствии с Unit Testing Guide: https://track.astral.ru/soft/browse/UIKIT-1081
/* eslint-disable vitest/valid-expect */
/* eslint-disable vitest/max-expects */

import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { MobxQuery } from './MobxQuery';

const checkLoading = (items: { isLoading: boolean }[]) =>
  items.every((item) => item.isLoading === false);

describe('MobxQuery', () => {
  vi.useFakeTimers();

  it('Сторы с разными ключами отличаются, с одинаковыми совпадают', async () => {
    const mobxQuery = new MobxQuery();
    const queryA = mobxQuery.createInfiniteQuery(
      [['foo', 'bar'], { foo: 'bar' }],
      () => Promise.resolve([]),
    );
    const queryB = mobxQuery.createInfiniteQuery(['bar'], () =>
      Promise.resolve([]),
    );
    const queryC = mobxQuery.createInfiniteQuery(
      [['foo', 'bar'], { foo: 'bar' }],
      () => Promise.resolve([]),
    );

    expect(queryA === queryB, 'при разных ключах, квери разные').toBeFalsy();

    expect(
      queryA === queryC,
      'при одинаковом ключе, квери тот же самый',
    ).toBeTruthy();
  });

  it('Сторы с разными fetchPolicy и с одинаковым ключом отличаются', async () => {
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

    expect(
      queryA === queryB,
      'проверяем что инстантс квери без политики, это тот же инстанс с "cache-first"',
    ).toBeTruthy();

    expect(
      queryB === queryC,
      'при разных политиках, инстансы сторов должны быть разные',
    ).toBeFalsy();
  });

  it('network-only:одинаковые ключи: сторы созданные единомоментно одинаковы', () => {
    const mobxQuery = new MobxQuery();
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

  it('network-only:одинаковые ключи: сторы созданные c паузой разные', async () => {
    const mobxQuery = new MobxQuery();
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

  it('Инвалидация с простыми ключами', async () => {
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
      'queryAsc дергаем дату у всех сторов, чтобы тригернуть загрузку',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc дергаем дату у всех сторов, чтобы тригернуть загрузку',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser дергаем дату у всех сторов, чтобы тригернуть загрузку',
    ).toStrictEqual({ name: 'Ваня' });

    expect(
      queryAsc.isLoading,
      'queryAsc проверяем что загрузка началась только в сторе пользователя',
    ).toBeFalsy();

    expect(
      queryDesc.isLoading,
      'queryDesc проверяем что загрузка началась только в сторе пользователя',
    ).toBeFalsy();

    expect(
      queryUser.isLoading,
      'queryUser проверяем что загрузка началась только в сторе пользователя',
    ).toBeTruthy();

    await when(() => checkLoading(queries));
    // проверяем инвалидцию на другие 2 стора
    mobxQuery.invalidate(['foo']);

    expect(
      queryAsc.data,
      'queryAsc дергаем дату, чтобы тригернуть загрузку',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc дергаем дату, чтобы тригернуть загрузку',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser дергаем дату, чтобы тригернуть загрузку',
    ).toStrictEqual({ name: 'Ваня' });

    expect(
      queryAsc.isLoading,
      'queryAsc проверяем что загрузка в двух с ключом foo',
    ).toBeTruthy();

    expect(
      queryDesc.isLoading,
      'queryDesc проверяем что загрузка в двух с ключом foo',
    ).toBeTruthy();

    expect(
      queryUser.isLoading,
      'queryUser проверяем что загрузка в двух с ключом foo',
    ).toBeFalsy();

    await when(() => checkLoading(queries));
    // проверяем инвалидцию по ключу второго уровня
    mobxQuery.invalidate([{ direction: 'asc' }]);

    expect(
      queryAsc.data,
      'queryAsc дергаем data, чтобы тригернуть загрузку',
    ).toStrictEqual(['foo', 'data']);

    expect(
      queryDesc.data,
      'queryDesc дергаем data, чтобы тригернуть загрузку',
    ).toStrictEqual(['data', 'foo']);

    expect(
      queryUser.data,
      'queryUser дергаем data, чтобы тригернуть загрузку',
    ).toStrictEqual({ name: 'Ваня' });

    expect(
      queryAsc.isLoading,
      'queryAsc ожидаем что загрузка началась только в сторе с direction: "asc"',
    ).toBeTruthy();

    expect(
      queryDesc.isLoading,
      'queryDesc ожидаем что загрузка началась только в сторе с direction: "asc"',
    ).toBeFalsy();

    expect(
      queryUser.isLoading,
      'queryUser ожидаем что загрузка началась только в сторе с direction: "asc"',
    ).toBeFalsy();

    await when(() => checkLoading(queries));
    // проверяем инвалидацию для не активного стора
    mobxQuery.invalidate(['user']);

    expect(
      queryUser.isLoading,
      'пока не дернули data, загрузка не должна начинаться',
    ).toBeFalsy();

    expect(
      queryUser.data,
      'эмулируем чтение data, чтобы тригернуть загрузку',
    ).toStrictEqual({ name: 'Ваня' });

    expect(queryUser.isLoading, 'проверяем что загрузка началась').toBeTruthy();
  });

  it('Инвалидация со сложным ключом', async () => {
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
    ).toBeFalsy();

    mobxQuery.invalidate([['foo', 'bar']]);

    expect(query.data, 'эмулируем чтение data, чтобы тригернуть загрузку').toBe(
      'data',
    );

    expect(query.isLoading, 'ожидаем что загрузка началась').toBeTruthy();
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

    expect(
      onLoad,
      'ожидается, что после вызова массовой валидации, сайд эффект загрузки вызывался в executor каждого квери',
    ).toBeCalledTimes(4);
  });
});
