import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { Query } from './Query';

describe('CacheableQuery tests', () => {
  it('Проверяем инит состояние, пока ничего не запросили', () => {
    const store = new Query(() => Promise.resolve('foo'));

    expect(store.isError).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.error).toBe(undefined);
  });

  it('Проверяем положительный кейс', async () => {
    const onSuccess = vi.fn();
    const store = new Query(() => Promise.resolve('foo'));

    store.sync({ onSuccess });
    expect(store.isLoading).toBe(true);
    expect(store.data).toBe(undefined);
    await when(() => !store.isLoading);
    expect(onSuccess).toBeCalled();
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe('foo');
    // повторный запрос должен игнорироваться
    store.sync();

    expect(store.isLoading, 'повторный запрос должен игнорироваться').toBe(
      false,
    );
  });

  it('Проверяем отрицательный кейс вызова sync когда передан обработчик ошибки в саму функцию', async () => {
    const onError = vi.fn();
    const store = new Query(() => Promise.reject('foo'));

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
    const store = new Query(() => Promise.reject('foo'), {
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
    const store = new Query(() => Promise.resolve('foo'), {
      enabledAutoFetch: true,
    });

    expect(
      store.isLoading,
      'проверяем что загрузка не началась сама по себе',
    ).toBe(false);

    expect(store.data, 'эмулируем обращение к data').toBe(undefined);
    expect(store.isLoading, 'проверяем, что загрузка началась').toBe(true);
    await when(() => !store.isLoading);
    expect(store.data).toStrictEqual('foo');
  });

  it('Проверяем инвалидацию считыванием data', async () => {
    const store = new Query(() => Promise.resolve('foo'));

    expect(store.data, 'проверяем, что данных действительно нет').toBe(
      undefined,
    );

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBe(false);

    expect(store.data, 'эмулируем считывание данных').toBe(undefined);

    expect(
      store.isLoading,
      'ожидаем, что после считывания данных загрузка началась',
    ).toBe(true);
  });

  it('Проверяем инвалидацию запуском sync', async () => {
    const store = new Query(() => Promise.resolve('foo'));

    // добавляем данные в стор
    store.sync();
    await when(() => !store.isLoading);
    expect(store.data, 'проверяем, что данные есть').toBe('foo');
    store.sync();

    expect(
      store.isLoading,
      'ожидаем что загрузка не началась, потому что инвалидация еще не была вызвана',
    ).toBe(false);

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBe(false);

    store.sync();

    expect(
      store.isLoading,
      'ожидаем, что после последовательного вызова инвалидации и sync загрузка все таки началась',
    ).toBe(true);
  });

  it('Проверяем инвалидацию запуском async', async () => {
    const store = new Query(() => Promise.resolve('foo'));

    // добавляем данные в стор
    await store.async();
    expect(store.data, 'проверяем, что данные есть').toBe('foo');
    store.sync();

    expect(
      store.isLoading,
      'ожидаем что загрузка не началась, потому что инвалидация еще не была вызвана',
    ).toBe(false);

    store.invalidate();

    expect(
      store.isLoading,
      'ожидаем, что загрузка не началась сама по себе',
    ).toBe(false);

    store.async();

    expect(
      store.isLoading,
      'ожидаем, что после последовательного вызова инвалидации и async загрузка все таки началась',
    ).toBe(true);
  });
});
