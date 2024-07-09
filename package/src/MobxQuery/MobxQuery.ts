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
 * Время, спустя которое, запись о query c network-only будет удалена
 */
const DEFAULT_TIME_TO_CLEAN = 100;

/**
 * Стандартный обработчик ошибки запроса,
 * будет вызван, если при вызове sync не был передан отдельный onError параметр
 */
type OnError<TError = unknown> = (error: TError) => void;

/**
 * Хэш ключа
 */
type KeyHash = string;

type MobxQueryParams = {
  /**
   * Политика получения данных по умолчанию.
   * @enum cache-first - данные сначала берутся из кеша, если их нет, тогда идет обращение к сети, ответ записывается в кэш
   * @enum network-only - данные всегда берутся из сети, при этом ответ записывается в кэш
   */
  fetchPolicy?: FetchPolicy;
  /**
   * обработчик ошибок по умолчанию
   */
  onError?: OnError;
  /**
   * Флаг, отвечающий за автоматический запрос данных при обращении к полю data по умолчанию.
   * @default false
   */
  enabledAutoFetch?: boolean;
};

type CreateQueryParams<TResult, TError, TIsBackground extends boolean> = Omit<
  QueryParams<TResult, TError, TIsBackground>,
  'dataStorage' | 'statusStorage' | 'backgroundStatusStorage' | 'submitValidity'
> & {
  /**
   * Режим фонового обновления
   * @default false
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
   * Режим фонового обновления
   * @default false
   */
  isBackground?: TIsBackground;
};

type QueryType = typeof Query.name | typeof InfiniteQuery.name;

/**
 * Внутриний тип кешируемого стора
 */
type CachedQuery<TResult, TError, TIsBackground extends boolean> =
  | Query<TResult, TError, TIsBackground>
  | InfiniteQuery<TResult, TError, TIsBackground>;

/**
 * Параметры поддающиеся установке значению по умолчанию
 */
type FallbackAbleCreateParams<TResult, TError, TIsBackground extends boolean> =
  | Pick<
      CreateQueryParams<TResult, TError, TIsBackground>,
      'onError' | 'fetchPolicy' | 'enabledAutoFetch' | 'isBackground'
    >
  | Pick<
      CreateInfiniteQueryParams<TResult, TError, TIsBackground>,
      'onError' | 'fetchPolicy' | 'enabledAutoFetch' | 'isBackground'
    >;

/**
 * Объединяющий тип параметров рассчитываемых внутренней логикой для создания квери
 */
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
   * Объект соответствия хешей ключей и их значений
   */
  private keys = new Map<KeyHash, CacheKey[]>();

  /**
   * Map соответствия хешей ключей к запомненным сторам
   */
  private queriesMap = new AdaptableMap<CachedQuery<unknown, unknown, false>>();

  /**
   * Фабрика создания хранилищ данных для обычного Query
   */
  private queryDataStorageFactory = new DataStorageFactory();

  /**
   * Фабрика создания хранилищ статусов между экземплярами Query и экземллярами Infinite Query.
   */
  private statusStorageFactory = new StatusStorageFactory();

  /**
   * Стандартный обработчик ошибок, будет использован, если не передан другой
   */
  private readonly defaultErrorHandler?: OnError;

  /**
   * Стандартное поведение политики кеширования
   */
  private readonly defaultFetchPolicy: FetchPolicy;

  /**
   * Флаг, отвечающий за автоматический запрос данных при обращении к полю data
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
   * Метод для инвалидации по списку ключей,
   * предполагается использование из домена
   */
  public invalidate = (keysParts: CacheKey[]) => {
    // Сет сериализовонных ключей
    const keysSet = new Set(keysParts.map(this.serialize));

    [...this.keys.keys()].forEach((keyHash) => {
      const key = this.keys.get(keyHash);

      if (!key) {
        return;
      }

      // Проверяем, есть ли пересечение между закешированными ключами и набором ключей для инвалидации
      const hasTouchedElement = key.some((valuePart) =>
        keysSet.has(this.serialize(valuePart)),
      );

      if (hasTouchedElement) {
        const query = this.queriesMap.get(keyHash);

        if (query) {
          query.invalidate();
          // Конвертируем инвалидированный квери в слабый,
          // чтобы сборщик мусора мог удалить неиспользуемые квери
          this.queriesMap.convertToWeak(keyHash);
        }
      }
    });
  };

  // Метод для подтверждения того, что квери успешно получил валидные данные
  private submitValidity = (keyHash: KeyHash) => {
    // конвертируем квери в сильный,
    // чтобы сборщик мусора не удалил наш кеш преждевременно
    this.queriesMap.convertToStrong(keyHash);
  };

  /**
   * Метод инвалидации всех query
   */
  public invalidateQueries = () => {
    [...this.keys.keys()].forEach((keyHash) => {
      this.queriesMap.get(keyHash)?.invalidate();
      this.queriesMap.convertToWeak(keyHash);
    });
  };

  /**
   * Метод, который занимается проверкой наличия квери по ключу,
   * и если нет, создает новый, добавляет его к себе в память, и возвращает его пользователю
   */
  private getCachedQuery = <TResult, TError, TIsBackground extends boolean>(
    key: CacheKey[],
    createInstance: (
      internalParams: InternalCreateQueryParams<TResult, TError, TIsBackground>,
    ) => CachedQuery<TResult, TError, TIsBackground>,
    type: QueryType,
    createParams?: FallbackAbleCreateParams<TResult, TError, TIsBackground>,
  ) => {
    const fetchPolicy = createParams?.fetchPolicy || this.defaultFetchPolicy;
    const keys = this.makeKeys(
      key,
      fetchPolicy,
      createParams?.isBackground ?? false,
      type,
    );

    const cachedQuery = this.queriesMap.get(keys.queryKeyHash);

    if (cachedQuery) {
      return cachedQuery;
    }

    const query = createInstance({
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
      query as CachedQuery<unknown, unknown, false>,
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

    return query;
  };

  /**
   * Метод для создания ключей к внутренним хранилищам
   */
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
   * Метод создания стора, кешируется
   */
  public createQuery = <
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
   * Метод создания инфинит стора, кешируется
   */
  public createInfiniteQuery = <
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
   * Метод создания мутации, не кешируется
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
