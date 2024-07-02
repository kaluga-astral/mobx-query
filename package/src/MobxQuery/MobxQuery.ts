import { Query, type QueryExecutor, type QueryParams } from '../Query';
import {
  type InfiniteExecutor,
  InfiniteQuery,
  type InfiniteQueryParams,
} from '../InfiniteQuery';
import {
  Mutation,
  type MutationExecutor,
  type MutationParams,
} from '../Mutation';
import type { CacheKey, FetchPolicy } from '../types';
import { DataStorageFactory } from '../DataStorage';
import { type StatusStorage, StatusStorageFactory } from '../StatusStorage';

/**
 * время, спустя которое, запись о query c network-only будет удалена
 */
const DEFAULT_TIME_TO_CLEAN = 100;

/**
 * стандартный обработчик ошибки запроса,
 * будет вызван, если при вызове sync не был передан отдельный onError параметр
 */
type OnError<TError = unknown> = (error: TError) => void;

/**
 * хэш ключа
 */
type KeyHash = string;

type MobxQueryParams = {
  fetchPolicy?: FetchPolicy;
  onError?: OnError;
  /**
   * флаг, отвечающий за автоматический запрос данных при обращении к полю data
   * @default false
   */
  enabledAutoFetch?: boolean;
};

type CreateQueryParams<TResult, TError, TIsBackground extends boolean> = Omit<
  QueryParams<TResult, TError, TIsBackground>,
  'dataStorage' | 'statusStorage' | 'backgroundStatusStorage'
> & {
  /**
   * режим фонового обновления
   */
  isBackground?: TIsBackground;
};

type CreateInfiniteQueryParams<
  TResult,
  TError,
  TIsBackground extends boolean,
> = Omit<
  InfiniteQueryParams<TResult, TError, TIsBackground>,
  'dataStorage' | 'statusStorage' | 'backgroundStatusStorage'
> & {
  /**
   * режим фонового обновления
   */
  isBackground?: TIsBackground;
};

/**
 * внутриний тип кешируемого стора
 */
type CachedQueryStore<TResult, TError, TIsBackground extends boolean> =
  | Query<TResult, TError, TIsBackground>
  | InfiniteQuery<TResult, TError, TIsBackground>;

/**
 * Сервис, позволяющий кэшировать данные.
 */
export class MobxQuery<TDefaultError = void> {
  /**
   * объект соответствия хешей ключей и их значений
   */
  private keys: Record<KeyHash, CacheKey[]> = {};

  /**
   * Map соответствия хешей ключей к запомненным сторам
   */
  private cacheableStores = new Map<
    KeyHash,
    CachedQueryStore<unknown, unknown, false>
  >();

  /**
   * фабрика создания хранилищ данных для обычного Query
   */
  private queryDataStorageFactory = new DataStorageFactory();

  /**
   * фабрика создания хранилищ статусов между экземплярами Query и экземллярами Infinite Query.
   */
  private statusStorageFactory = new StatusStorageFactory();

  /**
   * фабрика создания хранилищ данных для Infinite Query
   */
  private infiniteQueryDataStorageFactory = new DataStorageFactory();

  /**
   * стандартный обработчик ошибок, будет использован, если не передан другой
   */
  private readonly defaultErrorHandler?: OnError;

  /**
   * стандартное поведение политики кеширования
   */
  private readonly defaultFetchPolicy: FetchPolicy;

  /**
   * флаг, отвечающий за автоматический запрос данных при обращении к полю data
   * @default false
   */
  private readonly defaultEnabledAutoFetch: boolean;

  private serialize = (data: CacheKey | CacheKey[]) => JSON.stringify(data);

  constructor({
    onError,
    fetchPolicy = 'cache-first',
    enabledAutoFetch = false,
  }: MobxQueryParams = {}) {
    this.defaultErrorHandler = onError;
    this.defaultFetchPolicy = fetchPolicy;
    this.defaultEnabledAutoFetch = enabledAutoFetch;
  }

  /**
   * метод для инвалидации по списку ключей,
   * предполагается использование из домена
   */
  public invalidate = (keysParts: CacheKey[]) => {
    // сет сериализовонных ключей
    const keysSet = new Set(keysParts.map(this.serialize));

    Object.keys(this.keys).forEach((key: KeyHash) => {
      const value = this.keys[key];
      // проверяем, есть ли пересечение между закешированными ключами и набором ключей для инвалидации
      const hasTouchedElement = value.some((valuePart) =>
        keysSet.has(this.serialize(valuePart)),
      );

      if (hasTouchedElement) {
        this.cacheableStores.get(key)?.invalidate();
      }
    });
  };

  /**
   * метод инвалидации всех query
   */
  public invalidateQueries = () => {
    [...this.cacheableStores.entries()].forEach(([, store]) => {
      store.invalidate();
    });
  };

