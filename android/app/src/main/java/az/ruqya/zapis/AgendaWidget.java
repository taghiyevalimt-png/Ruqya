package az.ruqya.zapis;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * Owner 23.11: common part of the day and week widgets (DayWidget, WeekWidget). The picture comes from AgendaDraw;
 * transparent boxes of the layout catch the taps: the title and the list open that day in the app, ‹ › step a day
 * (or a week), «+» starts a new booking on that day. Data and colours are the month widget's (MonthWidget.PREFS).
 */
public abstract class AgendaWidget extends AppWidgetProvider {

    abstract boolean week();

    abstract String prevAction();

    abstract String nextAction();

    abstract Class<?> self();

    String key(int id) {
        return (week() ? "woff" : "doff") + id;
    }

    int limit() {
        return week() ? 26 : 120;
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) draw(ctx, mgr, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opts) {
        draw(ctx, mgr, id);
    }

    @Override
    public void onDeleted(Context ctx, int[] ids) {
        SharedPreferences.Editor e = ctx.getSharedPreferences(MonthWidget.PREFS, 0).edit();
        for (int id : ids) e.remove(key(id));
        e.apply();
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (prevAction().equals(a) || nextAction().equals(a)) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
            if (id != -1) {
                SharedPreferences p = ctx.getSharedPreferences(MonthWidget.PREFS, 0);
                int off = p.getInt(key(id), 0) + (prevAction().equals(a) ? -1 : 1);
                off = Math.max(-limit(), Math.min(limit(), off));
                p.edit().putInt(key(id), off).apply();
                draw(ctx, AppWidgetManager.getInstance(ctx), id);
            }
            return;
        }
        super.onReceive(ctx, intent);
    }

    PendingIntent shift(Context ctx, String action, int id) {
        Intent i = new Intent(ctx, self());
        i.setAction(action);
        i.setData(Uri.parse("ruqya://" + action + "/" + id));
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        return PendingIntent.getBroadcast(ctx, id, i, MonthWidget.flags());
    }

    void draw(Context ctx, AppWidgetManager mgr, int id) {
        try {
            drawOrThrow(ctx, mgr, id);
        } catch (Throwable ignored) {
            // A drawing problem must never crash the home screen.
        }
    }

    void drawOrThrow(Context ctx, AppWidgetManager mgr, int id) {
        Bundle o = mgr.getAppWidgetOptions(id);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
        if (w <= 0) w = 320;
        if (h <= 0) h = week() ? 360 : 250;
        int off = ctx.getSharedPreferences(MonthWidget.PREFS, 0).getInt(key(id), 0);
        float density = ctx.getResources().getDisplayMetrics().density;
        android.util.DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
        long screen = (long) dm.widthPixels * dm.heightPixels;
        long max = screen > 0 ? (long) (screen * 1.5 * 0.6) : 1500000L;
        org.json.JSONObject data = MonthWidget.data(ctx);
        boolean dark = MonthWidget.dark(ctx, data);
        Bitmap bmp = week() ? AgendaDraw.renderWeek(data, off, w, h, density, max, dark) : AgendaDraw.renderDay(data, off, w, h, density, max, dark);

        RemoteViews rv = new RemoteViews(ctx.getPackageName(), week() ? R.layout.widget_week : R.layout.widget_day);
        rv.setImageViewBitmap(R.id.img, bmp);
        rv.setOnClickPendingIntent(R.id.prev, shift(ctx, prevAction(), id));
        rv.setOnClickPendingIntent(R.id.next, shift(ctx, nextAction(), id));
        if (week()) {
            String[] days = AgendaDraw.weekDays(off);
            String first = days[0], today = AgendaDraw.dayIso(0);
            // the week's own day for the title and «+»: today in the current week, else its Monday
            String base = today.compareTo(days[0]) >= 0 && today.compareTo(days[6]) <= 0 ? today : first;
            rv.setOnClickPendingIntent(R.id.title, MonthWidget.open(ctx, "day", base, id * 100 + 90));
            rv.setOnClickPendingIntent(R.id.add, MonthWidget.open(ctx, "new", base, id * 100 + 92));
            for (int k = 0; k < 7; k++) {
                int vid = ctx.getResources().getIdentifier("w" + k, "id", ctx.getPackageName());
                if (vid != 0) rv.setOnClickPendingIntent(vid, MonthWidget.open(ctx, "day", days[k], id * 100 + k));
            }
        } else {
            String day = AgendaDraw.dayIso(off);
            rv.setOnClickPendingIntent(R.id.title, MonthWidget.open(ctx, "day", day, id * 100 + 90));
            rv.setOnClickPendingIntent(R.id.body, MonthWidget.open(ctx, "day", day, id * 100 + 91));
            rv.setOnClickPendingIntent(R.id.add, MonthWidget.open(ctx, "new", day, id * 100 + 92));
        }
        mgr.updateAppWidget(id, rv);
    }

    static void updateAll(Context ctx, Class<? extends AgendaWidget> cls) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            AgendaWidget w = cls.getDeclaredConstructor().newInstance();
            for (int id : mgr.getAppWidgetIds(new ComponentName(ctx, cls))) w.draw(ctx, mgr, id);
        } catch (Throwable ignored) {
            // never break the hand-over of data for the other widgets
        }
    }
}
