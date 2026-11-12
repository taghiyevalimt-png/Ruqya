package az.ruqya.zapis;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Home-screen month widget, in the style of the Google Calendar month widget.
 * The web app hands over the bookings through MainActivity's bridge (no password or token is kept here);
 * the month is drawn as one picture and transparent boxes on top catch the taps.
 */
public class MonthWidget extends AppWidgetProvider {

    static final String PREFS = "widget";
    static final String ACTION_PREV = "az.ruqya.zapis.WIDGET_PREV";
    static final String ACTION_NEXT = "az.ruqya.zapis.WIDGET_NEXT";
    static final String ACTION_TEST = "az.ruqya.zapis.WIDGET_TEST";

    static final String[] MON = {"Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"};
    static final String[] WD = {"B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"};

    // Proportions shared with res/layout/widget_month.xml (header 14, weekday row 8, six rows of 13).
    static final float HEAD = 14f, WKROW = 8f, ROW = 13f, TOTAL = HEAD + WKROW + 6 * ROW;
    static final float[] HEAD_COLS = {52f, 15f, 15f, 18f};

    static final int BG = 0xFF17201E, LINE = 0xFF2A3633, INK = 0xFFE6EEEB, MUTED = 0xFF93A39E,
            ACCENT = 0xFF4BBFA8, ACCENT_INK = 0xFF06211C;

    static TimeZone baku() {
        TimeZone tz = TimeZone.getTimeZone("Asia/Baku");
        return tz != null ? tz : TimeZone.getTimeZone("GMT+04:00");
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            draw(ctx, mgr, id);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opts) {
        draw(ctx, mgr, id);
    }

