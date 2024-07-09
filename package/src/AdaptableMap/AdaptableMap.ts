export type SimplifiedMap<TData> = Pick<
  Map<string, TData>,
  'get' | 'delete' | 'has'
> & {
  set: (key: string, value: TData) => void;
};

/**
 * Фасад для работы с Map, хранящим значения как WeakRef
 */
class WeakRefMap<TData extends {}> implements SimplifiedMap<TData> {
  private readonly map = new Map<string, WeakRef<TData> | TData>();

  public get = (key: string) => {
    // Проверка на старые браузеры, не умеющие в WeakRef
    if (!globalThis.WeakRef) {
      return this.map.get(key) as TData | undefined;
    }

    return (this.map.get(key) as WeakRef<TData> | undefined)?.deref?.();
  };

  public set = (key: string, value: TData) => {
    // Проверка на старые браузеры, не умеющие в WeakRef
    if (!globalThis.WeakRef) {
      this.map.set(key, value);
    } else {
      this.map.set(key, new globalThis.WeakRef(value));
    }
  };

  public delete = (key: string) => this.map.delete(key);

  public has = (key: string) => this.map.has(key);
}

/**
 * Фасад для работы с Map, умеющий в конвертацию хранимого значения в "слабое" состояние и в "сильное"
 * По умолчанию все значения хранятся как "слабые".
 * @enum "Слабое" состояние подразумевает то, что хранимое значение сохранено через WeakRef, следовательно, если в системе не останется ссылок на хранимое значение, сборщик мусора сможет удалить это значение из памяти.
 * @enum "Сильное" состояние подразумевает то, что значение хранится как есть, т.е. даже если в системе не останется других ссылок на хранимое значение, сборщик мусора не сможет удалить его из памяти.
 */
export class AdaptableMap<TData extends {}> implements SimplifiedMap<TData> {
  private strong: SimplifiedMap<TData> = new Map<string, TData>();

  private weak: SimplifiedMap<TData> = new WeakRefMap<TData>();

  public get = (key: string): TData | undefined => {
    if (this.strong.has(key)) {
      return this.strong.get(key);
    }

    return this.weak.get(key);
  };

  public set = (key: string, data: TData) => {
    this.weak.set(key, data);
  };

  public delete = (key: string) => {
    // если успешно удалилось в "слабом" хранилище, тогда в "сильном" уже не имеет смысла удалять.
    return this.weak.delete(key) || this.strong.delete(key);
  };

  public has = (key: string) => {
    return Boolean(this.weak.get(key)) || this.strong.has(key);
  };

  /**
   * Метод перемещающий значение из одного Map в другой
   */
  private change = (
    key: string,
    from: SimplifiedMap<TData>,
    to: SimplifiedMap<TData>,
  ) => {
    const query = this.get(key);

    if (query) {
      from.delete(key);
      to.set(key, query);
    }
  };

  /**
   * Метод для конвертации значения из "сильного" в "слабое" состояние
   */
  public convertToWeak = (key: string) => {
    this.change(key, this.strong, this.weak);
  };

  /**
   * Метод для конвертации значения из "слабого" в "сильное" состояние
   */
  public convertToStrong = (key: string) => {
    this.change(key, this.weak, this.strong);
  };
}
