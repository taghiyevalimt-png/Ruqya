# HANDOFF — приложение записи «Mərkəz» (репозиторий Ruqya)

Документ для разработчика, который не видел историю создания. Состояние: аудит 4, ветка `audit4`, начат от тега `audit4-start` (= опубликованная версия 20261116165045).

## 1. Что это и для кого
Запись пациентов и статистика одного центра руқья/хиджамы (Баку). Пользуются только сотрудники: админы, агенты продаж, специалисты. Телефоны: iPhone (Safari → «На экран Домой»), Android (APK-оболочка), компьютеры (браузер).

| Раздел | Что делает |
|---|---|
| Qəbullar | календарь дня (колонка на специалиста, сеансы 30–180 мин, 08:00–24:00), список, неделя сверху, месяц по нажатию на дату; запись, правка, «Ləğv et» (отмена — чёрный блок, время освобождается), «Səhvən yazılıb — tamamilə sil» (удаление), отметка ✅ «Təsdiq aldı», ✅✅ — прошедший сеанс (успешный автоматически), Kopyala, Zəng/Wp/Təsdiq (WhatsApp), поле «Yer» (Ofis/Onlayn/Ünvan) |
| Statistika | Bu gün / Gündəlik / Həftəlik (пятница–четверг) / Aylıq (с первой пятницы) / Qaydalar / Terminlər; таблицы продаж агентов (Müraciət WP/SŞ/ümumi, Yazdı, Uğurlu, Ləğv), денег и товаров (только админ), правка чисел, Excel за период (админ) |
| Kassa | продажи товаров (с правкой) и расходы по дням |
| Pasiyentlər | пациенты (по телефону), история визитов; «Ləğv olunanlar» — отменённые с напоминаниями (1, 2, «Satış edildi» → ✅…✅✅✅) и кнопками Yeni qəbul yaz / Zəng / Wp; удаление данных пациента (админ) |
| Ayarlar | специалисты и цвета, перерывы (для всех или отдельных специалистов), сотрудники и роли, журнал изменений с восстановлением, вид (ширина/высота блоков, тема), язык, аккаунт |
| Android-виджет | месяц с именами пациентов |

Языки: азербайджанский (по умолчанию) и русский. Часовой пояс всегда Asia/Baku.

## 2. Данные
См. DATA_MAP.md (этап 1). Таблицы: `appts`, `readers`, `staff`, `breaks`, `expenses`, `product_sales`, `stat_edits`, `services` (не используется), `audit_log`; Supabase Auth `auth.users`, `auth.identities`. На устройстве (localStorage): сессия Supabase, `ruqya.cache.v1` (копия данных для быстрого старта), `ruqya.draft.v1` (несохранённая форма записи, 2 дня), `ruqya.seen` (автовыход через 12 ч), настройки вида.

## 3. Технологии и версии
- Веб: один файл `index.html`, ES5 без сборки (проверяется тестом `11-es5`). `vendor/supabase-2.45.4.js` (MIT). Шрифты Golos Text, Onest (SIL OFL 1.1) в `vendor/fonts`.
- CSP в `<meta>`: скрипты только свои (хеши SHA-256, `tools/csp.py`), подключения только к адресу базы.
- База: Supabase (PostgreSQL 17.11, RLS на всех таблицах, Auth по e-mail и паролю, регистрация закрыта, Realtime). Проект `ldkhdeehrrajvgrtieal`, регион Европа.
- Хостинг: GitHub Pages из ветки `main` репозитория `taghiyevalimt-png/Ruqya` (публичный).
- Android: Java, minSdk 21, WebView + виджет; сборка в GitHub Actions.
- Тесты: Node + playwright-core 1.49.1 (Chrome), подменённый Supabase в браузере; SQL — на PGlite и локальном PostgreSQL 17.11.

## 4. Роли и права (проверяются в базе через RLS и триггеры)
| Роль | Назначение | Может |
|---|---|---|
| Владелец | фиксированный id в `ruqya_is_admin()` | всё; его роль нельзя сменить |
| Админ | `staff.role='admin'` | всё: специалисты, сотрудники, журнал, восстановление, деньги, Excel, цвета, удаление данных пациента |
| Агент продаж | `staff.role='agent'` | видит все записи; меняет и удаляет только свои; подтверждает и ставит напоминания на любые видимые; своя статистика; своя касса; перерывы |
| Специалист | `staff.role='specialist'` + совпадение имени с колонкой | видит только свои сеансы; без денег и кассы |
| Ожидает роль | аккаунт без роли | только «Hesab» |
| Без входа | — | ничего |
Подробно — матрица доступа в THREAT_MODEL.md / tests (этап 1).

