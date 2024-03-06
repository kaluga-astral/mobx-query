import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { Mutation } from './Mutation';

describe('Mutation', () => {
  it('Init state: флаги false, данные undefined', () => {
    const store = new Mutation(() => Promise.resolve('foo'));

    expect(store.isError).toBeFalsy();
    expect(store.isLoading).toBeFalsy();
    expect(store.error).toBeUndefined();
  });

  it('sync: стандартная загрузка успешна', async () => {
    const onSyncSuccess = vi.fn();
    const store = new Mutation(() => Promise.resolve('foo'));

    store.sync({ onSuccess: onSyncSuccess });
    expect(store.isLoading).toBeTruthy();
    await when(() => !store.isLoading);
    expect(onSyncSuccess).toBeCalledWith('foo');
    expect(store.isLoading).toBeFalsy();
  });

  it('async: стандартная загрузка успешна', async () => {
    const onAsyncSuccess = vi.fn();
    const store = new Mutation(() => Promise.resolve('foo'));

    await store.async().then(onAsyncSuccess);
    expect(onAsyncSuccess).toBeCalledWith('foo');
    expect(store.isLoading).toBeFalsy();
  });

  it('sync: При вызове передаются параметры', async () => {
    const callBack = vi.fn();
    const store = new Mutation((params: string) => {
      callBack(params);

      return Promise.resolve('foo');
    });

    store.sync({ params: 'bar' });
    await when(() => !store.isLoading);
    expect(callBack).toBeCalledWith('bar');
  });

  it('async: При вызове передаются параметры', async () => {
    const callBack = vi.fn();
    const store = new Mutation((params: string) => {
      callBack(params);

      return Promise.resolve('foo');
    });

    await store.async('bar');
    expect(callBack).toBeCalledWith('bar');
  });

  it('sync: при провальном запросе вызывается onError', async () => {
    const store = new Mutation(() => Promise.reject('foo'));

    store.sync({
      onError: (e) => {
        expect(store.isLoading).toBeFalsy();
        expect(store.isError).toBeTruthy();
        expect(e).toBe('foo');
      },
    });
  });

  it('sync: при провальном запросе вызывается стандартный onError', async () => {
    const store = new Mutation(() => Promise.reject('foo'), {
      onError: (e) => {
        expect(store.isLoading).toBeFalsy();
        expect(store.isError).toBeTruthy();
        expect(e).toBe('foo');
      },
    });

    store.sync();
  });

  it('async: При провальном запросе вызывается не вызывается стандартный onError', async () => {
    const onDefaultError = vi.fn();
    const onAsyncError = vi.fn();
    const store = new Mutation(() => Promise.reject('foo'), {
      onError: onDefaultError,
    });

    await store.async().catch(onAsyncError);
    expect(store.isError).toBeTruthy();
    expect(onAsyncError).toBeCalledWith('foo');
    expect(onDefaultError).not.toBeCalled();
  });
});