  /**
   * метод, который занимается проверкой наличия стора по ключу,
   * и если нет, создает новый, добавляет его к себе в память, и возвращает его пользователю
   */
  private getCachedQuery = <TResult, TError, TIsBackground extends boolean>(
    key: CacheKey[],
    createStore: () => CachedQueryStore<TResult, TError, TIsBackground>,
    fetchPolicy: FetchPolicy,
  ) => {
    // создаем хэш ключа с добавляем к ключу значения fetchPolicy,
    // чтобы query c одинаковым ключом, но разным fetchPolicy не пересекались бы
    const keyHash: KeyHash = this.serialize([...key, fetchPolicy]);

    if (this.cacheableStores.has(keyHash)) {
      return this.cacheableStores.get(keyHash);
    }

    const store = createStore();

    this.cacheableStores.set(
      keyHash,
      store as CachedQueryStore<unknown, unknown, false>,
    );

    this.keys[keyHash] = key;

    // Ожидается, что network-only квери не должны кешироваться,
    // но, с введением StrictMode в реакт 18, проявилась проблема,
    // что network-only квери, созданные в одном реакт компоненте,
    // создаются дважды (т.к. все хуки вызываются дважды)
    // и т.к. мы не ограничиваем момент запроса,
    // то можем получить эффект, что оба network-only квери
    // делают по отдельному запросу к данным единомоментно,
    if (fetchPolicy === 'network-only') {
      setTimeout(() => {
        this.cacheableStores.delete(keyHash);
        delete this.keys[keyHash];
      }, DEFAULT_TIME_TO_CLEAN);
    }

    return store;
  };

  private getBackgroundStatusStorage = <TError, TIsBackground extends boolean>(
    key: CacheKey[],
    hasBackground: TIsBackground,
  ) =>
    (hasBackground
      ? this.statusStorageFactory.getStorage([...key, true])
      : null) as TIsBackground extends true ? StatusStorage<TError> : null;

  /**
   * метод создания стора, кешируется
   */
  public createQuery = <
    TResult,
    TError = TDefaultError,
    TIsBackground extends boolean = false,
  >(
    key: CacheKey[],
    executor: QueryExecutor<TResult>,
    params?: CreateQueryParams<TResult, TError, TIsBackground>,
  ) => {
    const fetchPolicy = params?.fetchPolicy || this.defaultFetchPolicy;

    return this.getCachedQuery(
      key,
      () =>
        new Query(executor, {
          ...params,
          onError: (params?.onError ||
            this.defaultErrorHandler) as OnError<TError>,
          enabledAutoFetch:
            params?.enabledAutoFetch ?? this.defaultEnabledAutoFetch,
          fetchPolicy: fetchPolicy,
          dataStorage: this.queryDataStorageFactory.getStorage<TResult>(key),
          statusStorage: this.statusStorageFactory.getStorage<TError>(key),
          backgroundStatusStorage: this.getBackgroundStatusStorage<
            TError,
            TIsBackground
          >(key, Boolean(params?.isBackground) as TIsBackground),
        }),
      fetchPolicy,
    ) as Query<TResult, TError, TIsBackground>;
  };

  /**
   * метод создания инфинит стора, кешируется
   */
  public createInfiniteQuery = <
    TResult,
    TError = TDefaultError,
    TIsBackground extends boolean = false,
  >(
    key: CacheKey[],
    executor: InfiniteExecutor<TResult>,
    params?: CreateInfiniteQueryParams<TResult, TError, TIsBackground>,
  ) => {
    const fetchPolicy = params?.fetchPolicy || this.defaultFetchPolicy || '';

    return this.getCachedQuery(
      key,
      () =>
        new InfiniteQuery(executor, {
          ...params,
          onError: (params?.onError ||
            this.defaultErrorHandler) as OnError<TError>,
          enabledAutoFetch:
            params?.enabledAutoFetch ?? this.defaultEnabledAutoFetch,
          dataStorage:
            this.infiniteQueryDataStorageFactory.getStorage<Array<TResult>>(
              key,
            ),
          statusStorage: this.statusStorageFactory.getStorage<TError>(key),
          fetchPolicy: fetchPolicy,
          backgroundStatusStorage: this.getBackgroundStatusStorage<
            TError,
            TIsBackground
          >(key, Boolean(params?.isBackground) as TIsBackground),
        }),
      fetchPolicy,
    ) as InfiniteQuery<TResult, TError, TIsBackground>;
  };

  /**
   * метод создания мутации, не кешируется
   */
  public createMutation = <
    TResult,
    TError = TDefaultError,
    TExecutorParams = void,
  >(
    executor: MutationExecutor<TResult, TExecutorParams>,
    params?: MutationParams<TResult, TError>,
  ) =>
    new Mutation<TResult, TError, TExecutorParams>(executor, {
      ...params,
      onError: params?.onError || this.defaultErrorHandler,
    });
}