    @Override
    public void onDeleted(Context ctx, int[] ids) {
        SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, 0).edit();
        for (int id : ids) {
            e.remove("off" + id);
        }
        e.apply();
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (ACTION_PREV.equals(a) || ACTION_NEXT.equals(a)) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
            if (id != -1) {
                SharedPreferences p = ctx.getSharedPreferences(PREFS, 0);
                int off = p.getInt("off" + id, 0) + (ACTION_PREV.equals(a) ? -1 : 1);
                off = Math.max(-24, Math.min(24, off));
                p.edit().putInt("off" + id, off).apply();
                draw(ctx, AppWidgetManager.getInstance(ctx), id);
            }
            return;
        }
        if (ACTION_TEST.equals(a)) {
            // Used by the automatic build check: draws the widget with sample data into a picture file.
            try {
                String json = intent.getStringExtra("json");
                String b64 = intent.getStringExtra("b64");
                if (b64 != null) json = new String(android.util.Base64.decode(b64, android.util.Base64.DEFAULT), "UTF-8");
                JSONObject d = json == null ? null : new JSONObject(json);
                Bitmap bmp = render(ctx, d, intent.getIntExtra("off", 0),
                        intent.getIntExtra("w", 360), intent.getIntExtra("h", 380), intent.getFloatExtra("density", 3f));
                File f = new File(ctx.getFilesDir(), "widget_test.png");
                FileOutputStream out = new FileOutputStream(f);
                bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
                out.close();
            } catch (Throwable t) {
                try {
                    java.io.PrintWriter pw = new java.io.PrintWriter(new File(ctx.getFilesDir(), "widget_test.txt"));
                    t.printStackTrace(pw);
                    pw.close();
                } catch (Exception ignored) {
                }
            }
            return;
        }
        super.onReceive(ctx, intent);
    }

    /** Redraws every widget on the home screen; called when the app hands over new data. */
    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, MonthWidget.class));
        for (int id : ids) {
            draw(ctx, mgr, id);
        }
    }

    static JSONObject data(Context ctx) {
        try {
            String s = ctx.getSharedPreferences(PREFS, 0).getString("data", null);
            return s == null ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    }

    static PendingIntent open(Context ctx, String what, String date, int code) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction("az.ruqya.zapis.OPEN");
        i.setData(Uri.parse("ruqya://" + what + "/" + (date == null ? "" : date)));
        if (date != null) {
            i.putExtra("date", date);
        }
        i.putExtra("what", what);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, code, i, flags());
    }

    static PendingIntent shift(Context ctx, String action, int id) {
        Intent i = new Intent(ctx, MonthWidget.class);
        i.setAction(action);
        i.setData(Uri.parse("ruqya://" + action + "/" + id));
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        return PendingIntent.getBroadcast(ctx, id, i, flags());
    }

    static void draw(Context ctx, AppWidgetManager mgr, int id) {
        try {
            Bundle o = mgr.getAppWidgetOptions(id);
            int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
            int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
            if (w <= 0) w = 320;
            if (h <= 0) h = 340;
            int off = ctx.getSharedPreferences(PREFS, 0).getInt("off" + id, 0);
            float density = ctx.getResources().getDisplayMetrics().density;
            Bitmap bmp = render(ctx, data(ctx), off, w, h, density);

            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_month);
            rv.setImageViewBitmap(R.id.img, bmp);
            rv.setOnClickPendingIntent(R.id.title, open(ctx, "open", null, id * 100 + 90));
            rv.setOnClickPendingIntent(R.id.wk, open(ctx, "open", null, id * 100 + 91));
            rv.setOnClickPendingIntent(R.id.add, open(ctx, "new", null, id * 100 + 92));
            rv.setOnClickPendingIntent(R.id.prev, shift(ctx, ACTION_PREV, id));
            rv.setOnClickPendingIntent(R.id.next, shift(ctx, ACTION_NEXT, id));
            String[] days = gridDays(off);
            for (int k = 0; k < 42; k++) {
                int vid = ctx.getResources().getIdentifier("c" + k, "id", ctx.getPackageName());
                if (vid != 0) {
                    rv.setOnClickPendingIntent(vid, open(ctx, "day", days[k], id * 100 + k));
                }
            }
            mgr.updateAppWidget(id, rv);
        } catch (Exception ignored) {
            // A drawing problem must never crash the home screen.
        }
    }

    static Calendar today() {
        Calendar c = Calendar.getInstance(baku(), Locale.US);
        return c;
    }

    static String iso(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** The month shown, as a calendar on its first day at noon. */
    static Calendar monthStart(int off) {
        Calendar c = today();
        c.set(Calendar.HOUR_OF_DAY, 12);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.DAY_OF_MONTH, 1);
        c.add(Calendar.MONTH, off);
        return c;
    }

    /** The 42 dates of the grid, Monday first. */
    static String[] gridDays(int off) {
        Calendar c = monthStart(off);
        int back = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7; // Monday = 0
        c.add(Calendar.DAY_OF_MONTH, -back);
        String[] out = new String[42];
        for (int k = 0; k < 42; k++) {
            out[k] = iso(c);
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
        return out;
    }

    static int parseColor(String s, int dflt) {
        try {
            if (s != null && s.matches("#[0-9a-fA-F]{6}")) return Color.parseColor(s);
        } catch (Exception ignored) {
        }
        return dflt;
    }

    static String fit(Paint p, String s, float width) {
        if (p.measureText(s) <= width) return s;
        int n = p.breakText(s, true, Math.max(0, width), null);
        return s.substring(0, Math.max(0, n));
    }

    static Bitmap render(Context ctx, JSONObject data, int off, int wDp, int hDp, float density) {
        float d = density;
        int W = Math.round(wDp * d), H = Math.round(hDp * d);
        // Stay well inside the memory a home screen allows for one widget picture.
        float scale = 1f;
        long max = 1600L * 1600L;
        if ((long) W * H > max) {
            scale = (float) Math.sqrt((double) max / ((long) W * H));
            W = Math.round(W * scale);
            H = Math.round(H * scale);
            d = d * scale;
        }
        Bitmap bmp = Bitmap.createBitmap(Math.max(W, 10), Math.max(H, 10), Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Typeface bold = Typeface.create(Typeface.DEFAULT, Typeface.BOLD);

        p.setColor(BG);
        cv.drawRoundRect(new RectF(0, 0, W, H), 22 * d, 22 * d, p);

        float headH = H * HEAD / TOTAL, wkH = H * WKROW / TOTAL, rowH = H * ROW / TOTAL, colW = W / 7f;
        Calendar ms = monthStart(off);
        String todayIso = iso(today());
        String monthKey = String.format(Locale.US, "%04d-%02d", ms.get(Calendar.YEAR), ms.get(Calendar.MONTH) + 1);
        boolean out = data == null || data.optInt("out", 0) == 1;

        // Header: month name, arrows, "+".
        float x0 = 0;
        float[] hx = new float[5];
        float hsum = 0;
        for (float v : HEAD_COLS) hsum += v;
        hx[0] = 0;
        for (int i = 0; i < 4; i++) hx[i + 1] = hx[i] + W * HEAD_COLS[i] / hsum;
        String title = MON[ms.get(Calendar.MONTH)];
        if (ms.get(Calendar.YEAR) != today().get(Calendar.YEAR)) title += " " + ms.get(Calendar.YEAR);
        p.setTypeface(bold);
        p.setColor(INK);
        p.setTextSize(Math.min(headH * 0.36f, 22 * d));
        cv.drawText(fit(p, title, hx[1] - 18 * d), 16 * d, headH * 0.62f, p);
        p.setTypeface(Typeface.DEFAULT);
        p.setTextAlign(Paint.Align.CENTER);
        p.setTextSize(Math.min(headH * 0.5f, 28 * d));
        p.setColor(INK);
        cv.drawText("‹", (hx[1] + hx[2]) / 2, headH * 0.66f, p);
        cv.drawText("›", (hx[2] + hx[3]) / 2, headH * 0.66f, p);
        float pw = Math.min(hx[4] - hx[3] - 12 * d, 56 * d), ph = Math.min(headH * 0.56f, 36 * d);
        float pcx = (hx[3] + hx[4]) / 2 - 4 * d, pcy = headH * 0.52f;
        p.setColor(ACCENT);
        cv.drawRoundRect(new RectF(pcx - pw / 2, pcy - ph / 2, pcx + pw / 2, pcy + ph / 2), ph / 2, ph / 2, p);
        p.setColor(ACCENT_INK);
        p.setStrokeWidth(2.4f * d);
        float pl = ph * 0.26f;
        cv.drawLine(pcx - pl, pcy, pcx + pl, pcy, p);
        cv.drawLine(pcx, pcy - pl, pcx, pcy + pl, p);

        // Weekday letters.
        p.setColor(MUTED);
        p.setTextSize(Math.min(wkH * 0.5f, 13 * d));
        for (int i = 0; i < 7; i++) {
            cv.drawText(WD[i], colW * i + colW / 2, headH + wkH * 0.68f, p);
        }

        // Grid lines.
        float gy = headH + wkH;
        p.setColor(LINE);
        p.setStrokeWidth(Math.max(1f, d * 0.8f));
        for (int r = 0; r < 6; r++) cv.drawLine(0, gy + rowH * r, W, gy + rowH * r, p);
        for (int c = 1; c < 7; c++) cv.drawLine(colW * c, gy, colW * c, H - 10 * d, p);

        if (out) {
            p.setColor(MUTED);
            p.setTextSize(13 * d);
            cv.drawText("Görmək üçün Ruqyatz-ı açıb daxil olun", W / 2f, gy + rowH * 3, p);
            return bmp;
        }

        JSONObject days = data.optJSONObject("d");
        JSONObject counts = data.optJSONObject("n");
        String[] grid = gridDays(off);
        float numH = Math.min(rowH * 0.3f, 18 * d);
        float chipH = Math.max(12 * d, Math.min(17 * d, rowH * 0.24f));
        float chipGap = 2.5f * d, pad = 2.5f * d;
        Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG);
        tp.setTextSize(chipH * 0.68f);
        tp.setColor(Color.WHITE);

        for (int k = 0; k < 42; k++) {
            int r = k / 7, c = k % 7;
            String day = grid[k];
            float cx = colW * c, cy = gy + rowH * r;
            boolean inMonth = day.startsWith(monthKey);
            int dn = Integer.parseInt(day.substring(8));

            // Day number; today in a circle.
            p.setTextAlign(Paint.Align.CENTER);
            p.setTextSize(numH * 0.78f);
            float ny = cy + numH * 0.92f;
            if (day.equals(todayIso)) {
                p.setColor(ACCENT);
                cv.drawCircle(cx + colW / 2, ny - numH * 0.28f, numH * 0.6f, p);
                p.setColor(ACCENT_INK);
                p.setTypeface(bold);
            } else {
                p.setColor(inMonth ? INK : MUTED);
                p.setTypeface(Typeface.DEFAULT);
            }
            cv.drawText(String.valueOf(dn), cx + colW / 2, ny, p);
            p.setTypeface(Typeface.DEFAULT);

            JSONArray items = days == null ? null : days.optJSONArray(day);
            int total = counts == null ? (items == null ? 0 : items.length()) : counts.optInt(day, items == null ? 0 : items.length());
            if (items == null || items.length() == 0) continue;

            float top = cy + numH + 3 * d, bottom = cy + rowH - 2 * d;
            int room = (int) Math.floor((bottom - top + chipGap) / (chipH + chipGap));
            boolean more = total > room;
            int show = Math.min(items.length(), more ? Math.max(room - 1, 1) : room);
            if (room <= 0) show = 0;
            for (int i = 0; i < show; i++) {
                JSONArray it = items.optJSONArray(i);
                if (it == null) continue;
                String name = it.optString(0, "");
                int col = parseColor(it.optString(1, ""), 0xFF546E7A);
                String st = it.optString(2, "");
                float t = top + i * (chipH + chipGap);
                RectF rc = new RectF(cx + pad, t, cx + colW - pad, t + chipH);
                p.setColor(col);
                if ("n".equals(st)) p.setAlpha(150);
                if (!inMonth) p.setAlpha(110);
                cv.drawRoundRect(rc, 4 * d, 4 * d, p);
                p.setAlpha(255);
                String label = ("p".equals(st) ? "✓" : "n".equals(st) ? "✗ " : "") + name;
                tp.setAlpha(inMonth ? 255 : 170);
                cv.drawText(fit(tp, label, rc.width() - 5 * d), rc.left + 3 * d, rc.top + chipH * 0.74f, tp);
            }
            if (more || show < total) {
                p.setColor(MUTED);
                p.setTextAlign(Paint.Align.LEFT);
                p.setTextSize(chipH * 0.72f);
                float my = top + show * (chipH + chipGap) + chipH * 0.72f;
                if (my < cy + rowH) {
                    cv.drawText("+" + (total - show), cx + pad + 2 * d, my, p);
                }
            }
        }

        // When the data was last handed over by the app.
        long u = data.optLong("u", 0);
        if (u > 0) {
            Calendar uc = Calendar.getInstance(baku(), Locale.US);
            uc.setTimeInMillis(u);
            String stamp = String.format(Locale.US, "%02d:%02d", uc.get(Calendar.HOUR_OF_DAY), uc.get(Calendar.MINUTE));
            if (!iso(uc).equals(todayIso)) {
                stamp = uc.get(Calendar.DAY_OF_MONTH) + " " + MON[uc.get(Calendar.MONTH)].toLowerCase(new Locale("az")) + ", " + stamp;
            }
            p.setTextAlign(Paint.Align.LEFT);
            p.setColor(MUTED);
            p.setTextSize(Math.min(headH * 0.2f, 11 * d));
            cv.drawText("Yeniləndi: " + stamp, 16 * d, headH * 0.9f, p);
        }
        return bmp;
    }
}
