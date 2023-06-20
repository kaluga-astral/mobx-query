# @astral/mobx-query

[Документация](https://github.com/kaluga-astral/mobx-query/blob/main/README.md)

Библиотека для кеширования запросов. 

Особенности:
- Ориентирована на специфику frontend приложений
- Для обеспечения реактивности используется [mobx](https://mobx.js.org/)
- По идеологии использования схожа с [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query/)
- TS only, totally no `any`

---

# Installation

```shell
npm i --save @astral/mobx-query
```

```shell
yarn add @astral/mobx-query
```

---

# Basic meaning
- executor - исполнитель запроса. Хэндлер, который будет совершать запрос данных. Второй аргумент при создании query
- enabledAutoFetch - настройка, отвечающая за то, что будет происходить автоматический запрос данных при обращении к полю `data`, не актуально для `MutationQuery`.
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

# Несколько вариантов использования
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

## 3. Синхронный полуавтомат.

При вызове метода `sync`, можно не передавать никаких параметров, достаточно просто отдать реактивные данные из query в ваш вью элемент, обернутый `observer` от `mobx`.
В таком случае, данные отобразятся просто в разметке, сразу как появятся.
```tsx
import { observer } from 'mobx-react-lite';

const query = mobxQuery.createQuery(
    ['some cache key'],
    () => Promise.resolve('foo'),
);

query.sync();

const MyComponent = observer(() => <div>{query.data}</div>) // <div>foo</div>
```

## 4. Автоматический.

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

# Инвалидация данных
Существует необходимость инвалидировать данные, типичным примером являются [CRUD операции](https://ru.wikipedia.org/wiki/CRUD).
В контексте нашей библиотеки, инвалидация подразумевает под собой отметку для query, означающую, что данные устарели, и их необходимо обновить.
Для корректной работы инвалидации, при создании query требуется использование `ключа`, c помощью которого и происходит вся магия.
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

# InfiniteQuery
Существует необходимость постепенного запроса массивов данных, в постраничном режиме. Типичный пример, инфинити скролл, когда новая пачка данных запрашивается, в момент когда пользователь докрутил список до конца.
Для удобства, мы создали специальный `query`, который содержит дополнительный метод `fetchMore` и при вызове оного, происходит запрос с увеличенными счетчиками. Данные ответа на этот запрос, будут сконкатенированы с уже имеющимся. В случае, если количество данных меньше, чем длина страницы, будет считаться что мы дошли до конца списка, флаг `isEndReached` будет включен, и последующие вызовы `fetchMore` будут проигнорированы, до тех пор, пока не будет запущена инвалидация.
В `executor` будет передан объект с `offset` - количество элементов отступа от начала списка, и `count` - количество элементов на одну страницу.

Значение `count` и увеличение `offset` регулируется опциональным параметром `incrementCount` при создании `query`. По умолчанию равен `30`.

```ts
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
// ждем фоновой загрузки

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

# Mutation
Существует необходимость делать запросы к api, которые не требуют кеширования, пример - `POST` запросы.
Для этого предназначен дополнительный вид query, который никак не кешируется.

```ts
const mutation = mobxQuery.createMutationQuery(
    (params) => {
        console.log(params); // при необходмости, можем использовать опциональные параметры
        return Promise.resolve('foo');
    },
);
```

async вариация
```ts
mutation
    .async('bar') // тут, по нашему примеру, увидим консоль 'bar'
    .then((data) => {
        console.log(data) // а тут уже 'foo'
    }); 
```

sync вариация
```ts
mutation.sync({
    params: 'bar',    
    onSuccess: (data) => {
        console.log(data) // а тут уже 'foo'
    }
}); // тут, по нашему примеру, увидим консоль 'bar'
```
