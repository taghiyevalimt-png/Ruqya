package az.ruqya.zapis;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 24.11 (owner): notifications for a specialist, off by default (Ayarlar → Bildirişlər in the page).
 * The page gives a device token (public.ruqya_notify_device) and the server address; this class then asks the server
 * every 15 minutes, also with the app closed (JobScheduler, kept over a restart), what is new
 * (public.ruqya_notify_poll): a notice for each session booked for him, and his next sessions — for each an exact alarm
 * N minutes before (AlarmManager), which shows the reminder on time even without internet at that moment.
 * When both are off on the server, the check stops by itself.
 */
public final class Notify {
    static final String PREFS = "ruqya.notify", CHANNEL = "seans";
    static final int JOB = 4711;

    private Notify() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, 0); }

    /** from the page: {"on":true,"token":"…","url":"https://….supabase.co","key":"sb_publishable_…"} or {"on":false} */
    static void config(Context c, String json) {
        try {
            JSONObject o = new JSONObject(json);
            if (!o.optBoolean("on", false)) { stop(c, true); return; }
            String tok = o.optString("token", ""), url = o.optString("url", ""), key = o.optString("key", "");
            if (tok.length() < 30 || !url.startsWith("https://") || key.length() < 10) return;
            prefs(c).edit().putString("token", tok).putString("url", url).putString("key", key).apply();
            schedule(c);
            pollSoon(c);
        } catch (Exception ignored) {
        }
    }

    static void schedule(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        JobInfo.Builder b = new JobInfo.Builder(JOB, new ComponentName(c, NotifyJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(15 * 60 * 1000L)
                .setPersisted(true);
        try { js.schedule(b.build()); } catch (Exception ignored) { }
    }

    /** stops the check and the alarms; «forget» also drops the token (sign-out) */
    static void stop(Context c, boolean forget) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB);
        cancelAlarms(c);
        if (forget) prefs(c).edit().remove("token").remove("shown").apply();
    }

    static void pollSoon(final Context c) {
        final Context a = c.getApplicationContext();
        new Thread(new Runnable() { public void run() { poll(a); } }).start();
    }

    /** one check; returns false when there is nothing to do any more */
    static boolean poll(Context c) {
        SharedPreferences p = prefs(c);
        String tok = p.getString("token", ""), url = p.getString("url", ""), key = p.getString("key", "");
        if (tok.isEmpty() || url.isEmpty()) { stop(c, false); return false; }
        JSONObject r;
        try {
            HttpURLConnection h = (HttpURLConnection) new URL(url + "/rest/v1/rpc/ruqya_notify_poll").openConnection();
            h.setConnectTimeout(15000);
            h.setReadTimeout(20000);
            h.setRequestMethod("POST");
            h.setDoOutput(true);
            h.setRequestProperty("apikey", key);
            h.setRequestProperty("Authorization", "Bearer " + key);
            h.setRequestProperty("Content-Type", "application/json");
            OutputStream os = h.getOutputStream();
            os.write(("{\"p_token\":\"" + tok.replaceAll("[^0-9a-fA-F-]", "") + "\"}").getBytes("UTF-8"));
            os.close();
            if (h.getResponseCode() != 200) return true;   // the server is busy: next time
            InputStream in = h.getInputStream();
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            in.close();
            r = new JSONObject(bo.toString("UTF-8"));
        } catch (Exception e) {
            return true;   // no internet now: next time
        }
        return apply(c, r);
    }

    /** what the server said (also used by the emulator test with a fixed answer) */
    static boolean apply(Context c, JSONObject r) {
        if (r.optBoolean("gone", false)) { stop(c, true); return false; }
        boolean rem = !r.isNull("remind_min") && r.optInt("remind_min", 0) > 0, nw = r.optBoolean("on_new", false);
        JSONArray shown = shown(c);
        JSONArray news = r.optJSONArray("news");
        if (news != null) for (int i = 0; i < news.length(); i++) {
            JSONObject x = news.optJSONObject(i);
            if (x == null) continue;
            String id = "n" + x.optString("id");
            if (has(shown, id)) continue;
            show(c, id.hashCode(), x.optString("text"));
            shown.put(id);
        }
        cancelAlarms(c);
        JSONArray set = new JSONArray();
        if (rem) {
            long before = r.optInt("remind_min") * 60000L, now = System.currentTimeMillis();
            JSONArray up = r.optJSONArray("upcoming");
            if (up != null) for (int i = 0; i < up.length() && set.length() < 60; i++) {
                JSONObject x = up.optJSONObject(i);
                if (x == null) continue;
                String id = "r" + x.optString("id");
                long at = x.optLong("at"), when = at - before;
                if (at <= now || has(shown, id)) continue;
                if (when < now) when = now + 2000;   // turned on late, or the session was booked inside the window: now
                alarm(c, id, when, x.optString("text"));
                set.put(id);
            }
        }
        while (shown.length() > 300) shown.remove(0);
        prefs(c).edit().putString("shown", shown.toString()).putString("alarms", set.toString()).apply();
        if (!rem && !nw) { stop(c, false); return false; }
        return true;
    }

    static JSONArray shown(Context c) {
        try { return new JSONArray(prefs(c).getString("shown", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    static boolean has(JSONArray a, String s) {
        for (int i = 0; i < a.length(); i++) if (s.equals(a.optString(i))) return true;
        return false;
    }

    static int piFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    }

    static PendingIntent alarmIntent(Context c, String id, String text) {
        Intent i = new Intent(c, NotifyAlarm.class).setAction("az.ruqya.zapis.REMIND").putExtra("id", id).putExtra("text", text == null ? "" : text);
        return PendingIntent.getBroadcast(c, id.hashCode(), i, piFlags());
    }

    static void alarm(Context c, String id, long when, String text) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(c, id, text);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            else if (Build.VERSION.SDK_INT >= 23) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            else am.setExact(AlarmManager.RTC_WAKEUP, when, pi);
        } catch (Exception e) {
            try { am.set(AlarmManager.RTC_WAKEUP, when, pi); } catch (Exception ignored) { }
        }
    }

    static void cancelAlarms(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            JSONArray a = new JSONArray(prefs(c).getString("alarms", "[]"));
            for (int i = 0; i < a.length(); i++) am.cancel(alarmIntent(c, a.optString(i), null));
        } catch (Exception ignored) {
        }
        prefs(c).edit().putString("alarms", "[]").apply();
    }

    /** a reminder's alarm went off: show it once */
    static void reminded(Context c, String id, String text) {
        JSONArray shown = shown(c);
        if (has(shown, id)) return;
        show(c, id.hashCode(), text);
        shown.put(id);
        prefs(c).edit().putString("shown", shown.toString()).apply();
    }

    static void show(Context c, int id, String text) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Seanslar · Сеансы", NotificationManager.IMPORTANCE_HIGH);
                ch.enableVibration(true);
                nm.createNotificationChannel(ch);
            }
            b = new Notification.Builder(c, CHANNEL);
        } else {
            b = new Notification.Builder(c).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 7, open, piFlags());
        b.setSmallIcon(R.drawable.ic_stat).setContentTitle("Mərkəz").setContentText(text).setAutoCancel(true).setContentIntent(pi)
                .setStyle(new Notification.BigTextStyle().bigText(text)).setWhen(System.currentTimeMillis()).setShowWhen(true);
        if (Build.VERSION.SDK_INT >= 21) b.setCategory(Notification.CATEGORY_REMINDER).setColor(0xFF405577);
        try { nm.notify(id, b.build()); } catch (Exception ignored) { }
    }
}
