# Необязательная проверка HTML и PDF

Для просмотра презентации эти инструменты не нужны. Они предназначены для повторной проверки после правок.

Из этой папки, с установленным Node.js/npm:

```sh
npm install
npx playwright install chromium
npm run check
```

Playwright закреплён в package.json. Если используете уже установленный Google Chrome, задайте BROWSER_CHANNEL=chrome в окружении перед запуском. По умолчанию используется установленный Playwright Chromium.

Проверка создаёт PDF в соседней папке presentation и обновляет results.json. Снимки экранов сохраняются по пути из поля previewDirectory отчёта; старые снимки с машины автора в архив не входят.

Для проверки текста экспортированных PDF создайте отдельный Python venv, затем:

```sh
python -m pip install -r requirements.txt
python check-pdf.py
```

Изначальные результаты проверок включены в комплект; для открытия HTML и PDF не требуется повторять проверки или запускать магазин.
