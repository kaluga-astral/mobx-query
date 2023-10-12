import { CacheKey } from '../types';

type ExpireInspectorItem = {
  /**
   * @description временной промежуток в мс, означающий что по его истечению нужно будет обновить данные
   */
  timeToLive: number;
  /**
   * @description запись говорящая о том, когда данные были последний раз были обновлены
   */
  expireAt?: number;
  /**
   * @description флаг говорящий о том, что данные не актуальны
   */
  isExpired: boolean;
};

type ExpireInspectorParams = {
  /**
   * @description метод для инвалидации по массиву хешей
   */
  invalidate: (keys: CacheKey[]) => void;
};

/**
 * @description сущность для слежки за сроком годности данных
 */
export class ExpireInspector {
  private params: ExpireInspectorParams;

  private items: Map<string, ExpireInspectorItem> = new Map();

  private timer?: number;

  constructor(params: ExpireInspectorParams) {
    this.params = params;
    this.init();
  }

  /**
   * @description метод для подключения к инспектору
   */
  public connect = (key: CacheKey[], timeToLive: number) => {
    const keyHash = JSON.stringify(key);

    if (!this.items.has(keyHash)) {
      this.items.set(keyHash, {
        timeToLive,
        isExpired: true,
      });
    }
  };

  /**
   * @description метод, вызываемый в момент установки данных
   */
  public update = (key: CacheKey[]) => {
    const keyHash = JSON.stringify(key);
    const current = this.items.get(keyHash);

    if (current) {
      this.items.set(keyHash, {
        ...current,
        isExpired: false,
        expireAt: Date.now() + current.timeToLive,
      });

      this.setTimer();
    }
  };

  /**
   * @description метод проверяющий элементы на срок годности
   */
  private checkItems = () => {
    // т.к. сафари ниже 14.1 не поддерживает эвент изменения стейта,
    // но поддерживает document.visibilityState
    // делаем тут доп проверку активности
    if (globalThis.document?.visibilityState === 'hidden') {
      return;
    }

    const currentDate = Date.now();

    const keysToInvalidate: CacheKey[] = [];

    this.items.forEach((item, keyHash) => {
      const isExpired =
        !item.isExpired && item.expireAt && item.expireAt <= currentDate;

      if (isExpired) {
        this.items.set(keyHash, { ...item, isExpired: true });
        keysToInvalidate.push(JSON.parse(keyHash));
      }
    });

    if (keysToInvalidate.length) {
      this.params.invalidate(keysToInvalidate.flat(1));
    }
  };

  /**
   * @description обработчик активации вкладки с приложением
   */
  public handleVisibleState = () => {
    this.checkItems();
    this.setTimer();
  };

  /**
   * @description обработчик деактивации вкладки с приложением
   */
  public handleHiddenState = () => {
    clearTimeout(this.timer);
  };

  private clearTimer = () => {
    clearTimeout(this.timer);
    this.timer = undefined;
  };

  private init = () => {
    globalThis.document?.addEventListener('visibilitychange', () => {
      if (globalThis.document?.visibilityState === 'visible') {
        this.handleVisibleState();
      } else {
        this.handleHiddenState();
      }
    });
  };

  /**
   * @description метод для поиска значения следующего таймера
   */
  public findNextTime = () => {
    const currentDate = Date.now();

    let time = Infinity;

    this.items.forEach(({ isExpired, expireAt }) => {
      const isValid = !isExpired && expireAt;

      if (!isValid) {
        return;
      }

      const diff = expireAt - currentDate;

      if (diff < time) {
        time = diff;
      }
    });

    if (time < 0) {
      return 0;
    }

    return time;
  };

  private setTimer = () => {
    // делаем предварительную очистку,
    // т.к. таймер может быть уже запущен
    if (this.timer) {
      this.clearTimer();
    }

    const nextTime = this.findNextTime();

    if (nextTime === Infinity) {
      return;
    }

    this.timer = (globalThis as unknown as Window).setTimeout(() => {
      this.timer = undefined;
      this.checkItems();
      this.setTimer();
    }, nextTime);
  };
}
