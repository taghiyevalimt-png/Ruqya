package az.ruqya.zapis;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Owner 23.11: the «gündəlik» (day) and «həftəlik» (week) home-screen widgets, drawn as one picture like the month
 * widget (same colours, same header: title, ‹ ›, «+»). The data is the same hand-over from the app (MonthWidget.PREFS
 * "data"); per day the app sends [name, colour, status, end minute, start minute, specialist] — older app versions send
 * only the first four, then the time and the specialist are simply left out.
 * Proportions are shared with res/layout/widget_day.xml (header 16, list 84) and widget_week.xml (header 14, 7 × 12).
 */
final class AgendaDraw {

    static final float DHEAD = 16f, DTOTAL = 100f;
    static final float WHEAD = 14f, WROW = 12f, WTOTAL = WHEAD + 7 * WROW;

    static final String[] WDF = {"Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə", "Bazar"};
    static final String[] WDF_RU = {"Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"};
    static final String[] MONG = {"yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"};

    /** Only the build check (WidgetTest) sets this, to draw sample data on a fixed date. */
    static String testToday = null;

    private AgendaDraw() {
    }

    static Calendar now() {
        Calendar c = MonthWidget.today();
        if (testToday != null && testToday.matches("\\d{4}-\\d{2}-\\d{2}")) {
            c.set(Integer.parseInt(testToday.substring(0, 4)), Integer.parseInt(testToday.substring(5, 7)) - 1, Integer.parseInt(testToday.substring(8)), 15, 0, 0);
        }
        return c;
    }

    static Calendar noon(int addDays) {
        Calendar c = now();
        c.set(Calendar.HOUR_OF_DAY, 12);
        c.set(Calendar.MINUTE, 0);
        c.add(Calendar.DAY_OF_MONTH, addDays);
        return c;
    }

    /** Monday = 0 … Sunday = 6. */
    static int wd(Calendar c) {
        return (c.get(Calendar.DAY_OF_WEEK) + 5) % 7;
    }

    static String dayIso(int off) {
        return MonthWidget.iso(noon(off));
    }

