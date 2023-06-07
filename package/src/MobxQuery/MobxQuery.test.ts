import { describe, expect, it } from 'vitest';

import { MobxQuery } from './MobxQuery';
import { when } from 'mobx';

const checkLoading = (items: { isLoading: boolean }[]) =>
  items.every((item) => item.isLoading === false);

describe('MobxQuery tests', () => {
  it('Проверяем создание сторов ', async () => {
    const mobxQuery = new MobxQuery();
    const storeA = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );
    const storeB = mobxQuery.createInfiniteQuery(['bar'], () =>
      Promise.resolve([]),
    );
    const storeC = mobxQuery.createInfiniteQuery(['foo'], () =>
      Promise.resolve([]),
    );

    expect(storeA !== storeB, 'при разных ключах, сторы разные').toBe(true);
    expect(storeA === storeC, 'при одинаковом ключе, стор тот же самый').toBe(true);
  });

  it('Проверяем работу инвалидации ', async () => {
    const mobxQuery = new MobxQuery();
    const storeAsc = mobxQuery.createInfiniteQuery(
      ['foo', { direction: 'asc' }],
      () => Promise.resolve(['foo', 'data']),
    );
    const storeDesc = mobxQuery.createInfiniteQuery(
      ['foo', { direction: 'desc' }],
      () => Promise.resolve(['data', 'foo']),
    );

    const userStore = mobxQuery.createCacheableQuery(['user'], () =>
      Promise.resolve({ name: 'Ваня' }),
    );

    const stores = [storeAsc, storeDesc, userStore];

    // проверяем что данных действительно нет
    expect(storeAsc.data).toBe(undefined);
    expect(storeDesc.data).toBe(undefined);
    expect(userStore.data).toBe(undefined);
    // запускаем запрос данных везде
    storeAsc.sync();
    storeDesc.sync();
    userStore.sync();
    await when(() => checkLoading(stores));
    // проверяем что данные попали в стор
    expect(storeAsc.data).toStrictEqual(['foo', 'data']);
    expect(storeDesc.data).toStrictEqual(['data', 'foo']);
    expect(userStore.data).toStrictEqual({ name: 'Ваня' });
    // запускаем инвалидацию по одной вариации ключа
    mobxQuery.invalidate(['user']);
    // дергаем дату у всех сторов, что бы тригернуть загрузку
    expect(storeAsc.data).toStrictEqual(['foo', 'data']);
    expect(storeDesc.data).toStrictEqual(['data', 'foo']);
    expect(userStore.data).toStrictEqual({ name: 'Ваня' });
    // проверяем что загрузка началась только в сторе пользователя
    expect(storeAsc.isLoading).toBe(false);
    expect(storeDesc.isLoading).toBe(false);
    expect(userStore.isLoading).toBe(true);
    await when(() => checkLoading(stores));
    // проверяем инвалидцию на другие 2 стора
    mobxQuery.invalidate(['foo']);
    // дергаем дату у всех сторов, что бы тригернуть загрузку
    expect(storeAsc.data).toStrictEqual(['foo', 'data']);
    expect(storeDesc.data).toStrictEqual(['data', 'foo']);
    expect(userStore.data).toStrictEqual({ name: 'Ваня' });
    // проверяем что загрузка в двух с ключом foo
    expect(storeAsc.isLoading).toBe(true);
    expect(storeDesc.isLoading).toBe(true);
    expect(userStore.isLoading).toBe(false);
    await when(() => checkLoading(stores));
    // проверяем инвалидцию по ключу второго уровня
    mobxQuery.invalidate([{ direction: 'asc' }]);
    // дергаем дату у всех сторов, что бы тригернуть загрузку
    expect(storeAsc.data).toStrictEqual(['foo', 'data']);
    expect(storeDesc.data).toStrictEqual(['data', 'foo']);
    expect(userStore.data).toStrictEqual({ name: 'Ваня' });
    // проверяем что загрузка началась только в сторе с direction: 'asc'
    expect(storeAsc.isLoading).toBe(true);
    expect(storeDesc.isLoading).toBe(false);
    expect(userStore.isLoading).toBe(false);
    await when(() => checkLoading(stores));
    // проверяем инвалидацию для не активного стора
    mobxQuery.invalidate(['user']);
    // пока не дернули дату, загрузка не должна начинаться
    expect(userStore.isLoading).toBe(false);
    // дергаем дату, чтобы тригернуть загрузку
    expect(userStore.data).toStrictEqual({ name: 'Ваня' });
    // проверяем что загрузка началась
    expect(userStore.isLoading).toBe(true);
  });
});
