package az.ruqya.zapis;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 24.11: a reminder's exact alarm (N minutes before a session) — shows it; after a restart of the phone: set it all up again. */
public class NotifyAlarm extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if ("az.ruqya.zapis.REMIND".equals(a)) {
            Notify.reminded(c, i.getStringExtra("id") == null ? "r?" : i.getStringExtra("id"), i.getStringExtra("text"));
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            if (!Notify.prefs(c).getString("token", "").isEmpty()) {
                Notify.schedule(c);
                final PendingResult pr = goAsync();
                final Context ac = c.getApplicationContext();
                new Thread(new Runnable() { public void run() { try { Notify.poll(ac); } finally { pr.finish(); } } }).start();
            }
        }
    }
}
