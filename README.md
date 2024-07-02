# @astral/mobx-query

Библиотека для кеширования запросов.

Особенности:
- Ориентирована на специфику frontend приложений
- Для обеспечения реактивности используется [mobx](https://mobx.js.org/)
- По идеологии использования схожа с [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query/)
- TS only, totally no `any`

---

## Table of contents
- [Installation](#installation)
- [Basic meaning](#basic-meaning)
- [Варианты использования query](#варианты-использования-query)
  - [Ручной синхронный](#1-ручной-синхронный)
  - [Ручной асинхронный](#2-ручной-асинхронный)
  - [Автоматический](#3-автоматический)
- [Инвалидация данных](#инвалидация-данных)
  - [Особенности инвалидации](#особенности-инвалидации)
- [Ручная установка данных в кэш](#ручная-установка-данных-в-кэш)
- [InfiniteQuery](#infinitequery)
  - [isEndReached](#isendreached)
- [Mutation](#mutation)
  - [Sync вариация](#sync-вариация)
  - [Async вариация](#async-вариация)
- [Fetch policy](#fetchpolicy)
- [Вспомогательные флаги и поля](#вспомогательные-флаги-и-поля)
  - [isLoading](#isloading)
  - [isSuccess](#issuccess)
  - [isError](#iserror)
  - [error](#error)
- [Тестирование](#тестирование)
  - [Тестирование при включенном enabledAutoFetch](#тестирование-при-включенном-enabledautofetch)

# Installation

```shell
npm i --save @astral/mobx-query
```

```shell
yarn add @astral/mobx-query
```

---

# Basic meaning
- executor - исполнитель запроса, который будет совершать запрос. Второй аргумент при создании query
- enabledAutoFetch - включает автоматический запрос данных при обращении к полю `data`.
- fetchPolicy - политика, говорящая о том, как следует работать с новыми запросами
    - 'cache-first' - политика применяемая по умолчанию, при отсутствии данных в памяти, будет исполнен executor, его ответ запишется в кеш, и при последующих обращениях данные будут взяты из кеша
    - 'network-only' - каждый запрос будет приводить к вызову executor, его ответ будет записан в кеш(для использования в cache-first)

# Basic usage

Для начала вам потребуется создать инстанс кеш сервиса
```ts
import { MobxQuery } from '@astral/mobx-query';

const mobxQuery = new MobxQuery({
    onError: (error) => {
        console.log(error); // место для вашей обработки ошибок по умолчанию, опционально
    },
    fetchPolicy: 'cache-first', // 'cache-first' по умолчанию, опционально 
    enabledAutoFetch: false, // false по умолчанию, опционально
});
```

# Варианты использования query
## 1. Ручной синхронный.

Можно вызывать встроенный метод `sync`, передавая в него колбэк опциональные параметры `onSucess` и `onError`. В onSuccess будут переданы полученные данные от успешного запроса, а в `onError`, соответственно, будет переданы данные ошибки в случае провального запроса.
Если при вызове обработчик `onError` не был передан, вызовется стандартный, переданный при создании MobxQuery инстанса.

```ts
const query = mobxQuery.createQuery(
    ['some cache key'],
    () => Promise.resolve('foo'),
);

query.sync({
    onSuccess: (data) => {
        console.log(data); // место для реагирования на ответ
    },
    onError: (error) => {
        console.log(error); // место для вашей ошибки
    }
});
```

**[Пример в sandbox](https://codesandbox.io/s/adoring-wing-z8s9ng)**

## 2. Ручной асинхронный.

Можно вызвать встроенный метод async. Возвращает промис, соответственно в then попадут данные успешного запроса.
`Будьте внимательны, используя метод "async", позаботьтесь о добавлении ".catch", иначе ошибка запроса попадет в глобальный exception`.

```ts
const query = mobxQuery.createQuery(
    ['some cache key'],
    () => Promise.resolve('foo'),
);

query
    .async()
    .then((data) => {
        console.log(data); // место для реагирования на ответ
    })
    .catch((e) => {
        console.log(e); // место для вашей ошибки
    });
```
**[Пример в sandbox](https://codesandbox.io/s/mobx-query-simple-async-k75tfg)**

## 3. Автоматический.

При создании query, предусмотрен вариант автоматического запроса при обращении к полю `data` из `query`. Требуется активация флага `enabledAutoFetch` при создании query, либо установка стандартного значения, при создании MobxQuery инстанса.
Т.е. благодаря реактивности предоставляемой `mobx`, пока не произойдет считывания поля `data` или же не будут вызваны `sync/async` методы, запрос данных так же не произойдет.

```tsx
import { observer } from 'mobx-react-lite';

const query = mobxQuery.createQuery(
    ['some cache key'],
    () => Promise.resolve('foo'),
    { enabledAutoFetch: true }
);

const MyComponent = observer(() => <div>{query.data}</div>) // <div>foo</div>
```
**[Пример в sandbox](https://codesandbox.io/s/happy-cherry-ytqgry)**

# Инвалидация данных
Существует необходимость инвалидировать данные, типичным примером являются [CRUD операции](https://ru.wikipedia.org/wiki/CRUD).
В контексте нашей библиотеки, инвалидация подразумевает под собой отметку для query, означающую, что данные устарели, и их необходимо обновить.
Для корректной работы инвалидации, при создании query требуется использование `ключа`.
Ключ для создания может быть как примитивом, так и объектом. Главное, чтобы они были подходящими для JSON сериализации.

Инстанс MobxQuery содержит специальный метод `invalidate`, принимающий в качестве аргумента `массив ключей`.

```ts
const query = mobxQuery.createQuery(
    ['some cache key'],
    () => Promise.resolve('foo'),
    { enabledAutoFetch: true }
);

mobxQuery.invalidate(['some cache key'])
```

**[Пример в sandbox](https://codesandbox.io/s/mobx-query-invalidate-query-hhcngr)**

## Особенности инвалидации
- Как при создании query, так и при инвалидации, нужно использовать массив ключей. Предполагается, что query может быть инвалидирован по нескольким ключам
```ts
const query = mobxQuery.createQuery(
    ['key one', 'key two'], // ключ - массив строк
    () => Promise.resolve('foo'),
    { enabledAutoFetch: true }
);

mobxQuery.invalidate(['key two']); // query будет инвалидирован
mobxQuery.invalidate(['key one']); // query будет инвалидирован
```
Но, стоит учитывать, что ключом является цельный элемент массива, а не составляющие элемента
```ts
const query = mobxQuery.createQuery(
    [['key one', 'key two']], // ключ - двумерный массив строк
    () => Promise.resolve('foo'),
    { enabledAutoFetch: true }
);

mobxQuery.invalidate(['key one']); // ключ не совпадает, query НЕ будет инвалидирован
```

- Инвалидация будет происходить только для query, поле `data` которых считывается в данный момент. Для query, `data` которых будут отрендерены позже, запрос произойдет только в момент использования. Для превентивного обновления данных потребуется последовательное использование `sync/async` методов сразу после `invalidate`.

### Массовая инвалидация
Для инвалидации всех query необходимо использовать метод `invalidateQueries`
```ts
mobxQuery.invalidateQueries();
```

# Ручная установка данных в кэш

Для установки данных, без исполнения executor, используйте метод `forceUpdate`. При вызове все статусные флаги устанавливаются как success состояние

```ts
query.forceUpdate('foo');
```

# InfiniteQuery
Существует необходимость постепенного запроса массивов данных, в постраничном режиме. Типичный пример, инфинити скролл, когда новая пачка данных запрашивается, в момент когда пользователь докрутил список до конца.
Для удобства, мы создали специальный `query`, который содержит дополнительный метод `fetchMore` и при вызове оного, происходит запрос с увеличенными счетчиками. Данные ответа на этот запрос, будут сконкатенированы с уже имеющимся. В случае, если количество данных меньше, чем длина страницы, будет считаться что мы дошли до конца списка.
В `executor` будет передан объект с `offset` - количество элементов отступа от начала списка, и `count` - количество элементов на одну страницу.

Значение `count` и увеличение `offset` регулируется опциональным параметром `incrementCount` при создании `query`. По умолчанию равен `30`.

```ts
import { when } from 'mobx';

const query = mobxQuery.createInfiniteQuery(
    ['some cache key'],
    ({ offset, count }) => {
        // можно использовать "offset/count" для необходимых преобразований и последующего запроса к api
        return Promise.resolve(['foo'])
    },
    {
        incrementCount: 30, // опционально, по умолчанию 30
    }
);

await query.async();

console.log(query.data); // ['foo'] 

query.fetchMore();
await when(() => !query.isLoading); // ждем фоновой загрузки

console.log(query.data); // ['foo', 'foo'] 
``` 
## isEndReached
Для определения того, что мы все таки достигли конца списка, присутствует флаг `isEndReached`.

```ts
const query = mobxQuery.createInfiniteQuery(
    ['some cache key'],
    () => Promise.resolve([]),
);

await query.async();

console.log(query.isEndReached); // true
``` 

**[Пример в sandbox](https://codesandbox.io/s/mobx-query-infinityquery-sdcc6g)**

# Mutation
Для изменения данных необходимо использовать mutation. Ответы Mutation не кэшируются.

```ts
const mutation = mobxQuery.createMutation(
    (params) => {
        console.log(params); // при необходмости, можем использовать опциональные параметры
        return Promise.resolve('foo');
    },
);
```
**[Пример в sandbox](https://codesandbox.io/s/mobx-query-mutation-p2pnct)**

## async вариация
```ts
mutation
    .async('bar') // тут, по нашему примеру, увидим консоль 'bar'
    .then((data) => {
        console.log(data) // а тут уже 'foo'
    }); 
```

## sync вариация
```ts
mutation.sync({
    params: 'bar',    
    onSuccess: (data) => {
        console.log(data) // а тут уже 'foo'
    }
}); // тут, по нашему примеру, увидим консоль 'bar'
```

# fetchPolicy

```ts
const cacheFirstQuery = mobxQuery.createQuery(
    ['cache-first key'],
    () => {
        console.log('cache-first request');
        return Promise.resolve('foo');
    },
    {
        fetchPolicy: 'cache-first',
    }
);

const networkOnlyQuery = mobxQuery.createQuery(
    ['network-only key'],
    () => {
        console.log('network-only request');
        return Promise.resolve('bar');
    },
    {
        fetchPolicy: 'network-only',
    }
);

await cacheFirstQuery.async(); // увидим консоль 'cache-first request'
await networkOnlyQuery.async(); // увидим консоль 'network-only request'

await cacheFirstQuery.async(); // вызова executor не произойдет, и консоль не выведется
await networkOnlyQuery.async(); // вновь увидим консоль 'network-only request'

const duplicateCacheFirstQuery = mobxQuery.createQuery(
        ['cache-first key'], // использован тот же самый ключ, что и для cacheFirstQuery
        () => {
          console.log('duplicate cache-first request');
          return Promise.resolve('foo');
        }
);

await duplicateCacheFirstQuery.async(); // вызова executor не произойдет, и консоль не выведется
```
**[Пример в sandbox](https://codesandbox.io/s/mobx-query-fetchpolicy-wvh8jl)**

# Вспомогательные флаги и поля
`Query`, `InfiniteQuery` и `Mutation` имеют одинаковый набор вспомогательных флагов и полей, работающих по единому принципу.

## isLoading
Boolean флаг, указывающий на процесс выполнения запроса
## isSuccess
Boolean флаг, указывающий на успешное выполнение запроса
## isError
Boolean флаг, указывающий на провалившийся запрос
## isIdle
Boolean флаг, указывающий на простаивание query, первый же вызов запроса переключит его в false
## error
Поле, содержащее информацию о последней ошибке

```ts
const query = mobxQuery.createQuery(
    ['some cache key'],
    () => Promise.reject('foo'),
);

await query
    .async()
    .catch((e) => {
        console.log(e); // 'foo'
    });

console.log(query.isError); // 'true'
console.log(query.error); // 'foo'
```

## Режим фонового обновления
`Query` и `InfiniteQuery` имеют режим фонового обновления. Предполагается, что будет хорошо подходить для обновления данных через websocket.

В этом режиме, основные статусные флаги `isSuccess`, `isLoading`, `isError`, `error` будут изменяться до первого успешного запроса. Последующие запросы уже будут изменять статусные флаги под полем `backgroundStatus`

```ts
const query = mobxQuery.createQuery(
    ['some cache key'],
    () => Promise.resolve('foo'),
    { isBackground: true }
);

await query.async();
console.log(query.isLoading); // переключался в true на момент запроса
console.log(query.isSuccess); // true

query.invalidate();
await query.async();
console.log(query.isLoading); // не изменялся
console.log(query.isSuccess); // остался неизменным - true

console.log(query.backgroundStatus.isLoading); // переключался в true на момент обновления
console.log(query.backgroundStatus.isSuccess); // true
```

# Тестирование

## Тестирование при включенном ```enabledAutoFetch```

### Исходный код

```MobxQuery``` инициализируется с параметром: ```enabledAutoFetch```:
```ts
const createMobxQuery = () => new MobxQuery<ApiDataError>({
  enabledAutoFetch: true,
});
```

```BookRepository``` - фасад для работы с данными, который использует MobxQuery:
```ts
export class BookRepository {
  constructor(private readonly mobxQuery: MobxQuery) {}

  public getBookListQuery = (params: BookRepositoryDTO.BookListInputDTO) =>
    this.mobxQuery.createQuery<BookRepositoryDTO.BookListDTO>(
      ['book-list', params],
      () =>
          apiHttpClient.get('/books', {
              params,
          }),
    );
}
```

```BooksListStore``` - использует BookRepository для получения данных:
```ts
class BooksListStore {
  public sort?: SortData;

  constructor(private readonly bookRepository: BookRepository) {
    makeAutoObservable(this);
  }

  private get listQuery() {
    return this.bookRepository.getBookListQuery(this.sort);
  }

  public get list(): ListItem[] {
    const data = this.listQuery.data?.data || [];

    return data.map(({ id, name, price }) => ({
      id,
      name,
      price: formatPriceToView(price),
    }));
  }
}
```

### Тест

```ts
import { when } from 'mobx';

describe('BooksListStore', () => {
  it('Список книг форматируется для отображения', async () => {
    // Для каждого теста необходимо инициализировать свой instance MobxQuery,
    // иначе будет проблема состояния гонки при выполнении нескольких тестов
    const mobxQuery = createMobxQuery();

    const fakeBookList = makeFakeBookList(2, { price: 1000 });
    const fakeBookListItem = fakeBookList.data[0];

    const bookRepositoryMock = mock<BookRepository>({
      // Подменяем реализацию метода для того, чтобы получить ожидаемый результат
      getBookListQuery: () =>
          // Создаем моковый Query, соответствующий интерфейсу BookRepository
          mobxQuery.createQuery(['id'], async () => fakeBookList),
    });

    const sut = new GoodsListStore(bookRepositoryMock);

    // Ждем автоматической загрузки данных
    // Загрузка данных начнется автоматически при обращении к sut.list за счет параметра enabledAutoFetch
    await when(() => Boolean(sut.list?.length));

    expect(sut.list[0]).toMatchObject({
      id: fakeBookListItem.id,
      name: fakeBookListItem.name,
      price: '1 000 руб.',
    });
  });
});
```

