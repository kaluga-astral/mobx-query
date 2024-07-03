import { describe, expect, it } from 'vitest';

import { AdaptableMap } from './AdaptableMap';

describe('AdaptableMap', () => {
  it('Метод set устанавливает данные и метод get возвращает данные', () => {
    const sut = new AdaptableMap();

    const data = {};

    sut.set('foo', data);
    expect(sut.get('foo')).toBe(data);
  });

  it('Вызов метода set не возвращает никаких результатов', () => {
    const sut = new AdaptableMap();

    const data = {};

    expect(sut.set('foo', data)).toBeUndefined();
  });
});
