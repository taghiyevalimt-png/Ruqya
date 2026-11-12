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
        if (MonthWidget.ACTION_BIND_TEST.equals(a)) {
            MonthWidget.bindTest(ctx, intent);
            return;
        }
        if (MonthWidget.ACTION_TEST.equals(a)) {
            // Used by the automatic build check: draws the widget with sample data into a picture file.
            try {
                String json = intent.getStringExtra("json");
                String b64 = intent.getStringExtra("b64");
                if (b64 != null) json = new String(android.util.Base64.decode(b64, android.util.Base64.DEFAULT), "UTF-8");
                JSONObject d = json == null ? null : new JSONObject(json);
                Bitmap bmp = MonthWidget.render(ctx, d, intent.getIntExtra("off", 0),
                        intent.getIntExtra("w", 360), intent.getIntExtra("h", 380), intent.getFloatExtra("density", 3f), 2500000L);
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
