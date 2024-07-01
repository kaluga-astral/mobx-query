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
import { type DataStorage, DataStorageFactory } from '../DataStorage';
import { type StatusStorage, StatusStorageFactory } from '../StatusStorage';
import { AdaptableMap } from '../AdaptableMap';

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
  'dataStorage' | 'statusStorage' | 'backgroundStatusStorage' | 'submitValidity'
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
  'dataStorage' | 'statusStorage' | 'backgroundStatusStorage' | 'submitValidity'
> & {
  /**
   * режим фонового обновления
   */
  isBackground?: TIsBackground;
};

type QueryType = typeof Query.name | typeof InfiniteQuery.name;

/**
 * внутриний тип кешируемого стора
 */
type CachedQuery<TResult, TError, TIsBackground extends boolean> =
  | Query<TResult, TError, TIsBackground>
  | InfiniteQuery<TResult, TError, TIsBackground>;

type FallbackableCreateParams<TResult, TError, TIsBackground extends boolean> =
  | Pick<
      CreateQueryParams<TResult, TError, TIsBackground>,
      'onError' | 'fetchPolicy' | 'enabledAutoFetch' | 'isBackground'
    >
  | Pick<
      CreateInfiniteQueryParams<TResult, TError, TIsBackground>,
      'onError' | 'fetchPolicy' | 'enabledAutoFetch' | 'isBackground'
    >;

type InternalCreateQueryParams<
  TResult,
  TError,
  TIsBackground extends boolean,
> =
  | Pick<
      QueryParams<TResult, TError, TIsBackground>,
      | 'dataStorage'
      | 'backgroundStatusStorage'
      | 'onError'
      | 'statusStorage'
      | 'submitValidity'
      | 'fetchPolicy'
      | 'enabledAutoFetch'
    >
  | Pick<
      InfiniteQueryParams<TResult, TError, TIsBackground>,
      | 'dataStorage'
      | 'backgroundStatusStorage'
      | 'onError'
      | 'statusStorage'
      | 'submitValidity'
      | 'fetchPolicy'
      | 'enabledAutoFetch'
    >;

/**
 * Сервис, позволяющий кэшировать данные.
 */
export class MobxQuery<TDefaultError = void> {
  /**
   * объект соответствия хешей ключей и их значений
   */
  private keys = new Map<KeyHash, CacheKey[]>();

  /**
   * Map соответствия хешей ключей к запомненным сторам
   */
  private queriesMap = new AdaptableMap<CachedQuery<unknown, unknown, false>>();

  /**
   * фабрика создания хранилищ данных для обычного Query
   */
  private queryDataStorageFactory = new DataStorageFactory();

  /**
   * фабрика создания хранилищ статусов между экземплярами Query и экземллярами Infinite Query.
   */
  private statusStorageFactory = new StatusStorageFactory();

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

