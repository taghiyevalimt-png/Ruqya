# HANDOFF — приложение записи «Mərkəz» (репозиторий Ruqya)

Документ для разработчика, который не видел историю создания. Состояние: аудит 4, ветка `audit4`, начат от тега `audit4-start` (= опубликованная версия 20261116165045).


> **Аудит 5 (22.11.2026, стабильность) — что изменилось для разработчика**
> - Пациент = телефон + имя (не только телефон): `pkey()` в index.html и `ruqya_pkey()` в базе (sql/2026-11-a5-patient-key.sql, откат — rollback-…).
>   **Порядок публикации обязателен:** сначала миграция на живой базе, сразу затем приложение (иначе пациенты двоятся, старые визиты пусты). version.txt перезагружает открытые вкладки.
> - Поиск — одно правило `qPrep/qMatch` (буквы ə/ç/ş/ğ/ö/ü/ı/ё складываются в обе стороны, любой порядок слов, телефон в любом виде).
> - Новая продажа и расход — всегда «сегодня» (меняется вручную, не-сегодня подсвечено).
> - Повторы после потерянного ответа идут с тем же id (upsert по id): записи, продажи, расходы, специалисты, числа статистики, перерывы.
>   Неподтверждённые продажи хранятся на телефоне (`ruqya.selldraft.v1`, список по продаже), Kassa предлагает «Geri aç».
> - Изменения и удаления просят строку назад (`.select("id")`); 0 строк = «не сохранено» + перезагрузка. `soft()` возвращает «нет» только для отсутствующей таблицы/колонки.
> - Тесты аудита: tests/t/99-a5-*.js; мутации: tests/a5/mutate-a5.js; эталон статистики на копии: tests/a5/stats-ref.js. Находки — FINDINGS.md «Аудит 5», итог — STABILITY_REPORT.md.
> - Раздел 1 ниже: «Pasiyentlər — пациенты (по телефону)» теперь читать как «по телефону и имени».

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
| `.github/workflows/backup.yml` | 284 | CI: ночная резервная копия базы с пробным восстановлением и шифрованием |
| `.github/workflows/deploy-check.yml` | 48 | CI: проверка deploy/nginx.conf на Ubuntu |
| `.github/workflows/dr-export.yml` | 57 | DR-выгрузка, зашифрованная открытым ключом |
| `.github/workflows/keepalive.yml` | 41 | CI: не даёт бесплатной базе уснуть (2 раза в неделю) |
| `.github/workflows/vendor-fonts.yml` | 39 | CI: скачивание шрифтов в vendor/fonts |
| `.github/workflows/vendor.yml` | 41 | CI: скачивание supabase-js в vendor/ |
| `.github/workflows/widget-check.yml` | 66 | CI: проверка Android-виджета в эмуляторе |
| `.gitignore` | 4 | исключения git (node_modules, .env, tests/out) |
| `ADMIN_GUIDE.md` | 37 | руководство администратора |
| `ASVS_CHECKLIST.md` | 56 | OWASP ASVS L2 и Top 10 |
| `AUDIT_LOG.md` | 129 | журнал аудита 4: находки, решения, СЕЙЧАС |
| `CHANGELOG.md` | 40 | изменения аудита 4 |
| `DATA_MAP.md` | 31 | карта персональных данных |
| `DEMO.md` | 18 | сценарий показа |
| `DISASTER_RECOVERY.md` | 75 | восстановление, RTO/RPO, переезд |
| `HANDOFF.md` | 162 | передача проекта |
| `README.md` | 1 | краткое описание репозитория |
| `RISK_REGISTER.md` | 23 | открытые риски |
| `TEST_PLAN.md` | 62 | план проверок T-01…T-54 |
| `THREAT_MODEL.md` | 45 | модель угроз |
| `TRACEABILITY.md` | 42 | требование → проверка → доказательство |
| `USER_GUIDE.md` | 60 | руководство пользователя |
| `VERIFY.md` | 50 | как заказчику проверить самому |
| `VISUAL_PROPOSALS.md` | 11 | предложения по виду |
| `android/.gitignore` | 3 | исключения git для Android |
| `android/app/build.gradle` | 51 | сборка Android-приложения (зависимости, подпись) |
| `android/app/src/main/AndroidManifest.xml` | 57 | манифест Android: разрешения, активности, виджет |
| `android/app/src/main/java/az/ruqya/zapis/MainActivity.java` | 311 | Android-оболочка: WebView с опубликованной страницей, мост для виджета и файлов |
| `android/app/src/main/java/az/ruqya/zapis/MonthWidget.java` | 511 | Android-виджет «месяц» на главном экране |
| `android/app/src/main/java/az/ruqya/zapis/WidgetTest.java` | 52 | служебный приёмник для проверки виджета в CI |
| `android/app/src/main/res/layout/widget_month.xml` | 85 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | 5 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` | 40 | изображение |
| `android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png` | 114 | изображение |
| `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` | 20 | изображение |
| `android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png` | 71 | изображение |
| `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` | 47 | изображение |
| `android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png` | 222 | изображение |
| `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` | 103 | изображение |
| `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png` | 403 | изображение |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` | 155 | изображение |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` | 690 | изображение |
| `android/app/src/main/res/values-night/themes.xml` | 10 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/values/colors.xml` | 4 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/values/strings.xml` | 4 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/values/themes.xml` | 10 | ресурс Android (иконка, разметка виджета, строки) |
| `android/app/src/main/res/xml/month_widget_info.xml` | 14 | ресурс Android (иконка, разметка виджета, строки) |
| `android/build.gradle` | 3 | корневая сборка Android |
| `android/gradle.properties` | 2 | параметры Gradle |
| `android/settings.gradle` | 15 | модули Android-проекта |
| `android/test-widget.json` | 1 | тестовые данные виджета для CI |
| `android/test-widget.sh` | 69 | скрипт проверки виджета в эмуляторе (CI) |
| `apple-touch-icon.png` | 212 | изображение |
| `db/schema_live_20261116.sql` | 4234 | структура живой базы (без данных) — основа установки |
| `db/structure_live_20261117.tsv` | 13 | слепок структуры живой базы (только чтение) для tools/schema_check.js |
| `deploy/merkez-headers.conf` | 9 | заголовки безопасности для каждого location nginx |
| `deploy/nginx.conf` | 35 | сайт на сервере заказчика с заголовками безопасности (S-01) |
| `docs/AUDIT_LOG.md` | 46 | журнал аудита 3 (история) |
| `docs/BACKUP.md` | 67 | как устроены штатные копии и как из них восстановиться |
| `docs/HANDOFF.md` | 90 | прежняя версия описания (заменена корневым HANDOFF.md) |
| `favicon.png` | 28 | изображение |
| `icon-192.png` | 155 | изображение |
| `icon-512.png` | 919 | изображение |
| `index.html` | 4048 | всё веб-приложение: стили, словарь RU, логика, экраны (ES5, без сборки) |
| `launch/l-1125x2436.png` | 6 | изображение |
| `launch/l-1170x2532.png` | 4 | изображение |
| `launch/l-1179x2556.png` | 4 | изображение |
| `launch/l-1206x2622.png` | 7 | изображение |
| `launch/l-1242x2208.png` | 5 | изображение |
| `launch/l-1242x2688.png` | 6 | изображение |
| `launch/l-1260x2736.png` | 5 | изображение |
| `launch/l-1284x2778.png` | 5 | изображение |
| `launch/l-1290x2796.png` | 6 | изображение |
| `launch/l-1320x2868.png` | 4 | изображение |
| `launch/l-640x1136.png` | 5 | изображение |
| `launch/l-750x1334.png` | 4 | изображение |
| `launch/l-828x1792.png` | 4 | изображение |
| `logo-192.png` | 89 | изображение |
| `logo-hq.png` | 1021 | изображение |
| `logo-hq.webp` | 639 | логотип заставки и входа, те же пиксели в WebP (P-02) |
| `logo.png` | 560 | изображение |
| `manifest.webmanifest` | 14 | манифест PWA (иконка, имя, тема) |
| `publish.sh` | 38 | публикация: штамп версии, CSP-хеши, проверка синтаксиса, коммит и push в main |
| `sbom.cdx.json` | 743 | перечень компонентов (SBOM) |
| `scripts/backup-auth-columns-gen.sql` | 11 | столбцы auth источника для старого стека восстановления (B-16) |
| `scripts/backup-manifest-gen.sql` | 22 | SQL для манифеста копии (строки и md5 по таблицам) |
| `scripts/backup-post-schema-gen.sql` | 58 | SQL для проверки структуры после восстановления |
| `scripts/backup-structure.sql` | 15 | SQL-снимок структуры для сравнения |
| `scripts/restore-smoke.js` | 51 | проверка приложения на восстановленной копии (вход, календарь, Excel) |
| `scripts/restore.sh` | 132 | восстановление штатной копии в Supabase (самостоятельный хостинг или проект) |
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
| `sql/2026-11-least-privilege.sql` | 18 | минимальные права: anon без прав на таблицы (S-04) |
| `sql/2026-11-limits-b.sql` | 75 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-limits.sql` | 33 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-maintenance.sql` | 65 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-money-private.sql` | 16 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-owner.sql` | 120 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-patients-order.sql` | 20 | устойчивый порядок списка пациентов (B-04) |
| `sql/2026-11-patients-scale.sql` | 65 | индекс по ключу пациента, постраничный список, визиты через private (P-04, P-05, S-07), «Satış edildi» = успешная |
| `sql/2026-11-patients.sql` | 50 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-place.sql` | 68 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-privacy.sql` | 114 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-realtime.sql` | 14 | часть установки: таблицы в публикации Realtime (B-17) |
| `sql/2026-11-rules.sql` | 33 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-service.sql` | 33 | правило: услуга — одна из шести (владелец 17.11) |
| `sql/2026-11-stability.sql` | 96 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-stat-edits.sql` | 53 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/2026-11-stat-edits2.sql` | 6 | миграция базы (запускается в SQL Editor/коннектором), см. шапку файла |
| `sql/rollback-2026-11-anonymize.sql` | 4 | откат миграции 2026-11-anonymize.sql |
| `sql/rollback-2026-11-audit.sql` | 11 | откат миграции 2026-11-audit.sql |
| `sql/rollback-2026-11-audit2.sql` | 42 | откат миграции 2026-11-audit2.sql |
| `sql/rollback-2026-11-breaks-agents.sql` | 5 | откат миграции 2026-11-breaks-agents.sql |
| `sql/rollback-2026-11-breaks.sql` | 4 | откат миграции 2026-11-breaks.sql |
| `sql/rollback-2026-11-follow.sql` | 25 | откат миграции 2026-11-follow.sql |
| `sql/rollback-2026-11-least-privilege.sql` | 13 | откат 2026-11-least-privilege.sql |
| `sql/rollback-2026-11-owner.sql` | 8 | откат миграции 2026-11-owner.sql |
| `sql/rollback-2026-11-patients-order.sql` | 17 | откат 2026-11-patients-order.sql |
| `sql/rollback-2026-11-patients-scale.sql` | 37 | откат 2026-11-patients-scale.sql |
| `sql/rollback-2026-11-patients.sql` | 5 | откат миграции 2026-11-patients.sql |
| `sql/rollback-2026-11-place.sql` | 5 | откат миграции 2026-11-place.sql |
| `sql/rollback-2026-11-privacy.sql` | 47 | откат миграции 2026-11-privacy.sql |
| `sql/rollback-2026-11-realtime.sql` | 9 | откат 2026-11-realtime.sql |
| `sql/rollback-2026-11-rules.sql` | 4 | откат миграции 2026-11-rules.sql |
| `sql/rollback-2026-11-service.sql` | 27 | откат 2026-11-service.sql |
| `sql/rollback-2026-11-stability.sql` | 23 | откат миграции 2026-11-stability.sql |
| `sql/rollback-2026-11-stat-edits.sql` | 9 | откат миграции 2026-11-stat-edits.sql |
| `sql/rollback-2026-11-stat-edits2.sql` | 6 | откат миграции 2026-11-stat-edits2.sql |
| `tools/configure.py` | 166 | перенастройка приложения на другую базу (адрес и ключ) без правки кода вручную |
| `tools/csp.py` | 17 | пересчёт хешей CSP для встроенных скриптов |
| `tools/dr_drill.js` | 30 | учения DR с замером времени |
| `tools/dr_manifest.sql` | 12 | число строк и хеш по таблицам для DR |
| `tools/dr_restore.js` | 94 | восстановление DR-выгрузки в PostgreSQL 17 со сверкой |
| `tools/logo_hq.py` | 58 | изготовление logo-hq.png (прозрачный фон) и logo-hq.webp (те же пиксели, без потерь) из logo.png |
| `tools/sbom.js` | 32 | SBOM CycloneDX (sbom.cdx.json) |
| `tools/schema_check.js` | 29 | структура из репозитория = живая база (слепок db/structure_live_*.tsv) |
| `tools/secret_scan.js` | 47 | поиск секретов в файлах и истории git |
| `tools/suite3.sh` | 16 | все тесты 3 раза подряд (SUITE_DIR — куда писать) |
| `vendor/fonts/SHA256SUMS` | 11 | контрольные суммы шрифтов |
| `vendor/fonts/f01.woff2` | 149 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f02.woff2` | 146 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f03.woff2` | 302 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f04.woff2` | 171 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f05.woff2` | 88 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f06.woff2` | 211 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f07.woff2` | 88 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f08.woff2` | 135 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f09.woff2` | 282 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f10.woff2` | 207 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/f11.woff2` | 163 | вшитый шрифт (Golos Text / Onest, часть алфавита) — без внешних запросов |
| `vendor/fonts/fonts.css` | 235 | описания вшитых шрифтов |
| `vendor/supabase-2.45.4.js` | 1 | клиент Supabase (MIT), локальная копия |
| `version.txt` | 1 | номер опубликованной версии |
