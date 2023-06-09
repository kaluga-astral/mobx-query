import isEqual from 'lodash.isequal';

import { Query, QueryExecutor, QueryParams } from '../Query';
import {
  InfiniteExecutor,
  InfiniteQuery,
  InfiniteQueryParams,
} from '../InfiniteQuery';
import {
  MutationExecutor,
  MutationQuery,
  MutationQueryParams,
} from '../MutationQuery';

/**
 * @description настройка способа кеширования квери.
 * @variation 'cache-first' - будет сначала проверять наличие существующего квери,
 * и если такой существует, то вероятно в нем уже имеются нужные данные, иначе создаться новый,
 * добавлен в память, и вернется
 * @variation 'network-only' - для каждого обращения будет создаваться новый квери,
 * который будет запрашивать свежие данные, так же будет кешироваться, перезатирая существующий,
 * что приведет к последующему созданию 'cache-first' на основе 'network-only'
 */
export type FetchPolicy = 'networkOnly' | 'cacheFirst';

/**
 * @description стандартный обработчик ошибки запроса,
 * будет вызван, если при вызове sync не был передан отдельный onError параметр
 */
type OnError<TError = unknown> = (error: TError) => void;

/**
 * @description хэш ключа
 */
type KeyHash = string;

type MobxQueryParams = {
  fetchPolicy: FetchPolicy;
  onError?: OnError;
  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   * @default false
   */
  enabledAutoFetch?: boolean;
};

type WithFetchPolicy = {
  fetchPolicy?: FetchPolicy;
};

type CreateCacheableQueryParams<TResult, TError> = QueryParams<
  TResult,
  TError
> &
  WithFetchPolicy;

type CreateInfiniteQueryParams<TResult, TError> = InfiniteQueryParams<
  TResult,
  TError
> &
  WithFetchPolicy;

/**
 * @description внутриний тип кешируемого стора
 */
type CachedQueryStore =
  | Query<unknown, unknown>
  | InfiniteQuery<unknown, unknown>;

/**
 * @description параметры кешируемого стора
 */
type StoreParams<TResult, TError> =
  | (QueryParams<TResult, TError> & {
      executor: QueryExecutor<TResult>;
    })
  | (InfiniteQueryParams<TResult, TError> & {
      executor: InfiniteExecutor<TResult>;
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
export type CacheKey = string | string[] | number | { [key: string]: CacheKey };

/**
 * @description Сервис, позволяющий кэшировать данные.
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

  /**
   * @description стандартный обработчик ошибок, будет использован, если не передан другой
   */
  private readonly defaultErrorHandler?: OnError;

  /**
   * @description стандартное поведение политики кеширования
   */
  private readonly defaultFetchPolicy: FetchPolicy;

  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   * @default false
   */
  private readonly defaultEnabledAutoFetch: boolean;

  constructor({
    onError,
    fetchPolicy,
    enabledAutoFetch = false,
  }: MobxQueryParams) {
    this.defaultErrorHandler = onError;
    this.defaultFetchPolicy = fetchPolicy;
    this.defaultEnabledAutoFetch = enabledAutoFetch;
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
   * @description метод, который занимается проверкой наличия стора по ключу,
   * и если нет, создает новый, добавляет его к себе в память, и возвращает его пользователю
   */
  private getCachedQuery = (
    key: CacheKey[],
    { executor, ...params }: StoreParams<unknown, unknown>,
    type: CachedStoreTypes,
    fetchPolicy = this.defaultFetchPolicy,
  ) => {
    const keyHash: KeyHash = JSON.stringify(key);

    if (fetchPolicy === 'cacheFirst' && this.cacheableStores.has(keyHash)) {
      return this.cacheableStores.get(keyHash);
    }

    let store: CachedQueryStore;

    if (type === CachedStoreTypes.cacheable) {
      store = new Query(
        executor as QueryExecutor<unknown>,
        params as QueryParams<unknown, unknown>,
      );
    } else {
      store = new InfiniteQuery(
        executor as InfiniteExecutor<unknown>,
        params as InfiniteQueryParams<unknown, unknown>,
      );
    }

    this.cacheableStores.set(keyHash, store as CachedQueryStore);
    this.keys[keyHash] = key;

    return store;
  };

  /**
   * @description метод создания стора, кешируется
   */
  createCacheableQuery = <TResult, TError>(
    key: CacheKey[],
    executor: QueryExecutor<TResult>,
    params?: CreateCacheableQueryParams<TResult, TError>,
  ) => {
    return this.getCachedQuery(
      key,
      {
        ...(params as StoreParams<unknown, unknown>),
        onError: (params?.onError || this.defaultErrorHandler) as OnError,
        executor,
        enabledAutoFetch:
          params?.enabledAutoFetch || this.defaultEnabledAutoFetch,
      },
      CachedStoreTypes.cacheable,
      params?.fetchPolicy,
    ) as Query<TResult, TError>;
  };

  /**
   * @description метод создания инфинит стора, кешируется
   */
  createInfiniteQuery = <TResult, TError>(
    key: CacheKey[],
    executor: InfiniteExecutor<TResult>,
    params?: CreateInfiniteQueryParams<TResult, TError>,
  ) => {
    return this.getCachedQuery(
      key,
      {
        ...(params as StoreParams<unknown, unknown>),
        onError: (params?.onError || this.defaultErrorHandler) as OnError,
        enabledAutoFetch:
          params?.enabledAutoFetch || this.defaultEnabledAutoFetch,
        executor,
      },
      CachedStoreTypes.infinite,
      params?.fetchPolicy,
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
      onError: params?.onError || this.defaultErrorHandler,
    });
  };
}
