/**
 * @description утилита возвращающая массив ключей объекта
 * стандартный Object.keys переводит все ключи объекта в string,
 * и поэтому у нас случаются проблемы с типами,
 * эта утилита призвана решить эту проблему
 */
export const objectKeys = <T extends {}>(obj: T) =>
  Object.keys(obj) as [keyof T];
