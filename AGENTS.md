<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Material Design для «Круга»

Если пользователь вызывает `$krug-material-design`, пишет «Активируй Material Design для Круга» или просит Material Design / Material UI для интерфейса «Круга», прочитай `.agents/skills/krug-material-design/SKILL.md` и нужные справочники по ссылкам в нём. Это также способ активировать навык в текущем сеансе, если список навыков ещё не обновился.

Выбор пользователя: мобильный интерфейс — Framework7 React с Material-темой `md`, десктопный — Material UI. Общими остаются дизайн-токены, API, сессии и бизнес-логика. При запросе Framework7 для «Круга» используй этот же навык и его `references/framework7-mobile.md`.

Применяй навык в пределах запрошенной UI-задачи. Для задач только по серверу, данным или Git этот навык не нужен. Примеры активации находятся в `docs/ACTIVATE-DESIGN.md`.
