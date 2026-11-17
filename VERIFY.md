# VERIFY — как заказчику самому проверить результаты

Все команды — из корня репозитория. Нужны: Git, Node 18+ (проверено на 26), Python 3, Google Chrome (тесты запускают его через playwright-core 1.49.1); для `tools/dr_drill.js` — `gh` и закрытый ключ DR владельца. Живые системы команды ниже не меняют.

## 1. Что именно принимается
```bash
git fetch --tags && git checkout audit4-accept      # тег принятой версии (релиз b1c38b2, опубликован 17.11.2026)
sha256sum -c SHA256SUMS                             # контрольные суммы файлов пакета
```
Опубликованный сайт должен совпадать с тегом: `node tests/perf/live-network.js` (сеть живого сайта) и сравнение файлов из раздела 5.

## 2. Тесты
```bash
cd tests && npm ci && cd ..
node tests/lint.js && node tests/run.js           # все наборы; 0 = все прошли
SUITE_DIR=out3 sh tools/suite3.sh                  # 3 прогона подряд (требование 1)
node tests/run.js 21-access                         # одна проверка по части имени
node tests/mutate-db.js                             # проверка самих тестов базы: внесённые дефекты должны ловиться (14/14)
node tests/mutate-app.js                            # то же для кода приложения (12/12)
```
Базовые тесты (21, 22, 90–97) поднимают свою временную PostgreSQL 17 и удаляют её после себя; данные в них выдуманные.

## 3. Скорость, нагрузка, экраны
```bash
node tests/perf/vitals.js out/vitals.json 5        # LCP/INP/CLS, медиана 5 прогонов (порог 2500/200/0,1)
node tests/perf/frames.js out/frames.json 5        # кадры > 50 мс при прокрутке и анимациях
node tests/perf/db-scale.js out/db 1000000         # 1 000 000 записей: планы запросов, индексы, страницы
node tests/perf/load50.js out/load.json 50 120     # 50 одновременных пользователей
node tests/perf/soak.js out/soak.json 120          # 2 часа без перезагрузки: память, ошибки; SOAK_SNAP=1 — что именно растёт
node tests/visual/audit-ui.js out/ui               # 5 ширин × 2 темы × 2 языка: прокрутка, обрезка, наложения, WCAG
```

## 4. Безопасность и данные
```bash
node tools/secret_scan.js                          # секреты в файлах и во всей истории git (0)
cd tests && npm audit && cd ..                     # уязвимости зависимостей (high/critical 0)
node tools/schema_check.js db/structure_live_20261117.tsv   # структура из репозитория = живая база
ATTACKS_OUT=out/attacks.tsv node tests/run.js 22-attacks    # 34 попытки обойти права — все отклонены
MATRIX_OUT=out/matrix.tsv node tests/run.js 21-access       # 216 ячеек матрицы доступа реальными запросами
```

## 5. Сборка и восстановление
```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<publishable key> python tools/configure.py OUT   # копия сайта для другой базы
node tests/run.js 94-configured                     # в копии есть все файлы, на которые ссылается страница
node tools/dr_drill.js <run id dr-export> <dr_private.pem> out/drill.txt   # учения DR с замером времени
```
Две сборки из одного коммита дают одинаковые SHA-256 (evidence/stage6/reproducible-build.txt, команда там же).

## 6. Где доказательства
`EVIDENCE_INDEX.md` — перечень всех файлов доказательств; `TRACEABILITY.md` — требование → проверка → файл; `AUDIT_LOG.md` — находки и их статусы; `ACCEPTANCE_REPORT.md` — итог.