    /** The seven dates of the week shown (Monday first), off weeks from this one. */
    static String[] weekDays(int off) {
        Calendar c = noon(0);
        c.add(Calendar.DAY_OF_MONTH, -wd(c) + 7 * off);
        String[] out = new String[7];
        for (int k = 0; k < 7; k++) {
            out[k] = MonthWidget.iso(c);
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
        return out;
    }

    static Calendar cal(String iso) {
        Calendar c = now();
        c.set(Integer.parseInt(iso.substring(0, 4)), Integer.parseInt(iso.substring(5, 7)) - 1, Integer.parseInt(iso.substring(8)), 12, 0, 0);
        return c;
    }

    static String dm(String iso, boolean ru) {
        Calendar c = cal(iso);
        return c.get(Calendar.DAY_OF_MONTH) + " " + (ru ? MonthWidget.MONG_RU : MONG)[c.get(Calendar.MONTH)];
    }

    static String hm(int m) {
        if (m < 0) return "";
        m = Math.max(0, Math.min(m, 24 * 60));
        return String.format(Locale.US, "%02d:%02d", m / 60, m % 60);
    }

    /** A blank picture of the widget's size (scaled down like the month widget when a home screen would refuse it). */
    static float[] size(int wDp, int hDp, float density, long maxPixels) {
        float d = density;
        wDp = Math.max(110, Math.min(wDp, 2000));
        hDp = Math.max(110, Math.min(hDp, 2000));
        int W = Math.round(wDp * d), H = Math.round(hDp * d);
        long max = Math.max(200000L, Math.min(maxPixels, 2500000L));
        if ((long) W * H > max) {
            float s = (float) Math.sqrt((double) max / ((long) W * H));
            W = Math.round(W * s);
            H = Math.round(H * s);
            d = d * s;
        }
        return new float[]{Math.max(W, 10), Math.max(H, 10), d};
    }

    /** The header shared by both widgets: title (and a small line under it), ‹ ›, «+». Same columns as the month. */
    static void header(Canvas cv, Paint p, float W, float headH, float d, String title, String sub) {
        float[] hx = new float[5];
        float hsum = 0;
        for (float v : MonthWidget.HEAD_COLS) hsum += v;
        for (int i = 0; i < 4; i++) hx[i + 1] = hx[i] + W * MonthWidget.HEAD_COLS[i] / hsum;
        Typeface bold = Typeface.create(Typeface.DEFAULT, Typeface.BOLD);
        p.setTextAlign(Paint.Align.LEFT);
        p.setTypeface(bold);
        p.setColor(MonthWidget.INK);
        p.setTextSize(Math.min(headH * (sub == null ? 0.38f : 0.34f), 21 * d));
        cv.drawText(MonthWidget.fit(p, title, hx[1] - 18 * d), 16 * d, headH * (sub == null ? 0.62f : 0.5f), p);
        p.setTypeface(Typeface.DEFAULT);
        if (sub != null) {
            p.setColor(MonthWidget.MUTED);
            p.setTextSize(Math.min(headH * 0.2f, 12 * d));
            cv.drawText(MonthWidget.fit(p, sub, hx[1] - 18 * d), 16 * d, headH * 0.82f, p);
        }
        p.setTextAlign(Paint.Align.CENTER);
        p.setTextSize(Math.min(headH * 0.5f, 28 * d));
        p.setColor(MonthWidget.INK);
        cv.drawText("‹", (hx[1] + hx[2]) / 2, headH * 0.66f, p);
        cv.drawText("›", (hx[2] + hx[3]) / 2, headH * 0.66f, p);
        float pw = Math.min(hx[4] - hx[3] - 12 * d, 56 * d), ph = Math.min(headH * 0.56f, 36 * d);
        float pcx = (hx[3] + hx[4]) / 2 - 4 * d, pcy = headH * 0.52f;
        p.setColor(MonthWidget.ACCENT);
        cv.drawRoundRect(new RectF(pcx - pw / 2, pcy - ph / 2, pcx + pw / 2, pcy + ph / 2), ph / 2, ph / 2, p);
        p.setColor(MonthWidget.ACCENT_INK);
        p.setStrokeWidth(2.4f * d);
        float pl = ph * 0.26f;
        cv.drawLine(pcx - pl, pcy, pcx + pl, pcy, p);
        cv.drawLine(pcx, pcy - pl, pcx, pcy + pl, p);
        p.setColor(MonthWidget.LINE);
        p.setStrokeWidth(Math.max(1f, d * 0.8f));
        cv.drawLine(0, headH, W, headH, p);
    }

    static String stamp(JSONObject data, boolean ru) {
        long u = data == null ? 0 : data.optLong("u", 0);
        if (u <= 0) return null;
        Calendar uc = Calendar.getInstance(MonthWidget.baku(), Locale.US);
        uc.setTimeInMillis(u);
        String s = String.format(Locale.US, "%02d:%02d", uc.get(Calendar.HOUR_OF_DAY), uc.get(Calendar.MINUTE));
        if (!MonthWidget.iso(uc).equals(MonthWidget.iso(now()))) s = dm(MonthWidget.iso(uc), ru) + ", " + s;
        return (ru ? "Обновлено: " : "Yeniləndi: ") + s;
    }

    /** "p" = over and not cancelled (✓), "n" = did not come (✗), "" = still ahead. The widget marks it itself. */
    static String status(JSONArray it, String day, String todayIso, int nowMin) {
        String st = it.optString(2, "");
        int end = it.optInt(3, -1);
        if (st.isEmpty() && end >= 0 && (day.compareTo(todayIso) < 0 || (day.equals(todayIso) && end <= nowMin))) st = "p";
        return st;
    }

    static boolean out(JSONObject data) {
        return data == null || data.optInt("out", 0) == 1;
    }

    static boolean ru(JSONObject data) {
        return data != null && "ru".equals(data.optString("l", "az"));
    }

    /** mixes a colour with white (f = 0 … 1) */
    static int lighten(int c, float f) {
        int r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
        r += (int) ((255 - r) * f); g += (int) ((255 - g) * f); b += (int) ((255 - b) * f);
        return 0xFF000000 | (r << 16) | (g << 8) | b;
    }

    // ------------------------------------------------------------------ day

    static Bitmap renderDay(JSONObject data, int off, int wDp, int hDp, float density, long maxPixels, boolean dark) {
        float[] s = size(wDp, hDp, density, maxPixels);
        int W = (int) s[0], H = (int) s[1];
        float d = s[2];
        Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        MonthWidget.palette(dark);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(MonthWidget.BG);
        cv.drawRoundRect(new RectF(0, 0, W, H), 22 * d, 22 * d, p);

        boolean ru = ru(data);
        String day = dayIso(off);
        Calendar dc = cal(day), nowCal = now();
        String todayIso = MonthWidget.iso(nowCal);
        int nowMin = nowCal.get(Calendar.HOUR_OF_DAY) * 60 + nowCal.get(Calendar.MINUTE);
        String title = off == 0 ? (ru ? "Сегодня" : "Bugün") : off == 1 ? (ru ? "Завтра" : "Sabah") : off == -1 ? (ru ? "Вчера" : "Dünən")
                : (ru ? WDF_RU : WDF)[wd(dc)];
        String sub = dm(day, ru) + (off >= -1 && off <= 1 ? ", " + (ru ? WDF_RU : WDF)[wd(dc)] : "")
                + (dc.get(Calendar.YEAR) != nowCal.get(Calendar.YEAR) ? " " + dc.get(Calendar.YEAR) : "");
        float headH = H * DHEAD / DTOTAL;
        header(cv, p, W, headH, d, title, sub);

        float top = headH + 4 * d, footH = Math.min(18 * d, H * 0.07f), bottom = H - footH;
        if (out(data)) {
            MonthWidget.note(cv, p, ru ? "Откройте Mərkəz и войдите" : "Görmək üçün Mərkəz-i açıb daxil olun", W / 2f, (top + bottom) / 2f, d, W);
            return bmp;
        }
        String from = data.optString("f", "");
        JSONObject days = data.optJSONObject("d"), counts = data.optJSONObject("n");
        if (from.length() == 10 && day.compareTo(from) < 0) {
            MonthWidget.note(cv, p, ru ? "Откройте приложение, чтобы увидеть этот день" : "Bu günü görmək üçün tətbiqi açın", W / 2f, (top + bottom) / 2f, d, W);
            footer(cv, p, data, ru, W, H, footH, d);
            return bmp;
        }
        JSONArray items = days == null ? null : days.optJSONArray(day);
        int n = items == null ? 0 : items.length();
        int total = counts == null ? n : Math.max(n, counts.optInt(day, n));
        if (total == 0) {
            p.setTextAlign(Paint.Align.CENTER);
            p.setColor(MonthWidget.MUTED);
            p.setTextSize(Math.min(14 * d, W / 22f));
            cv.drawText(ru ? "Записей нет" : "Qəbul yoxdur", W / 2f, (top + bottom) / 2f, p);
            footer(cv, p, data, ru, W, H, footH, d);
            return bmp;
        }

        float rowH = Math.min(40 * d, Math.max(28 * d, (bottom - top) / 7f));
        int fit = Math.max(1, (int) Math.floor((bottom - top) / rowH));
        int show = total > fit ? Math.max(0, fit - 1) : Math.min(n, fit);
        show = Math.min(show, n);
        Typeface bold = Typeface.create(Typeface.DEFAULT, Typeface.BOLD);
        float padX = 14 * d;
        for (int i = 0; i < show; i++) {
            JSONArray it = items.optJSONArray(i);
            if (it == null) continue;
            float y = top + i * rowH;
            String st = status(it, day, todayIso, nowMin);
            int col = MonthWidget.parseColor(it.optString(1, ""), 0xFF4A4542);
            int start = it.optInt(4, -1), end = it.optInt(3, -1);
            String name = it.optString(0, ""), spec = it.optString(5, "");
            // the specialist's colour as a bar at the left; on the night look a little lighter, or the deep tones vanish
            if (MonthWidget.BG == 0xFF303147) col = lighten(col, 0.38f);
            p.setColor(col);
            if (!"".equals(st)) p.setAlpha(140);
            cv.drawRoundRect(new RectF(padX, y + rowH * 0.16f, padX + 4 * d, y + rowH * 0.84f), 2 * d, 2 * d, p);
            p.setAlpha(255);
            float tx = padX + 12 * d, timeW = 0;
            float big = Math.min(rowH * 0.36f, 15 * d), small = Math.min(rowH * 0.27f, 12 * d);
            p.setTextAlign(Paint.Align.LEFT);
            if (start >= 0) {
                p.setTypeface(bold);
                p.setTextSize(big);
                p.setColor("".equals(st) ? MonthWidget.INK : MonthWidget.MUTED);
                cv.drawText(hm(start), tx, y + rowH * 0.48f, p);
                timeW = p.measureText("00:00") + 10 * d;
                p.setTypeface(Typeface.DEFAULT);
            }
            String mark = "p".equals(st) ? "✓ " : "n".equals(st) ? "✗ " : "";
            p.setTextSize(big);
            p.setColor("".equals(st) ? MonthWidget.INK : MonthWidget.MUTED);
            cv.drawText(MonthWidget.fit(p, mark + name, W - tx - timeW - padX), tx + timeW, y + rowH * 0.48f, p);
            String line2 = (end >= 0 && start >= 0 ? "–" + hm(end) : "") + (spec.isEmpty() ? "" : (end >= 0 && start >= 0 ? " · " : "") + spec);
            if (!line2.isEmpty()) {
                p.setTextSize(small);
                p.setColor(MonthWidget.MUTED);
                cv.drawText(MonthWidget.fit(p, line2, W - tx - padX), tx, y + rowH * 0.82f, p);
            }
            if (i < show - 1 || total > show) {
                p.setColor(MonthWidget.LINE);
                p.setStrokeWidth(Math.max(1f, d * 0.6f));
                cv.drawLine(tx, y + rowH, W - padX, y + rowH, p);
            }
        }
        if (total > show) {
            p.setTextAlign(Paint.Align.LEFT);
            p.setColor(MonthWidget.MUTED);
            p.setTextSize(Math.min(rowH * 0.32f, 13 * d));
            cv.drawText("+" + (total - show) + (ru ? " ещё — откройте день" : " daha — günü açın"), padX + 12 * d, top + show * rowH + rowH * 0.6f, p);
        }
        footer(cv, p, data, ru, W, H, footH, d);
        return bmp;
    }

    static void footer(Canvas cv, Paint p, JSONObject data, boolean ru, float W, float H, float footH, float d) {
        String st = stamp(data, ru);
        if (st == null) return;
        p.setTextAlign(Paint.Align.RIGHT);
        p.setTypeface(Typeface.DEFAULT);
        p.setColor(MonthWidget.MUTED);
        p.setTextSize(Math.min(footH * 0.6f, 10.5f * d));
        cv.drawText(st, W - 14 * d, H - footH * 0.35f, p);
    }

    // ------------------------------------------------------------------ week

    static Bitmap renderWeek(JSONObject data, int off, int wDp, int hDp, float density, long maxPixels, boolean dark) {
        float[] s = size(wDp, hDp, density, maxPixels);
        int W = (int) s[0], H = (int) s[1];
        float d = s[2];
        Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        MonthWidget.palette(dark);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(MonthWidget.BG);
        cv.drawRoundRect(new RectF(0, 0, W, H), 22 * d, 22 * d, p);

        boolean ru = ru(data);
        String[] wk = weekDays(off);
        Calendar a = cal(wk[0]), b = cal(wk[6]), nowCal = now();
        String todayIso = MonthWidget.iso(nowCal);
        int nowMin = nowCal.get(Calendar.HOUR_OF_DAY) * 60 + nowCal.get(Calendar.MINUTE);
        String[] mg = ru ? MonthWidget.MONG_RU : MONG;
        String title = a.get(Calendar.MONTH) == b.get(Calendar.MONTH)
                ? a.get(Calendar.DAY_OF_MONTH) + "–" + b.get(Calendar.DAY_OF_MONTH) + " " + mg[b.get(Calendar.MONTH)]
                : a.get(Calendar.DAY_OF_MONTH) + " " + mg[a.get(Calendar.MONTH)] + " – " + b.get(Calendar.DAY_OF_MONTH) + " " + mg[b.get(Calendar.MONTH)];
        if (b.get(Calendar.YEAR) != nowCal.get(Calendar.YEAR)) title += " " + b.get(Calendar.YEAR);
        String sub = off == 0 ? (ru ? "Эта неделя" : "Bu həftə") : off == 1 ? (ru ? "Следующая неделя" : "Gələn həftə") : off == -1 ? (ru ? "Прошлая неделя" : "Keçən həftə") : null;
        // the hand-over time, short (the title column is narrow): «Bu həftə · 08:13»
        String st = out(data) ? null : stamp(data, ru);
        if (st != null) st = st.substring(st.indexOf(": ") + 2);
        if (st != null) sub = sub == null ? (ru ? "Обновлено: " : "Yeniləndi: ") + st : sub + " · " + st;
        float headH = H * WHEAD / WTOTAL, rowH = H * WROW / WTOTAL;
        header(cv, p, W, headH, d, title, sub);

        float labW = Math.min(W * 0.2f, 66 * d);
        Typeface bold = Typeface.create(Typeface.DEFAULT, Typeface.BOLD);
        boolean isOut = out(data);
        String from = isOut ? "" : data.optString("f", "");
        JSONObject days = isOut ? null : data.optJSONObject("d"), counts = isOut ? null : data.optJSONObject("n");
        Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG);
        tp.setColor(Color.WHITE);
        for (int k = 0; k < 7; k++) {
            String day = wk[k];
            float y = headH + k * rowH;
            boolean isToday = day.equals(todayIso);
            // the day: weekday letters over the day number; today in the accent colour
            p.setTextAlign(Paint.Align.CENTER);
            p.setTypeface(Typeface.DEFAULT);
            p.setColor(MonthWidget.MUTED);
            p.setTextSize(Math.min(rowH * 0.24f, 11 * d));
            float lx = 6 * d + labW / 2;
            cv.drawText((ru ? MonthWidget.WD_RU : MonthWidget.WD)[k], lx, y + rowH * 0.33f, p);
            float numSize = Math.min(rowH * 0.36f, 17 * d), ny = y + rowH * 0.76f;
            String num = String.valueOf(cal(day).get(Calendar.DAY_OF_MONTH));
            p.setTypeface(bold);
            p.setTextSize(numSize);
            if (isToday) {
                // today: the number in a pill of the accent colour, below the weekday letters
                float hw = p.measureText(num) / 2f + 6 * d;
                p.setColor(MonthWidget.ACCENT);
                cv.drawRoundRect(new RectF(lx - hw, ny - numSize * 0.92f, lx + hw, ny + numSize * 0.24f), numSize * 0.58f, numSize * 0.58f, p);
                p.setColor(MonthWidget.ACCENT_INK);
            } else {
                p.setColor(MonthWidget.INK);
            }
            cv.drawText(num, lx, ny, p);
            p.setTypeface(Typeface.DEFAULT);
            if (k > 0) {
                p.setColor(MonthWidget.LINE);
                p.setStrokeWidth(Math.max(1f, d * 0.6f));
                cv.drawLine(10 * d, y, W - 10 * d, y, p);
            }
            if (isOut || (from.length() == 10 && day.compareTo(from) < 0)) continue;
            JSONArray items = days == null ? null : days.optJSONArray(day);
            int n = items == null ? 0 : items.length();
            int total = counts == null ? n : Math.max(n, counts.optInt(day, n));
            if (total == 0) continue;

            // the names as chips in the specialist's colour, line after line; «+N» for the rest
            float chipH = Math.max(12 * d, Math.min(19 * d, rowH * 0.36f)), gap = 3 * d;
            int lines = Math.max(1, Math.min(3, (int) Math.floor((rowH - 2 * gap) / (chipH + gap))));
            float areaL = 6 * d + labW + 4 * d, areaR = W - 10 * d;
            float y0 = y + (rowH - (lines * chipH + (lines - 1) * gap)) / 2f;
            tp.setTextSize(chipH * 0.64f);
            p.setTextSize(chipH * 0.64f);
            float moreW = p.measureText("+99") + 6 * d;
            int line = 0, shown = 0;
            float x = areaL;
            for (int i = 0; i < n; i++) {
                JSONArray it = items.optJSONArray(i);
                if (it == null) continue;
                String stt = status(it, day, todayIso, nowMin);
                int start = it.optInt(4, -1);
                String label = ("p".equals(stt) ? "✓" : "n".equals(stt) ? "✗" : "") + (start >= 0 ? hm(start) + " " : "") + it.optString(0, "");
                float want = Math.min(tp.measureText(label) + 10 * d, (areaR - areaL - moreW) / 2f - gap);   // two names per line
                boolean lastLine = line == lines - 1;
                float limit = areaR - (lastLine && i < total - 1 ? moreW : 0);
                if (x + want > limit) {
                    if (lastLine || x == areaL) {
                        // a long name alone on a line is cut; otherwise the rest goes into «+N»
                        if (x == areaL && limit - x > 30 * d) want = limit - x;
                        else break;
                    } else {
                        line++;
                        x = areaL;
                        lastLine = line == lines - 1;
                        limit = areaR - (lastLine && i < total - 1 ? moreW : 0);
                        if (x + want > limit) want = Math.max(20 * d, limit - x);
                    }
                }
                float cy = y0 + line * (chipH + gap);
                RectF rc = new RectF(x, cy, x + want, cy + chipH);
                p.setColor(MonthWidget.parseColor(it.optString(1, ""), 0xFF4A4542));
                if (!"".equals(stt)) p.setAlpha(150);
                cv.drawRoundRect(rc, 4 * d, 4 * d, p);
                p.setAlpha(255);
                cv.drawText(MonthWidget.fit(tp, label, rc.width() - 8 * d), rc.left + 4 * d, rc.top + chipH * 0.72f, tp);
                x += want + gap;
                shown++;
            }
            if (total > shown) {
                p.setTextAlign(Paint.Align.LEFT);
                p.setColor(MonthWidget.MUTED);
                float cy = y0 + line * (chipH + gap);
                cv.drawText("+" + (total - shown), Math.min(x, areaR - moreW) + 2 * d, cy + chipH * 0.72f, p);
            }
        }
        if (isOut) {
            MonthWidget.note(cv, p, ru ? "Откройте Mərkəz и войдите" : "Görmək üçün Mərkəz-i açıb daxil olun", (labW + 10 * d + W) / 2f, headH + rowH * 3.6f, d, W - labW - 10 * d);
        } else if (from.length() == 10 && wk[6].compareTo(from) < 0) {
            MonthWidget.note(cv, p, ru ? "Откройте приложение, чтобы увидеть неделю" : "Bu həftəni görmək üçün tətbiqi açın", (labW + 10 * d + W) / 2f, headH + rowH * 3.6f, d, W - labW - 10 * d);
        }
        return bmp;
    }
}
