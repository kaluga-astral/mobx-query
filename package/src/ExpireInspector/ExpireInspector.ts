import { CacheKey } from '../types';

type ExpireInspectorItem = {
  /**
   * @description временной промежуток в мс, означающий что по его истечению нужно будет обновить данные
   */
  timeToLive: number;
  /**
   * @description запись говорящая о том, когда данные были последний раз были обновлены
   */
  lastUpdate?: Date;
  /**
   * @description флаг говорящий о том, что данные не актуальны
   */
  isExpired: boolean;
};

type ExpireInspectorParams = {
  /**
   * @description временной промежуток в мс, раз в который будут проверяться кеши на срок годности
   */
  timeToUpdate: number;
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
        lastUpdate: new Date(),
      });
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

    const date = new Date();

    const keysToInvalidate: CacheKey[] = [];

    this.items.forEach((item, keyHash) => {
      const isExpired =
        !item.isExpired &&
        item.lastUpdate &&
        +item.lastUpdate <= +date - item.timeToLive;

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
    clearInterval(this.timer);
  };

  private init = () => {
    this.setTimer();

    globalThis.document?.addEventListener('visibilitychange', () => {
      if (globalThis.document?.visibilityState === 'visible') {
        this.handleVisibleState();
      } else {
        this.handleHiddenState();
      }
    });
  };

  private setTimer = () => {
    this.timer = (globalThis as unknown as Window).setInterval(
      this.checkItems,
      this.params.timeToUpdate,
    );
  };
}
