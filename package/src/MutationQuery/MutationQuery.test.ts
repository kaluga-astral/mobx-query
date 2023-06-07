import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { MutationQuery } from './MutationQuery';

describe('MutationQuery tests', () => {
  it('Проверяем инит состояние, пока ничего не запросили', () => {
    const store = new MutationQuery(() => Promise.resolve('foo'));

    expect(store.isError).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBe(undefined);
  });

  it('Проверяем положительный кейс c sync', async () => {
    const onSyncSuccess = vi.fn();
    const store = new MutationQuery(() => Promise.resolve('foo'));

    store.sync({ onSuccess: onSyncSuccess });
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(onSyncSuccess).toBeCalledWith('foo');
    expect(store.isLoading).toBe(false);
  });

  it('Проверяем положительный кейс c async', async () => {
    const onAsyncSuccess = vi.fn();
    const store = new MutationQuery(() => Promise.resolve('foo'));

    await store.async().then(onAsyncSuccess);
    expect(onAsyncSuccess).toBeCalledWith('foo');
    expect(store.isLoading).toBe(false);
  });

  it('Проверяем отрицательный кейс c sync, без стандартной обработки ошибки', async () => {
    const store = new MutationQuery(() => Promise.reject('foo'));

    store.sync({
      onError: (e) => {
        expect(store.isLoading).toBe(false);
        expect(store.isError).toBe(true);
        expect(e).toBe('foo');
      },
    });
  });

  it('Проверяем отрицательный кейс c sync, со стандартной обработкой ошибок', async () => {
    const store = new MutationQuery(() => Promise.reject('foo'), {
      onError: (e) => {
        expect(store.isLoading).toBe(false);
        expect(store.isError).toBe(true);
        expect(e).toBe('foo');
      },
    });

    store.sync();
  });

  it('Проверяем отрицательный кейс c async', async () => {
    const onDefaultError = vi.fn();
    const onAsyncError = vi.fn();
    const store = new MutationQuery(() => Promise.reject('foo'), {
      onError: onDefaultError,
    });

    await store.async().catch(onAsyncError);
    expect(store.isError).toBe(true);
    expect(onAsyncError).toBeCalledWith('foo');
    expect(onDefaultError).not.toBeCalled();
  });
});
