export type SimplifiedMap<TData> = Pick<
  Map<string, TData>,
  'get' | 'delete' | 'has'
> & {
  set: (key: string, value: TData) => void;
};

class WeakRefMap<TData extends {}> implements SimplifiedMap<TData> {
  private readonly map = new Map<string, WeakRef<TData> | TData>();

  public get = (key: string) => {
    if (!globalThis.WeakRef) {
      return this.map.get(key) as TData | undefined;
    }

    return (this.map.get(key) as WeakRef<TData> | undefined)?.deref?.();
  };

  public set = (key: string, value: TData) => {
    if (!globalThis.WeakRef) {
      this.map.set(key, value);
    } else {
      this.map.set(key, new globalThis.WeakRef(value));
    }
  };

  public delete = (key: string) => this.map.delete(key);

  public has = (key: string) => this.map.has(key);
}

export class AdaptableMap<TData extends {}> implements SimplifiedMap<TData> {
  public strong: SimplifiedMap<TData> = new Map<string, TData>();

  public weak: SimplifiedMap<TData> = new WeakRefMap<TData>();

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
    return this.weak.delete(key) || this.strong.delete(key);
  };

  public has = (key: string) => {
    return Boolean(this.weak.get(key)) || this.strong.has(key);
  };

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

  public convertToWeak = (key: string) => {
    this.change(key, this.strong, this.weak);
  };

  public convertToStrong = (key: string) => {
    this.change(key, this.weak, this.strong);
  };
}
