import { describe, expect, it } from 'vitest';

import { StatusStorage } from './StatusStorage';

describe('StatusStorage', () => {
  describe('При создании хранилища', () => {
    const sut = new StatusStorage();

    it('Флаг загрузки false', () => {
      expect(sut.isLoading).toBeFalsy();
    });

    it('Флаг ошибки false', () => {
      expect(sut.isError).toBeFalsy();
    });

    it('Флаг успеха false', () => {
      expect(sut.isSuccess).toBeFalsy();
    });

    it('Данные об ошибке undefined', () => {
      expect(sut.error).toBeUndefined();
    });
  });
});
