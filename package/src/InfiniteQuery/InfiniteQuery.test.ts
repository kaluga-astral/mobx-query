import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { InfiniteQuery } from './InfiniteQuery';

describe('InfiniteQuery tests', () => {
  it('Проверяем инит состояние, пока ничего не запросили', () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']));

    expect(store.isError).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.error).toBe(undefined);
  });

  it('Проверяем положительный кейс', async () => {
    const onSuccess = vi.fn();
    const store = new InfiniteQuery(() => Promise.resolve(['foo']));

    store.sync({ onSuccess });
    expect(store.isLoading).toBe(true);
    expect(store.data).toBe(undefined);
    await when(() => !store.isLoading);
    expect(onSuccess).toBeCalled();
    expect(store.isLoading).toBe(false);
    expect(store.data).toStrictEqual(['foo']);
  });

  it('Проверяем отрицательный кейс', async () => {
    const onDefaultError = vi.fn();
    const store = new InfiniteQuery(() => Promise.reject('error'), {
      onError: onDefaultError,
    });

    store.sync({
      onError: (e) => {
        expect(e).toBe('error');
        expect(onDefaultError).not.toBeCalled();
        expect(store.isLoading).toBe(false);
        expect(store.data).toBe(undefined);
        expect(store.isError).toBe(true);
        expect(store.error).toBe('error');
      },
    });
  });

  it('Проверяем отрицательный кейс, когда передан только стандартный обработчик ошибки', async () => {
    const store = new InfiniteQuery(() => Promise.reject('error'), {
      onError: (e) => {
        expect(e).toBe('error');
      },
    });

    store.sync();
  });

  it('Проверяем инвалидацию', async () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']));

    expect(store.data).toBe(undefined);
    store.invalidate();
    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(store.isLoading).toBe(false);
    expect(store.data).toStrictEqual(['foo']);
  });

  it('Проверяем автоматический запрос данных при обращении к data', async () => {
    const store = new InfiniteQuery(() => Promise.resolve(['foo']), {
      enabledAutoFetch: true,
    });

    expect(store.isLoading).toBe(false);
    expect(store.data).toBe(undefined);
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(store.data).toStrictEqual(['foo']);
  });

  it('Проверяем инкремент', async () => {
    const insideExecutor = vi.fn();

    const store = new InfiniteQuery(
      (params) => {
        insideExecutor(params);

        // эмулируем ситуацию, что у нас на бэке есть данные для первых двух страниц,
        // на каждой странице всего по 1му элементу
        if (params.offset <= 1) {
          return Promise.resolve(['foo']);
        }

        // если запросили больше чем 2ю страницу, отдаем пустотой массив
        return Promise.resolve([]);
      },
      {
        incrementCount: 1,
      },
    );

    // проверяем запрос
    store.sync();
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(store.isLoading).toBe(false);
    expect(store.data).toStrictEqual(['foo']);
    expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 0, count: 1 });
    // запускаем инкремент метод
    store.increment();
    expect(store.isLoading).toBe(true);
    expect(store.isEndReached).toBe(false);
    await when(() => !store.isLoading);
    expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 1, count: 1 });
    expect(store.isLoading).toBe(false);
    expect(store.isEndReached).toBe(false);
    // проверяем что данные именно добавились, а не заменились
    expect(store.data).toStrictEqual(['foo', 'foo']);
    // снова запускаем инкремент
    store.increment();
    expect(store.isLoading).toBe(true);
    expect(store.isEndReached).toBe(false);
    await when(() => !store.isLoading);
    expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 2, count: 1 });
    expect(store.isLoading).toBe(false);
    // ожидаем, что бэк отдал пустой массив, следовательно, мы достигли конца списка
    expect(store.isEndReached).toBe(true);
    expect(store.data).toStrictEqual(['foo', 'foo']);
    // при еще одной попытке сделать запрос
    store.increment();
    // ожидаем что вызов будет проигнорирован, и флаг загрузки false
    expect(store.isLoading).toBe(false);
    expect(store.isEndReached).toBe(true);
    // ожидаем, что при инвалидации, данные будут заменены на начальный набор
    store.invalidate();
    store.sync();
    await when(() => !store.isLoading);
    expect(insideExecutor).toHaveBeenLastCalledWith({ offset: 0, count: 1 });
    expect(store.data).toStrictEqual(['foo']);
  });
});
