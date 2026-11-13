# API «Круга»

Базовый путь `/api/krug`. Через Next.js — порт 3000, напрямую Express — 4000. Типы: `shared/krug/types.ts`, ограничения: `shared/krug/schemas.ts`. Ответы JSON, ID — 24 hex символа, даты — ISO UTC. Запись: `Content-Type: application/json`, `X-Krug-Client: krug`, cookie браузера. Cookie сессии HttpOnly, область `/api/krug`, не доступна JavaScript.

## Сессия

| Метод и путь | Запрос | Ответ |
| --- | --- | --- |
| GET `/health` | — | `{connected:true,demoMode:boolean}` |
| GET `/reference` | — | `{areas,categories,conditions,itemTypes}` |
| GET `/session` | — | `{user:User|null,demoMode:boolean}` |
| POST `/session/guest` | `{name,areaId}` | 201 `{user}`, Set-Cookie |
| DELETE `/session` | — | 204, удаляет текущую сессию |
| GET `/demo/people` | — | `{people:User[]}` |
| POST `/demo/session` | `{key:"A"}` | `{user}`, Set-Cookie |
| POST `/demo/reset` | `{}` | `{ok:true}`, нужна сессия |

Demo-маршруты возвращают 404 при `DEMO_MODE=false`. Имя 2–40 символов, район из справочника. User: `{id,name,areaId,isDemo,demoKey?}`. Переключение демопрофиля заменяет сессию только этого браузерного контекста.

## Заявки

| Метод и путь | Запрос | Ответ |
| --- | --- | --- |
| GET `/listings` | query ниже | `{items:Listing[],total,page,limit}` |
| GET `/listings/:id` | — | `{listing}` |
| POST `/listings` | ListingInput | 201 `{listing}`, нужна сессия |
| PATCH `/listings/:id` | `{values:ListingInput,version:number}` | `{listing}`, только владелец |
| POST `/listings/:id/archive` | `{version:number}` | `{listing}`, только владелец |

Query: `page=1` (1–10000), `limit=18` (1–50), `search=""` (до 100 символов, название или пожелание), `category=""`, `area=""`, `mine=false`. Обычный каталог показывает active; `mine=true` требует сессию и возвращает все статусы своего владельца. Неизвестный фильтр категории/района даёт пустую выдачу.

Минимальный допустимый ввод:

```json
{
  "title": "Монитор Samsung 24 дюйма",
  "description": "Рабочий монитор с проводами и подставкой.",
  "itemTypeId": "monitor",
  "categoryId": "electronics",
  "condition": "good",
  "wantText": "Хочу велосипед",
  "areaId": "center",
  "wantedTypeIds": ["bicycle"]
}
```

Остальные поля имеют defaults:

| Поле | Тип / лимит / default |
| --- | --- |
| title / description / wantText | строки 3–100 / 10–3000 / 3–1000 |
| itemTypeId / categoryId / condition | справочники; категория соответствует типу |
| wantedTypeIds / wantedCategoryIds | массивы типов до 6 / категорий до 4; `[]` |
| requiredKeywords / excludedKeywords / preferredKeywords | до 10 строк по 1–60 символов; `[]` |
| minimumCondition | repair/fair/good/excellent/new; `repair` |
| areaId / meetingAreaIds | район / до 6 районов; `[]` означает любые районы |
| pickupOnly | boolean, false; при true остаётся только areaId |
| availability | до 5 `{start,end}` ISO UTC, длительность ≥15 минут; `[]` — без ограничения |
| maxParticipants | целое 2–4, default 4 |
| notes | строка до 1000, default `""` |

Listing добавляет `{id,ownerId,ownerName,version,status,isDemo,demoKey?,createdAt,updatedAt,reservedBy?}`. Owner задаётся только сервером. PATCH передаёт полный ListingInput; DTO с id/ownerId нельзя отправить как ввод. При изменении version увеличивается. Reserved-заявки нельзя изменять или архивировать до отмены соответствующего круга.

