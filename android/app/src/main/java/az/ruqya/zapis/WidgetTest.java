package az.ruqya.zapis;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Only for the automatic build check. Guarded by the DUMP permission, which ordinary apps cannot hold
 * but the computer running the check (adb) has, so no other app can feed the widget made-up data.
 */
public class WidgetTest extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if ("az.ruqya.zapis.NOTIFY_TEST".equals(a)) {
            // 24.11 check: what the server's poll answers, applied without the network — news shown at once, a reminder's
            // exact alarm («in_s» seconds from now, N minutes before), the 15-minute check kept; {"gone":true} stops it all
            try {
                org.json.JSONObject r = new org.json.JSONObject(new String(android.util.Base64.decode(intent.getStringExtra("b64"), android.util.Base64.DEFAULT), "UTF-8"));
                org.json.JSONArray up = r.optJSONArray("upcoming");
                if (up != null) for (int i = 0; i < up.length(); i++) { org.json.JSONObject x = up.getJSONObject(i); if (x.has("in_s")) x.put("at", System.currentTimeMillis() + x.getLong("in_s") * 1000L); }
                if (!r.optBoolean("gone", false)) { Notify.prefs(ctx).edit().putString("token", "00000000-0000-4000-8000-000000000000").putString("url", "https://invalid.example").putString("key", "test-key-xx").apply(); Notify.schedule(ctx); }
                Notify.apply(ctx, r);
            } catch (Throwable t) {
                try { java.io.PrintWriter pw = new java.io.PrintWriter(new File(ctx.getFilesDir(), "notify_test.txt")); pw.println("error " + t); pw.close(); } catch (Exception ignored) { }
            }
            return;
        }
        if ("az.ruqya.zapis.CONTACTS_TEST".equals(a)) {
            // owner 18.11 check: the same import the app runs (permissions granted by adb), result into a file
            String out;
            try {
                String json = new String(android.util.Base64.decode(intent.getStringExtra("b64"), android.util.Base64.DEFAULT), "UTF-8");
                int[] r = Contacts.importAll(ctx, new org.json.JSONArray(json));
                out = "added=" + r[0] + " skipped=" + r[1];
            } catch (Throwable t) {
                out = "error " + t;
            }
            try {
                java.io.PrintWriter pw = new java.io.PrintWriter(new File(ctx.getFilesDir(), "contacts_test.txt"));
                pw.println(out);
                pw.close();
            } catch (Exception ignored) {
            }
            return;
        }
        if (MonthWidget.ACTION_BIND_TEST.equals(a)) {
            String kind = intent.getStringExtra("kind");   // owner 23.11: day / week widgets
            if ("day".equals(kind)) AgendaWidget.bindTest(ctx, DayWidget.class, "day");
            else if ("week".equals(kind)) AgendaWidget.bindTest(ctx, WeekWidget.class, "week");
            else MonthWidget.bindTest(ctx, intent);
            return;
        }
        if (MonthWidget.ACTION_TEST.equals(a)) {
            // Used by the automatic build check: draws the widget with sample data into a picture file.
            try {
                String json = intent.getStringExtra("json");
                String b64 = intent.getStringExtra("b64");
                if (b64 != null) json = new String(android.util.Base64.decode(b64, android.util.Base64.DEFAULT), "UTF-8");
                JSONObject d = json == null ? null : new JSONObject(json);
                // "now": apply the 12-hour rule of the real widget at this moment (B-06 check)
                long now = intent.getLongExtra("now", 0);
                if (now > 0) d = MonthWidget.fresh(d, now);
                // owner 23.11: "kind" = day / week draws the new widgets; "at" = the date taken as today (sample data)
                String kind = intent.getStringExtra("kind");
                AgendaDraw.testToday = intent.getStringExtra("at");
                int off = intent.getIntExtra("off", 0), w = intent.getIntExtra("w", 360), h = intent.getIntExtra("h", 380);
                float dens = intent.getFloatExtra("density", 3f);
                Bitmap bmp = "day".equals(kind) ? AgendaDraw.renderDay(d, off, w, h, dens, 2500000L, MonthWidget.dark(ctx, d))
                        : "week".equals(kind) ? AgendaDraw.renderWeek(d, off, w, h, dens, 2500000L, MonthWidget.dark(ctx, d))
                        : MonthWidget.render(ctx, d, off, w, h, dens, 2500000L);
                AgendaDraw.testToday = null;
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
    }
}
