# Полный комплект: бэкенд магазина кроссовок

Сначала **распакуйте весь архив**, сохранив папки. Не открывайте отдельный HTML прямо внутри ZIP: ему нужны соседние JavaScript-файлы.

## С чего начать

1. [Исходное практическое задание](assignment.md).
2. [Интерактивная презентация — все 18 глав, 192 слайда](presentation/sneaker-backend.html): откройте файл браузером, сервер не нужен. «Пояснение» содержит подробный текст; кнопки промптов открывают полный текст для копирования.
3. [Полный PDF на 192 страницы](presentation/sneaker-backend-chapters-1-18.pdf). Отдельные PDF пар глав и предыдущие сборки также находятся в presentation.
4. [Работающий учебный бэкенд и инструкция запуска M0–M6](presentation/sneaker-practice/README.md).

## Что внутри

| Папка/файл | Содержимое |
|---|---|
| assignment.md | Оригинальное задание без изменения текста |
| presentation/sneaker-backend.html, *.js, *.css | Полная презентация, схемы и интерактивные примеры |
| presentation/sneaker-backend-chapters-*.pdf | Общий PDF, части и сохранённые промежуточные сборки |
| presentation/sneaker-practice/ | Полный код магазина, зависимости, Compose, миграции, seed, инструкции M0–M6, промпты, проверки и отчёты |
| presentation/sneaker-examples/ | Python и FastAPI: главы 3–4 |
| presentation/sneaker-db-examples/ | SQL, схема и учебная БД: главы 5–6 |
| presentation/sneaker-orm-auth-examples/ | ORM, миграции и JWT: главы 7–8 |
| presentation/sneaker-checkout-examples/ | Транзакции, откат и конкуренция: главы 9–10 |
| presentation/sneaker-backend-checks/ | Проверки вёрстки, диалогов и PDF |
| presentation/vendor/ | Локальные библиотеки и их лицензии |
| plans/sneaker-shop/ | План и карта всех 192 слайдов |
| MANIFEST.sha256 | Контрольные суммы файлов комплекта |

Всего 52 полных промпта: 3 в sneaker-checkout-examples/prompts.json; 8 в sneaker-practice/prompts.json; 13 в m23-prompts.json; 17 в m45-prompts.json; 11 в final-prompts.json. Их JS-копии нужны для работы презентации без сервера.

## Запуск магазина

Откройте терминал в presentation/sneaker-practice и выполните README этой папки: новый venv → requirements.txt → свой .env из .env.example → setup_jwt.py → Docker Compose → миграция → seed → uvicorn app.final_main:app. Нужны Python 3.11+ и Docker с Compose. Реальные проверки проведены на macOS/Python 3.13.3/PostgreSQL 17. Для первой установки пакетов и образа БД нужен интернет; сама HTML-презентация работает локально.

Виртуальные окружения, node_modules, локальные .env, кэши и рабочие данные БД не включены. Все .env.example, зависимости, миграции и seed сохранены: окружение и учебные данные создаются по инструкции.

## Vue-фронтенд

[Первый этап фронтенда](frontend/README.md): Vue 3, TypeScript, Vite, Vue Router и Pinia.
Каталог открывается на `http://127.0.0.1:4200` и получает товары из FastAPI через dev-прокси.

## Материалы сдачи

[Матрица требований и комплект сдачи](presentation/sneaker-practice/SUBMISSION.md), [практика M6 и финал](presentation/sneaker-practice/M6-FINAL.md), [CONCEPT.template.md](presentation/sneaker-practice/CONCEPT.template.md). CONCEPT — шаблон для собственного ответа ученика; видео/скриншоты его Swagger нужно подготовить отдельно. Сохранённые отчёты описывают проверки эталона.

## Проверка архива

ZIP проверен на целостность. MANIFEST.sha256 содержит SHA-256 каждого файла, кроме самого манифеста. После изменения файлов их суммы закономерно изменятся. В копии плана абсолютная ссылка на задание заменена локальной; необязательный браузерный проверочный скрипт использует собственный package.json вместо зависимости от другого проекта. Остальные исходники курса сохранены.