    [...this.keys.keys()].forEach((keyHash) => {
      const key = this.keys.get(keyHash);

      if (!key) {
        return;
      }

      // проверяем, есть ли пересечение между закешированными ключами и набором ключей для инвалидации
      const hasTouchedElement = key.some((valuePart) =>
        keysSet.has(this.serialize(valuePart)),
      );

      if (hasTouchedElement) {
        const query = this.queriesMap.get(keyHash);

        if (query) {
          query.invalidate();
          // конвертируем инвалидированный квери в слабый,
          // чтобы сборщик мусора мог удалить неиспользуемые квери
          this.queriesMap.convertToWeak(keyHash);
        }
      }
    });
  };

  // метод для подтверждения того, что квери успешно получил валидные данные
  private submitValidity = (keyHash: KeyHash) => {
    // конвертируем квери в сильный,
    // чтобы сборщик мусора не удалил наш кеш преждевременно
    this.queriesMap.convertToStrong(keyHash);
  };

  /**
   * метод инвалидации всех query
   */
  public invalidateQueries = () => {
    [...this.keys.keys()].forEach((keyHash) => {
      this.queriesMap.get(keyHash)?.invalidate();
      this.queriesMap.convertToWeak(keyHash);
    });
  };

  /**
   * метод, который занимается проверкой наличия квери по ключу,
   * и если нет, создает новый, добавляет его к себе в память, и возвращает его пользователю
   */
  private getCachedQuery = <TResult, TError, TIsBackground extends boolean>(
    key: CacheKey[],
    createStore: (
      internalParams: InternalCreateQueryParams<TResult, TError, TIsBackground>,
    ) => CachedQuery<TResult, TError, TIsBackground>,
    type: QueryType,
    createParams?: FallbackableCreateParams<TResult, TError, TIsBackground>,
  ) => {
    const fetchPolicy = createParams?.fetchPolicy || this.defaultFetchPolicy;
    const keys = this.makeKeys(
      key,
      fetchPolicy,
      createParams?.isBackground ?? false,
      type,
    );

    const cached = this.queriesMap.get(keys.queryKeyHash);

    if (cached) {
      return cached;
    }

    const store = createStore({
      onError: (createParams?.onError ||
        this.defaultErrorHandler) as OnError<TError>,
      enabledAutoFetch:
        createParams?.enabledAutoFetch ?? this.defaultEnabledAutoFetch,
      fetchPolicy: fetchPolicy,
      dataStorage: this.queryDataStorageFactory.getStorage<TResult>(
        keys.dataKeyHash,
      ),
      statusStorage: this.statusStorageFactory.getStorage<TError>(
        keys.statusKeyHash,
      ),
      backgroundStatusStorage: this.getBackgroundStatusStorage<
        TError,
        TIsBackground
      >(
        keys.backgroundStatusKeyHash,
        Boolean(createParams?.isBackground) as TIsBackground,
      ),
      submitValidity: () => this.submitValidity(keys.queryKeyHash),
    });

    this.queriesMap.set(
      keys.queryKeyHash,
      store as CachedQuery<unknown, unknown, false>,
    );

    this.keys.set(keys.queryKeyHash, keys.queryKey);

    // Ожидается, что network-only квери не должны кешироваться,
    // но, с введением StrictMode в реакт 18, проявилась проблема,
    // что network-only квери, созданные в одном реакт компоненте,
    // создаются дважды (т.к. все хуки вызываются дважды)
    // и т.к. мы не ограничиваем момент запроса,
    // то можем получить эффект, что оба network-only квери
    // делают по отдельному запросу к данным единомоментно,
    if (fetchPolicy === 'network-only') {
      setTimeout(() => {
        this.queriesMap.delete(keys.queryKeyHash);
        this.keys.delete(keys.queryKeyHash);
      }, DEFAULT_TIME_TO_CLEAN);
    }

    return store;
  };

  private makeKeys = (
    rootKey: CacheKey[],
    fetchPolicy: FetchPolicy,
    isBackground: boolean,
    type: QueryType,
  ) => {
    const queryKey = [...rootKey, { fetchPolicy, isBackground, type }];
    const queryKeyHash = this.serialize(queryKey);
    const dataKeyHash = this.serialize([...rootKey, { type }]);
    const statusKeyHash = this.serialize([...rootKey, { type }]);
    const backgroundStatusKeyHash = this.serialize([
      ...rootKey,
      { type, isBackground },
    ]);

    return {
      queryKey,
      queryKeyHash,
      statusKeyHash,
      backgroundStatusKeyHash,
      dataKeyHash,
    };
  };

  private getBackgroundStatusStorage = <TError, TIsBackground extends boolean>(
    keyHash: KeyHash,
    hasBackground: TIsBackground,
  ) =>
    (hasBackground
      ? this.statusStorageFactory.getStorage(keyHash)
      : null) as TIsBackground extends true ? StatusStorage<TError> : null;

  /**
   * метод создания стора, кешируется
   */
  createQuery = <
    TResult,
    TError = TDefaultError,
    TIsBackground extends boolean = false,
  >(
    key: CacheKey[],
    executor: QueryExecutor<TResult>,
    params?: CreateQueryParams<TResult, TError, TIsBackground>,
  ) =>
    this.getCachedQuery<TResult, TError, TIsBackground>(
      key,
      (internalParams) =>
        new Query(executor, {
          ...params,
          ...internalParams,
          dataStorage: internalParams.dataStorage as DataStorage<TResult>,
        }),
      Query.name,
      params,
    ) as Query<TResult, TError, TIsBackground>;

  /**
   * метод создания инфинит стора, кешируется
   */
  createInfiniteQuery = <
    TResult,
    TError = TDefaultError,
    TIsBackground extends boolean = false,
  >(
    key: CacheKey[],
    executor: InfiniteExecutor<TResult>,
    params?: CreateInfiniteQueryParams<TResult, TError, TIsBackground>,
  ) =>
    this.getCachedQuery<TResult, TError, TIsBackground>(
      key,
      (internalParams) =>
        new InfiniteQuery(executor, {
          ...params,
          ...internalParams,
          dataStorage: internalParams.dataStorage as DataStorage<TResult[]>,
        }),
      InfiniteQuery.name,
      params,
    ) as InfiniteQuery<TResult, TError, TIsBackground>;

  /**
   * метод создания мутации, не кешируется
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
