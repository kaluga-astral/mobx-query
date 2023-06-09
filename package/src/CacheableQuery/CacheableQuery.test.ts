import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { CacheableQuery } from './CacheableQuery';

describe('CacheableQuery tests', () => {
  it('Проверяем инит состояние, пока ничего не запросили', () => {
    const store = new CacheableQuery(() => Promise.resolve('foo'));

    expect(store.isError).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.error).toBe(undefined);
  });

  it('Проверяем положительный кейс', async () => {
    const onSuccess = vi.fn();
    const store = new CacheableQuery(() => Promise.resolve('foo'));

    store.sync({ onSuccess });
    expect(store.isLoading).toBe(true);
    expect(store.data).toBe(undefined);
    await when(() => !store.isLoading);
    expect(onSuccess).toBeCalled();
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe('foo');
    // повторный запрос должен игнорироваться
    store.sync();
    expect(store.isLoading).toBe(false);
  });

  it('Проверяем отрицательный кейс вызова sync когда передан обработчик ошибки в саму функцию', async () => {
    const onError = vi.fn();
    const store = new CacheableQuery(() => Promise.reject('foo'));

    store.sync({ onError });
    await when(() => !store.isLoading);
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.isError).toBe(true);
    await when(() => store.error !== undefined);
    expect(store.error).toBe('foo');
    expect(onError).toBeCalledWith('foo');
  });

  it('Проверяем отрицательный кейс вызова syc, когда передан обработчик ошибки по умолчанию', async () => {
    const onDefaultError = vi.fn();
    const store = new CacheableQuery(() => Promise.reject('foo'), {
      onError: onDefaultError,
    });

    store.sync();
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    await when(() => store.error !== undefined);
    expect(store.error).toBe('foo');
    expect(onDefaultError).toBeCalledWith('foo');
  });

  it('Проверяем автоматический запрос данных при обращении к data', async () => {
    const store = new CacheableQuery(() => Promise.resolve('foo'), {
      enabledAutoFetch: true,
    });

    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(store.data).toStrictEqual('foo');
  });

  it('Проверяем инвалидацию', async () => {
    const store = new CacheableQuery(() => Promise.resolve('foo'));

    expect(store.data).toBe(undefined);
    store.invalidate();
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(store.isLoading).toBe(false);
    await when(() => store.data !== undefined);
    expect(store.data).toBe('foo');
  });
});