## Подбор и круги

| Метод и путь | Запрос | Ответ |
| --- | --- | --- |
| POST `/matches` | `{listingId,maxParticipants?:2..4,limit?:1..30}` | SearchResult, только своя active-заявка |
| POST `/circles` | `{listingIds:[id,...],versions:[1,...]}` | 201 `{circle}` |
| GET `/circles` | — | `{items:Circle[]}` — до 50 своих кругов |
| GET `/circles/:id` | — | `{circle,events:CircleEvent[]}`, только участник |
| POST `/circles/:id/respond` | `{decision:"accept"|"decline"}` | `{circle}` |
| POST `/circles/:id/cancel` | `{}` | `{circle}` |
| GET `/metrics` | — | Metrics |
| POST `/events` | `{type:"candidate_view",signature:string}` | 204; уникальный просмотр своего варианта |

`listingIds` перечислены **в порядке передачи вещей**, 2–4 разных заявки разных людей. Каждая версия должна совпадать с текущей. Сервер заново проверяет все рёбра и условия. Повтор той же активной подписи возвращает существующий proposed-круг; закрытую версию повторно создать нельзя.

SearchResult: `{candidates,total,truncated,elapsedMs,examined,inputCount}`. Candidate: `{signature,listingIds,versions,members,commonAreas,commonAvailability,score,minScore}`. Member: `{userId,name,listingId,giveTitle,giveTypeId,receiveTitle,receiveTypeId,receiveFromId,giveToId,decision,reasons}`. Circle добавляет `{id,status,revision,createdAt,updatedAt,expiresAt,reason?}`. Decision: pending/accepted/declined.

Статусы круга: proposed/agreed/declined/cancelled/expired/invalidated. Ответить можно только за текущую сессию. Все подтверждения атомарно резервируют вещи; чужой последний ответ не перезаписывает предыдущий. Истёкшее предложение освобождается перед действием. Статус agreed не означает завершение физического обмена.

Metrics: `{listings,owners,directOwners,multiwayOwners,additionalOwners,cycles:{"2","3","4"},elapsedMs,truncated,isDemo,agreed,searches,declines,views,responses}`. Покрытие считается по уникальным владельцам на одном графе active-заявок. `views` — уникальные пары пользователь/версия круга, попавшие в viewport; `responses` — реальные принятые сервером ответы, включая последний согласующий. `agreed` — текущее количество согласованных кругов. Это диагностические счётчики, не доказательство спроса.

## Ошибки

Формат `{error:"Сообщение для пользователя"}`. Успешный DELETE/событие не содержит JSON.

| Код | Причина |
| --- | --- |
| 400 | некорректный JSON, ID, неизвестные поля, неподходящее значение или подпись |
| 401 | отсутствующая/истёкшая сессия |
| 403 | чужая запись/ответ, запрещённый Origin/Host/клиентский заголовок |
| 404 | отсутствующая заявка, недоступный круг, выключенное демо |
| 409 | устаревшая версия, занятая вещь, закрытый круг, конфликт уникальности |
| 413 | тело больше 1 МБ |
| 429 | лимит запросов; повторить через минуту |
| 500 / 503 | внутренняя ошибка / недоступна MongoDB |

Ошибки не подтверждают действие в клиенте. При 409 нужно обновить данные и повторить подбор. Лимит: 300 запросов API или 60 сессионных запросов за минуту на IP. Он хранится в процессе и не является распределённой защитой.

## Существующий Data Studio

Путь `/api/db`: health; GET/POST collections; PUT collections/:name; GET/POST collections/:name/documents; PUT/DELETE collections/:name/documents/:id. Заголовок записи `X-DB-Client: vibe-farpost`. Тело документа `{values:{...}}`; описание коллекции — `shared/database.ts`. Имена `krug_*` запрещены, независимо от наличия описания в `_collections`. Настройки форм и все остальные прежние функции сохранены.
