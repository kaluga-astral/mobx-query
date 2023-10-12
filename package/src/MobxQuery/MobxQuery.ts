import { Query, QueryExecutor, QueryParams } from '../Query';
import {
  InfiniteExecutor,
  InfiniteQuery,
  InfiniteQueryParams,
} from '../InfiniteQuery';
import { Mutation, MutationExecutor, MutationParams } from '../Mutation';
import { CacheKey, FetchPolicy } from '../types';
import { DataStorageFactory } from '../DataStorage';
import { ExpireInspector } from '../ExpireInspector';

/**
 * @description время, спустя которое, запись о query c network-only будет удалена
 */
const DEFAULT_TIME_TO_CLEAN = 100;

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
  fetchPolicy?: FetchPolicy;
  onError?: OnError;
  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   * @default false
   */
  enabledAutoFetch?: boolean;
};

type WithTimeToLive = {
  /**
   * @description временной промежуток в мс, говорящий о том, через какое время, данные для query станут устаревшими
   */
  timeToLive?: number;
};

type CreateQueryParams<TResult, TError> = Omit<
  QueryParams<TResult, TError>,
  'dataStorage'
> &
  WithTimeToLive;

type CreateInfiniteQueryParams<TResult, TError> = Omit<
  InfiniteQueryParams<TResult, TError>,
  'dataStorage'
> &
  WithTimeToLive;

/**
 * @description внутриний тип кешируемого стора
 */
type CachedQueryStore<TResult, TError> =
  | Query<TResult, TError>
  | InfiniteQuery<TResult, TError>;

/**
 * @description Сервис, позволяющий кэшировать данные.
 */
export class MobxQuery<TDefaultError = void> {
  /**
   * @description объект соответствия хешей ключей и их значений
   */
  private keys: Record<KeyHash, CacheKey[]> = {};

  /**
   * @description Map соответствия хешей ключей к запомненным сторам
   */
  private cacheableStores = new Map<
    KeyHash,
    CachedQueryStore<unknown, unknown>
  >();

  /**
   * @description фабрика создания хранилищ данных для обычного Query
   */
  private queryDataStorageFactory: DataStorageFactory;

  /**
   * @description фабрика создания хранилищ данных для Infinite Query
   */
  private infiniteQueryDataStorageFactory: DataStorageFactory;

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

  private serialize = (data: CacheKey | CacheKey[]) => JSON.stringify(data);

  /**
   * @description инспектор данных по сроку годности
   */
  private expireInspector: ExpireInspector;

  constructor({
    onError,
    fetchPolicy = 'cache-first',
    enabledAutoFetch = false,
  }: MobxQueryParams = {}) {
    this.expireInspector = new ExpireInspector({
      invalidate: this.invalidate,
    });

    this.queryDataStorageFactory = new DataStorageFactory({
      onUpdate: this.expireInspector.update,
    });

    this.infiniteQueryDataStorageFactory = new DataStorageFactory({
      onUpdate: this.expireInspector.update,
    });

    this.defaultErrorHandler = onError;
    this.defaultFetchPolicy = fetchPolicy;
    this.defaultEnabledAutoFetch = enabledAutoFetch;
  }

  /**
   * @description метод для инвалидации по списку ключей,
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
   * @description метод инвалидации всех query
   */
  public invalidateQueries = () => {
    [...this.cacheableStores.entries()].forEach(([, store]) => {
      store.invalidate();
    });
  };

  /**
   * @description метод, который занимается проверкой наличия стора по ключу,
   * и если нет, создает новый, добавляет его к себе в память, и возвращает его пользователю
   */
  private getCachedQuery = <TResult, TError>(
    key: CacheKey[],
    createStore: () => CachedQueryStore<TResult, TError>,
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
      store as CachedQueryStore<unknown, unknown>,
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

  /**
   * @description метод создания стора, кешируется
   */
  createQuery = <TResult, TError = TDefaultError>(
    key: CacheKey[],
    executor: QueryExecutor<TResult>,
    params?: CreateQueryParams<TResult, TError>,
  ) => {
    const fetchPolicy = params?.fetchPolicy || this.defaultFetchPolicy;

    if (params?.timeToLive) {
      this.expireInspector.connect(key, params.timeToLive);
    }

    return this.getCachedQuery(
      key,
      () =>
        new Query(executor, {
          ...params,
          onError: (params?.onError ||
            this.defaultErrorHandler) as OnError<TError>,
          enabledAutoFetch:
            params?.enabledAutoFetch || this.defaultEnabledAutoFetch,
          fetchPolicy: fetchPolicy,
          dataStorage: this.queryDataStorageFactory.getStorage<TResult>(key),
        }),
      fetchPolicy,
    ) as Query<TResult, TError>;
  };

  /**
   * @description метод создания инфинит стора, кешируется
   */
  createInfiniteQuery = <TResult, TError = TDefaultError>(
    key: CacheKey[],
    executor: InfiniteExecutor<TResult>,
    params?: CreateInfiniteQueryParams<TResult, TError>,
  ) => {
    const fetchPolicy = params?.fetchPolicy || this.defaultFetchPolicy;

    if (params?.timeToLive) {
      this.expireInspector.connect(key, params.timeToLive);
    }

    return this.getCachedQuery(
      key,
      () =>
        new InfiniteQuery(executor, {
          ...params,
          onError: (params?.onError ||
            this.defaultErrorHandler) as OnError<TError>,
          enabledAutoFetch:
            params?.enabledAutoFetch || this.defaultEnabledAutoFetch,
          dataStorage:
            this.infiniteQueryDataStorageFactory.getStorage<TResult[]>(key),
          fetchPolicy: fetchPolicy,
        }),
      fetchPolicy,
    ) as InfiniteQuery<TResult, TError>;
  };

  /**
   * @description метод создания мутации, не кешируется
   */
  createMutation = <TResult, TError = TDefaultError, TExecutorParams = void>(
    executor: MutationExecutor<TResult, TExecutorParams>,
    params?: MutationParams<TResult, TError>,
  ) =>
    new Mutation<TResult, TError, TExecutorParams>(executor, {
      ...params,
      onError: params?.onError || this.defaultErrorHandler,
    });
}
