import { describe, expect, it, vi } from 'vitest';

import { ExpireInspector } from './ExpireInspector';

describe('ExpireInspector tests', () => {
  vi.useFakeTimers();

  it('connect:no-update по истечении времени invalidate не вызывается', () => {
    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
      timeToUpdate: 100,
      invalidate: onInvalidate,
    });

    inspector.connect(['foo'], 50);
    vi.runOnlyPendingTimers();
    expect(onInvalidate).not.toBeCalled();
  });

  it('connect:update:timeToLive<timeToUpdate по истечении времени invalidate вызывается', () => {
    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
      timeToUpdate: 100,
      invalidate: onInvalidate,
    });

    const key = ['foo'];

    inspector.connect(key, 50);
    inspector.update(key);
    vi.runOnlyPendingTimers();
    expect(onInvalidate).toBeCalled();
  });

  it('connect:update:timeToLive>timeToUpdate по истечении времени invalidate не вызывается', () => {
    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
      timeToUpdate: 100,
      invalidate: onInvalidate,
    });

    inspector.connect(['foo'], 200);
    inspector.update(['foo']);
    vi.runOnlyPendingTimers();
    expect(onInvalidate).not.toBeCalled();
  });

  it('connect:update:tab-hidden:timeToLive<timeToUpdate invalidate не вызывается', () => {
    const currentDate = new Date();

    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
      timeToUpdate: 100,
      invalidate: onInvalidate,
    });

    const fooKey = ['foo'];
    const barKey = ['bar'];

    inspector.connect(fooKey, 50);
    inspector.connect(barKey, 5000);
    inspector.update(fooKey);
    inspector.update(barKey);
    // имитируем переключение пользователя на другую вкладку
    inspector.handleHiddenState();
    // имитируем отсутствие пользователя в течении какого то времени
    vi.setSystemTime(+currentDate + 1000);
    vi.runOnlyPendingTimers();

    expect(
      onInvalidate,
      'пока пользователь был не активен, ничего не происходит',
    ).not.toBeCalled();

    // пользователь вернулся на вкладку
    inspector.handleVisibleState();

    expect(
      onInvalidate,
      'как пользователь вернулся, инвалидируем истекшие данные',
    ).toBeCalledWith([fooKey]);
  });
});
