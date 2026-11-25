# KRIS SKIN

Закрытое веб-приложение косметолога: пациент → анамнез → консультация → карта (10 страниц) → утверждение → PDF в фирменном дизайне → отправка пациенту.

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres, Auth, Storage) · `@react-pdf/renderer` · Vercel. Только бесплатные сервисы.

## Быстрый запуск локально (без Supabase)

```bash
npm install
npm run dev            # http://localhost:3000
node scripts/create-local-user.mjs <логин> <пароль>   # демо-пользователь; данные в .data/ (не коммитятся)
```

Без переменных Supabase приложение работает в **локальном демо-режиме**: данные лежат в `.data/`. Это только для разработки (на Vercel файловая система временная).

## Боевой режим: Supabase

1. Создайте проект на supabase.com (бесплатный тариф: не более 2 активных проектов).
2. SQL Editor → выполните `supabase/migrations/0001_init.sql` целиком (таблицы, RLS, приватный bucket `kris-private`, права доступа).
3. Authentication → Sign In / Providers → **выключите** «Allow new users to sign up» (регистрация закрыта).
4. Authentication → Users → **Add user** (email + пароль, «Auto confirm user»). Для входа можно вводить короткий логин: `kris` превращается в `kris@kris-skin.app` (см. `LOGIN_DOMAIN` в `src/app/login/actions.ts`).
5. Project Settings → API Keys → скопируйте **Project URL** и **publishable key**. Секретные ключи приложению не нужны и не используются.

## Деплой на Vercel

1. vercel.com/new → импорт репозитория GitHub.
2. Environment Variables (Production и Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable key
3. Deploy. Регион функций задан в `vercel.json` (`sin1`, рядом с базой — меняйте под регион вашего Supabase).
4. Каждый `git push` в `main` автоматически обновляет сайт.

### Голосовой ввод с исправлением ошибок (Claude)
1. Получите ключ на console.anthropic.com (платный сервис: оплата за использование).
2. Vercel → проект → Settings → Environment Variables → добавьте `ANTHROPIC_API_KEY` (Production), затем Deployments → Redeploy.
3. Без ключа диктовка работает, но без исправления орфографии (только заглавные буквы и знаки препинания голосом).
4. Модель: `claude-opus-5-5`; быстрее и дешевле — `ANTHROPIC_MODEL=claude-haiku-5-5`.
Распознавание речи — в Chrome, Edge и Safari. Надиктованный текст отправляется в Anthropic.

### Свой домен
Vercel → проект → Settings → Domains → Add. Добавьте записи DNS, которые покажет Vercel. Домены не покупаются автоматически.

### После первого входа
Настройки → **Фирменные изображения** → «Загрузить комплект» (9 файлов: `cover`, `bg_products`, `bg_room`, `face_illustration`, `side_actives_top`, `side_actives_bottom`, `side_nutrition`, `side_vitamins`, `specialist`). Затем **Настройки → Безопасность** — задайте свой пароль.

## Проверки

```bash
npm run lint && npm run typecheck && npm test          # юнит-тесты (vitest)
npx playwright test                                    # сквозные тесты и 10 разрешений (локальный режим)
npx playwright test -c playwright.supabase.config.ts   # дымовой тест против реального Supabase (нужны KRIS_* переменные, см. конфиг)
```

Образцы PDF на вымышленных данных: `npx tsx scripts/gen-sample-pdfs.tsx`. Сравнение с референсами: `node scripts/render-pdf.mjs <pdf> <outDir>`.

## Безопасность и приватность
- RLS на всех таблицах, приватный Storage, подписанные временные ссылки; ключи сервисной роли не используются.
- `references/`, `.env*`, `.data/`, `assets-private/`, любые PDF и медданные — в `.gitignore`.
- Утверждённые карты неизменяемы: PDF хранится как файл, повторное скачивание отдаёт оригинал.
- Service worker кеширует только статические файлы, никогда страницы, фото и PDF.

Подробности архитектуры: `CLAUDE.md`, `DECISIONS.md`. Текущее состояние: `PROJECT_STATE.md`.
