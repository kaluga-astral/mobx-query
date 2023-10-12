import { describe, expect, it, vi } from 'vitest';

import { ExpireInspector } from './ExpireInspector';

describe('ExpireInspector tests', () => {
  vi.useFakeTimers();

  it('connect:no-update по истечении времени invalidate не вызывается', () => {
    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
      invalidate: onInvalidate,
    });

    inspector.connect(['foo'], 50);
    vi.runOnlyPendingTimers();
    expect(onInvalidate).not.toBeCalled();
  });

  it('findNextTime:no-update время до вызова - бесконечность', () => {
    const inspector = new ExpireInspector({
      invalidate: vi.fn(),
    });

    const keyFoo = ['foo'];

    inspector.connect(keyFoo, 500);

    const timeToNextCall = inspector.findNextTime();

    expect(timeToNextCall).toBe(Infinity);
  });

  it('findNextTime:update время до вызова - для элемент для которого был вызван update', () => {
    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
      invalidate: onInvalidate,
    });

    const keyFoo = ['foo'];
    const keyBar = ['bar'];

    inspector.connect(keyFoo, 500);
    inspector.connect(keyBar, 100);
    inspector.update(keyFoo);

    const timeToNextCall = inspector.findNextTime();

    expect(timeToNextCall).toBe(500);
  });

  it('findNextTime:update время до вызова - минимальный из имеющихся', () => {
    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
      invalidate: onInvalidate,
    });

    const keyFoo = ['foo'];
    const keyBar = ['bar'];

    inspector.connect(keyFoo, 500);
    inspector.connect(keyBar, 100);
    inspector.update(keyFoo);
    inspector.update(keyBar);

    const timeToNextCall = inspector.findNextTime();

    expect(timeToNextCall).toBe(100);
  });

  it('findNextTime:update:spentSomeTime время до вызова - минимальный из имеющихся', () => {
    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
      invalidate: onInvalidate,
    });

    const keyFoo = ['foo'];
    const keyBar = ['bar'];

    inspector.connect(keyFoo, 600);
    inspector.connect(keyBar, 100);
    inspector.update(keyFoo);
    inspector.update(keyBar);
    // ждем 200 мс, за которые должен сработать один таймер
    vi.advanceTimersByTime(200);

    expect(
      onInvalidate,
      'за истекшее время вызвалась инвалидация для истекшего элемента',
    ).toBeCalledWith(['bar']);

    const timeToNextCall = inspector.findNextTime();

    expect(
      timeToNextCall,
      'до следующего таймера осталась разница между прошедшим временем и следующим',
    ).toBe(400);
  });

  it('connect:update:tab-hidden invalidate не вызывается', () => {
    const currentDate = new Date();

    const onInvalidate = vi.fn();

    const inspector = new ExpireInspector({
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
    ).toBeCalledWith(fooKey);
  });
});