## 5. Внешние сервисы и настройки (только названия)
- `SB_URL`, `SB_KEY` в `index.html` (публикуемый ключ, защита — RLS); перенос — `tools/configure.py` + `.env.example`.
- Секреты GitHub Actions: `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASS`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASS`, `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`.
- Ключ DR: открытый `.github/dr_public.pem`; закрытый — только у владельца (вне GitHub).
- Ссылки `wa.me`, `tel:` (открываются приложениями телефона).
- Аккаунты: GitHub `taghiyevalimt-png` (репозиторий, Pages, Actions), Supabase (проект, вход через GitHub того же владельца). Домена нет.

## 6. Запуск, тесты, публикация
- Локально: любой статический сервер из корня (`python -m http.server`), страница работает с указанной базой.
- Все тесты: `cd tests && npm ci && node run.js` (нужен Chrome). Отдельные: `node run.js <часть имени>`.
- Скорость: `node tests/perf/vitals.js out.json 5` (падает при превышении порогов). Экраны: `node tests/visual/audit-ui.js outDir`.
- Публикация веба: `sh publish.sh "сообщение"` (штамп версии, CSP, проверка синтаксиса, push в `main` → Pages за минуту). APK: push в `android/**`.
- Миграции: файлы `sql/2026-11-*.sql` (+ `rollback-*`), применяются в SQL Editor или коннектором; схема на 16.11 — `db/schema_live_20261116.sql`.
- Копии: docs/BACKUP.md (штатные), `node tools/dr_restore.js` (DR), DISASTER_RECOVERY.md (этап 6).

## 7. Важные решения (из переписки с владельцем)
- Сеанс считается успешным, когда его время прошло; «Ləğv et» переводит в отменённые (не удаляет), отменённые не считаются в «Yazdı/Uğurlu», есть столбец «Ləğv».
- Неделя — пятница–четверг; месяц — с первой пятницы, без потерянных дней.
- Данные хранятся минимум 2 года; журнал — 2 года + 1 день.
- Цену сеанса агенты видят (решение владельца); владелец — вечный главный админ; перерывы меняют и агенты.
- Публикация — сразу после прохождения всех тестов, без отдельного вопроса (указание владельца 16.11).
- Окно записи открывается высоким и не двигается при клавиатуре.

## 8. Известные проблемы
Ведутся в AUDIT_LOG.md (находки) и RISK_REGISTER.md (остаточные риски).

## 9. Файлы (без tests/ и evidence/)
| Файл | Строк | Назначение |
|---|---|---|
| `.env.example` | 5 | шаблон переменных окружения для tools/configure.py (адрес и публичный ключ базы) |
| `.github/dr_public.pem` | 14 | открытый RSA-ключ, которым шифруется DR-выгрузка (закрытый ключ — только у владельца) |
| `.github/workflows/apk-release-check.yml` | 43 | CI: проверка, что опубликованный APK собран из текущего кода |
| `.github/workflows/apk.yml` | 57 | CI: сборка и подпись Android-APK, релиз Ruqya.apk |
| `.github/workflows/audit-probe.yml` | 59 | CI: внешние проверки только на чтение (настройки входа, анонимный доступ, заголовки) |
| `.github/workflows/backup.yml` | 239 | CI: ночная резервная копия базы с пробным восстановлением и шифрованием |
| `.github/workflows/dr-export.yml` | 57 | CI: DR-выгрузка схемы и данных, зашифрованная на офлайн-ключ |
| `.github/workflows/keepalive.yml` | 37 | CI: не даёт бесплатной базе уснуть (2 раза в неделю) |
| `.github/workflows/vendor-fonts.yml` | 39 | CI: скачивание шрифтов в vendor/fonts |
| `.github/workflows/vendor.yml` | 41 | CI: скачивание supabase-js в vendor/ |
| `.github/workflows/widget-check.yml` | 63 | CI: проверка Android-виджета в эмуляторе |
| `.gitignore` | 4 | исключения git (node_modules, .env, tests/out) |
| `AUDIT_LOG.md` | 53 | журнал аудита 4: состояние, находки, нужно от владельца |
| `README.md` | 0 | краткое описание репозитория |
| `android/.gitignore` | 3 | исключения git для Android |
| `android/app/build.gradle` | 51 | сборка Android-приложения (зависимости, подпись) |
| `android/app/src/main/AndroidManifest.xml` | 57 | манифест Android: разрешения, активности, виджет |
| `android/app/src/main/java/az/ruqya/zapis/MainActivity.java` | 285 | Android-оболочка: WebView с опубликованной страницей, мост для виджета и файлов |
| `android/app/src/main/java/az/ruqya/zapis/MonthWidget.java` | 488 | Android-виджет «месяц» на главном экране |
| `android/app/src/main/java/az/ruqya/zapis/WidgetTest.java` | 49 | служебный приёмник для проверки виджета в CI |
| `android/app/src/main/res/layout/widget_month.xml` | 85 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | 5 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/values-night/themes.xml` | 10 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/values/colors.xml` | 4 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/values/strings.xml` | 4 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/values/themes.xml` | 10 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/xml/month_widget_info.xml` | 14 | ресурс Android (иконка, разметка виджета, строки) |
| `android/build.gradle` | 3 | корневая сборка Android |
| `android/gradle.properties` | 2 | параметры Gradle |
| `android/settings.gradle` | 15 | модули Android-проекта |
| `android/test-widget.json` | 0 | тестовые данные виджета для CI |
| `android/test-widget.sh` | 47 | скрипт проверки виджета в эмуляторе (CI) |
| `db/schema_live_20261116.sql` | 4234 | выгрузка схем public и auth живой базы на 16.11.2026 (без данных) |
| `docs/AUDIT_LOG.md` | 46 | журнал аудита 3 (история) |
| `docs/BACKUP.md` | 64 | как устроены штатные копии и как из них восстановиться |
| `docs/HANDOFF.md` | 90 | прежняя версия описания (заменена корневым HANDOFF.md) |
| `index.html` | 3951 | всё веб-приложение: стили, словарь RU, логика, экраны (ES5, без сборки) |
| `manifest.webmanifest` | 14 | манифест PWA (иконка, имя, тема) |
| `publish.sh` | 25 | публикация: штамп версии, CSP-хеши, проверка синтаксиса, коммит и push в main |
| `scripts/backup-manifest-gen.sql` | 22 | SQL для манифеста копии (строки и md5 по таблицам) |
| `scripts/backup-post-schema-gen.sql` | 58 | SQL для проверки структуры после восстановления |
| `scripts/backup-structure.sql` | 14 | SQL-снимок структуры для сравнения |
| `scripts/restore-smoke.js` | 50 | проверка приложения на восстановленной копии (вход, календарь, Excel) |
| `scripts/restore.sh` | 130 | восстановление штатной копии в Supabase (самостоятельный хостинг или проект) |
| `sql/2026-11-admins.sql` | 21 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-anonymize.sql` | 41 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-audit.sql` | 15 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-audit2.sql` | 94 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-breaks-agents.sql` | 10 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-breaks.sql` | 4 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-colors-admin.sql` | 11 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-colors.sql` | 22 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-follow.sql` | 38 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-harden.sql` | 221 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-hardening.sql` | 84 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-journal-limit.sql` | 30 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-keep2y-b.sql` | 61 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-keep2y.sql` | 41 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-limits-b.sql` | 75 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-limits.sql` | 33 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-maintenance.sql` | 65 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-money-private.sql` | 16 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-owner.sql` | 120 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-patients.sql` | 50 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-place.sql` | 68 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-privacy.sql` | 114 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-rules.sql` | 33 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-stability.sql` | 96 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-stat-edits.sql` | 53 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-stat-edits2.sql` | 6 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/rollback-2026-11-anonymize.sql` | 4 | откат миграции 2026-11-anonymize.sql |
| `sql/rollback-2026-11-audit.sql` | 11 | откат миграции 2026-11-audit.sql |
| `sql/rollback-2026-11-audit2.sql` | 42 | откат миграции 2026-11-audit2.sql |
| `sql/rollback-2026-11-breaks-agents.sql` | 5 | откат миграции 2026-11-breaks-agents.sql |
| `sql/rollback-2026-11-breaks.sql` | 4 | откат миграции 2026-11-breaks.sql |
| `sql/rollback-2026-11-follow.sql` | 25 | откат миграции 2026-11-follow.sql |
| `sql/rollback-2026-11-owner.sql` | 8 | откат миграции 2026-11-owner.sql |
| `sql/rollback-2026-11-patients.sql` | 5 | откат миграции 2026-11-patients.sql |
| `sql/rollback-2026-11-place.sql` | 5 | откат миграции 2026-11-place.sql |
| `sql/rollback-2026-11-privacy.sql` | 47 | откат миграции 2026-11-privacy.sql |
| `sql/rollback-2026-11-rules.sql` | 4 | откат миграции 2026-11-rules.sql |
| `sql/rollback-2026-11-stability.sql` | 23 | откат миграции 2026-11-stability.sql |
| `sql/rollback-2026-11-stat-edits.sql` | 9 | откат миграции 2026-11-stat-edits.sql |
| `sql/rollback-2026-11-stat-edits2.sql` | 6 | откат миграции 2026-11-stat-edits2.sql |
| `tools/configure.py` | 166 | перенастройка приложения на другую базу (адрес и ключ) без правки кода вручную |
| `tools/csp.py` | 17 | пересчёт хешей CSP для встроенных скриптов |
| `tools/dr_manifest.sql` | 12 | строки и хеш содержимого по каждой таблице (сверка копии с оригиналом) |
| `tools/dr_restore.js` | 86 | восстановление DR-выгрузки в чистый PostgreSQL 17 со сверкой |
| `tools/logo_hq.py` | 54 | изготовление logo-hq.png (прозрачный фон) из logo.png |
| `vendor/fonts/SHA256SUMS` | 11 | контрольные суммы шрифтов |
| `vendor/supabase-2.45.4.js` | 0 | клиент Supabase (MIT), локальная копия |
| `version.txt` | 1 | номер опубликованной версии |
Тесты: `tests/lib.js` (стенд), `tests/run.js` (запуск), `tests/t/*.js` (наборы), `tests/sql-*.js` (SQL на PGlite), `tests/perf/*`, `tests/visual/*`.
