import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { Mutation } from './Mutation';

describe('Mutation', () => {
  it('Флаг простаивания true при начальном состоянии', () => {
    const sut = new Mutation(() => Promise.resolve('foo'));

    expect(sut.isIdle).toBeTruthy();
  });

  it('Флаг простаивания false сразу после запуска запроса', () => {
    const sut = new Mutation(() => Promise.resolve('foo'));

    sut.sync();
    expect(sut.isIdle).toBeFalsy();
  });

  it('isLoading равен false при старте', () => {
    const sut = new Mutation(() => Promise.resolve('foo'));

    expect(sut.isLoading).toBeFalsy();
  });

  it('isError равен false при старте', () => {
    const sut = new Mutation(() => Promise.resolve('foo'));

    expect(sut.isError).toBeFalsy();
  });

  it('error равен undefined при старте', () => {
    const sut = new Mutation(() => Promise.resolve('foo'));

    expect(sut.error).toBeUndefined();
  });

  it('Вызов sync приводит к загрузке данных', async () => {
    const spyOnSyncSuccess = vi.fn();
    const sut = new Mutation(() => Promise.resolve('foo'));

    sut.sync({ onSuccess: spyOnSyncSuccess });
    expect(sut.isLoading).toBeTruthy();
    await when(() => !sut.isLoading);
    expect(spyOnSyncSuccess).toBeCalledWith('foo');
    expect(sut.isLoading).toBeFalsy();
  });

  it('Вызов async приводит к загрузке данных', async () => {
    const spyOnAsyncSuccess = vi.fn();
    const sut = new Mutation(() => Promise.resolve('foo'));

    await sut.async().then(spyOnAsyncSuccess);
    await when(() => !sut.isLoading);
    expect(spyOnAsyncSuccess).toBeCalledWith('foo');
    expect(sut.isLoading).toBeFalsy();
  });

  it('Вызов sync вызывает executor c переданными параметрами', async () => {
    const executorSpy = vi.fn();
    const sut = new Mutation((params: string) => {
      executorSpy(params);

      return Promise.resolve('foo');
    });

    sut.sync({ params: 'bar' });
    await when(() => !sut.isLoading);
    expect(executorSpy).toBeCalledWith('bar');
  });

  it('Вызов async вызывает executor с переданными параметрами', async () => {
    const spyExecutor = vi.fn();
    const sut = new Mutation((params: string) => {
      spyExecutor(params);

      return Promise.resolve('foo');
    });

    await sut.async('bar');
    expect(spyExecutor).toBeCalledWith('bar');
  });

  it('onError вызывается c данными ошибки при провальном запросе', async () => {
    const spyOnError = vi.fn();
    const sut = new Mutation(() => Promise.reject('foo'));

    sut.sync({
      onError: spyOnError,
    });

    await when(() => !sut.isLoading);
    expect(spyOnError).toBeCalledWith('foo');
  });

  it('Стандартный onError вызывается с данными ошибки при провальном запросе', async () => {
    const spyOnError = vi.fn();

    const sut = new Mutation(() => Promise.reject('foo'), {
      onError: spyOnError,
    });

    sut.sync();
    await when(() => !sut.isLoading);
    expect(spyOnError).toBeCalledWith('foo');
  });

  it('Стандартный onError не вызывается при использовании дополнительного', async () => {
    const spyOnDefaultError = vi.fn();
    const spyOnAsyncError = vi.fn();
    const sut = new Mutation(() => Promise.reject('foo'), {
      onError: spyOnDefaultError,
    });

    await sut.async().catch(spyOnAsyncError);
    await when(() => !sut.isLoading);
    expect(spyOnAsyncError).toBeCalledWith('foo');
    expect(spyOnDefaultError).not.toBeCalled();
  });

  it('Модель фоновых статусов background равен null', () => {
    const sut = new Mutation(() => Promise.reject('foo'));

    expect(sut.background).toBeNull();
  });
});
