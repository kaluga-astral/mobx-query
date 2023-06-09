import isEqual from 'lodash.isequal';

import {
  CacheableExecutor,
  CacheableQuery,
  CacheableQueryParams,
} from '../CacheableQuery';
import {
  InfiniteQuery,
  InfiniteQueryParams,
  InfinityExecutor,
} from '../InfiniteQuery';
import {
  MutationExecutor,
  MutationQuery,
  MutationQueryParams,
} from '../MutationQuery';

/**
 * @description стандартный обработчик ошибки запроса,
 * будет вызван, если при вызове sync не был передан отдельный onError параметр
 */
type OnError<TError = unknown> = (error: TError) => void;

/**
 * @description хэш ключа
 */
type KeyHash = string;

/**
 * @description внутриний тип кешируемого стора
 */
type CachedQueryStore =
  | CacheableQuery<unknown, unknown>
  | InfiniteQuery<unknown, unknown>;

/**
 * @description параметры кешируемого стора
 */
type StoreParams<TResult, TError> =
  | (CacheableQueryParams<TResult, TError> & {
      executor: CacheableExecutor<TResult>;
    })
  | (InfiniteQueryParams<TResult, TError> & {
      executor: InfinityExecutor<TResult>;
    });

/**
 * @description варианты кешируемого стора
 */
enum CachedStoreTypes {
  cacheable,
  infinite,
}

/**
 * @description ключ для кешированя квери
 */
type CacheKey = string | string[] | number | { [key: string]: CacheKey };

/**
 * @description фабрика создающая сторы данных, и запускающая их инвалидацию по указанным ключам
 */
export class MobxQuery {
  /**
   * @description объект соответствия хешей ключей и их значений
   */
  private keys: Record<KeyHash, unknown[]> = {};

  /**
   * @description Map соответствия хешей ключей к запомненным сторам
   */
  private cacheableStores = new Map<KeyHash, CachedQueryStore>();

  private readonly defaultOnError?: OnError;

  constructor(onError?: OnError) {
    this.defaultOnError = onError;
  }

  /**
   * @description метод для инвалидации по списку ключей,
   * предполагается использование из домена
   */
  public invalidate = (keysParts: CacheKey[]) => {
    // создаем массив затронутых ключей
    const touchedKeys: KeyHash[] = Object.keys(this.keys)
      .map((key: KeyHash) => {
        const value = this.keys[key];
        const hasTouchedElement = value.some((valuePart) =>
          // ищем совпадающие части ключей
          keysParts.some((keyPart) => isEqual(valuePart, keyPart)),
        );

        if (hasTouchedElement) {
          return key;
        }

        return '';
      })
      .filter(Boolean);

    // для всех затронутых сторов, запускаем инвалидацию
    touchedKeys.forEach((key) => {
      this.cacheableStores.get(key)?.invalidate();
    });
  };

  /**
   * @description приватный метод, который занимается проверкой наличия стора по ключу,
   * и если нет, создает новый, добавляет его к себе в память, и возвращает его пользователю
   */
  private getCachedQuery = (
    key: unknown[],
    { executor, ...params }: StoreParams<unknown, unknown>,
    type: CachedStoreTypes,
  ) => {
    const keyHash: KeyHash = JSON.stringify(key);

    if (this.cacheableStores.has(keyHash)) {
      return this.cacheableStores.get(keyHash);
    }

    let store: CachedQueryStore;

    if (type === CachedStoreTypes.cacheable) {
      store = new CacheableQuery(
        executor as CacheableExecutor<unknown>,
        params as CacheableQueryParams<unknown, unknown>,
      );
    } else {
      store = new InfiniteQuery(
        executor as InfinityExecutor<unknown>,
        params as InfiniteQueryParams<unknown, unknown>,
      );
    }

    this.cacheableStores.set(keyHash, store as CachedQueryStore);
    this.keys[keyHash] = key;

    return store;
  };

  /**
   * @description метод создания стора,
   */
  createCacheableQuery = <TResult, TError>(
    key: CacheKey[],
    executor: CacheableExecutor<TResult>,
    params?: CacheableQueryParams<TResult, TError>,
  ) => {
    return this.getCachedQuery(
      key,
      {
        ...(params as StoreParams<unknown, unknown>),
        onError: (params?.onError || this.defaultOnError) as OnError,
        executor,
      },
      CachedStoreTypes.cacheable,
    ) as CacheableQuery<TResult, TError>;
  };

  /**
   * @description метод создания инфинит стора, кешируется
   */
  createInfiniteQuery = <TResult, TError>(
    key: CacheKey[],
    executor: InfinityExecutor<TResult>,
    params?: InfiniteQueryParams<TResult, TError>,
  ) => {
    return this.getCachedQuery(
      key,
      {
        ...(params as StoreParams<unknown, unknown>),
        onError: (params?.onError || this.defaultOnError) as OnError,
        executor,
      },
      CachedStoreTypes.infinite,
    ) as InfiniteQuery<TResult, TError>;
  };

  /**
   * @description метод создания мутации, не кешируется
   */
  createMutationQuery = <TResult, TError, TExecutorParams>(
    executor: MutationExecutor<TResult, TExecutorParams>,
    params?: MutationQueryParams<TResult, TError>,
  ) => {
    return new MutationQuery<TResult, TError, TExecutorParams>(executor, {
      ...params,
      onError: params?.onError || this.defaultOnError,
    });
  };
}
