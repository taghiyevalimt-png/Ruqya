package az.ruqya.zapis;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Thin shell: shows the hosted web app full screen and hands every other link
 * (WhatsApp, phone calls, other sites) to the phone. Written to work from Android 5.
 */
public class MainActivity extends Activity {

    private static final String HOST = "taghiyevalimt-png.github.io";
    private static final String HOME = "https://" + HOST + "/Ruqya/";
    // 24.11 (evening): two looks — night (#303147, the default) and sand (#CEBBA0); the page tells which via setLook
    static final String LOOK_PREFS = "ruqya.look";
    static boolean sand(android.content.Context c) {
        return "sand".equals(c.getSharedPreferences(LOOK_PREFS, 0).getString("look", "night"));
    }
    private void applyLook() {
        boolean sand = sand(this);
        int bg = Color.parseColor(sand ? "#CEBBA0" : "#303147"), bar = Color.parseColor(sand ? "#9A765E" : "#303147");
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(bg));
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(bar);
            getWindow().setNavigationBarColor(bar);
        }
        if (web != null) web.setBackgroundColor(bg);
    }
    private String offline() {
        boolean sand = sand(this);
        return OFFLINE.replace("#CEBBA0", sand ? "#CEBBA0" : "#303147").replace("#3A2C22", sand ? "#3A2C22" : "#EFEBF3").replace("#9A765E", sand ? "#9A765E" : "#AEB3D8");
    }
    private static final String OFFLINE =
            "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'></head>"
                    + "<body style='font-family:sans-serif;padding:48px 24px;text-align:center;background:#CEBBA0;color:#3A2C22'>"
                    + "<h3>İnternet yoxdur</h3><p>Bağlantını yoxlayın və yenidən cəhd edin.</p>"
                    + "<h3>Нет интернета</h3><p>Проверьте подключение и попробуйте снова.</p>"
                    + "<p><a style='color:#9A765E' href='" + HOME + "'>Yenilə · Обновить</a></p></body></html>";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        applyLook();   // no flash before the page paints: the colour of the chosen look
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setTextZoom(100);
        settings.setUserAgentString(settings.getUserAgentString() + " RuqyaApp");

        web.addJavascriptInterface(new Bridge(), "RuqyaApp");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            // Android 7 and newer.
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handle(request.getUrl());
            }

            // Android 5 and 6 only call this older version.
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handle(Uri.parse(url));
            }

            // Android 6 and newer.
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showOffline(view);
                }
            }

            // Android 5.
            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int code, String description, String failingUrl) {
                if (Build.VERSION.SDK_INT < 23) {
                    showOffline(view);
                }
            }

            // Android 6 and newer: the site itself answered with a server error.
            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) {
                    showOffline(view);
                }
            }

            // Android 8 and newer: the phone ran out of memory and stopped the page.
            // Start the screen again instead of letting the whole app close.
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (web != null) {
                    ViewGroup parent = (ViewGroup) web.getParent();
                    if (parent != null) {
                        parent.removeView(web);
                    }
                    web.destroy();
                    web = null;
                }
                recreate();
                return true;
            }
        });

        String jump = jump(getIntent());
        if (jump != null) {
            web.loadUrl(HOME + "#" + jump);
        } else if (state == null || web.restoreState(state) == null) {
            web.loadUrl(HOME);
        }
    }

    /** From a widget tap: "d=2026-11-14" to open a day, "new=..." to start a booking, or null. */
    private static String jump(Intent i) {
        if (i == null || !"az.ruqya.zapis.OPEN".equals(i.getAction())) return null;
        String what = i.getStringExtra("what");
        String date = i.getStringExtra("date");
        if (date != null && !date.matches("\\d{4}-\\d{2}-\\d{2}")) date = null;
        if ("new".equals(what)) return "new=" + (date == null ? "" : date);
        if ("day".equals(what) && date != null) return "d=" + date;
        return null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String j = jump(intent);
        if (j == null || web == null) return;
        String[] kv = j.split("=", 2);
        String js = "window.ruqyaOpen&&window.ruqyaOpen('" + (kv.length > 1 ? kv[1] : "") + "'," + ("new".equals(kv[0]) ? "true" : "false") + ")";
        final String url = HOME + "#" + j;
        // If the page is not ready to take the jump (still loading, or the offline page), load it with the jump.
        web.evaluateJavascript("(function(){if(window.ruqyaOpen){" + js + ";return 'ok'}return 'no'})()", v -> {
            if (v == null || !v.contains("ok")) {
                if (web != null) web.loadUrl(url);
            }
        });
    }

    /** Owner 18.11: patients into the phone's contacts. The list waits here while the phone asks for permission. */
    private static final int CONTACTS_REQ = 77;
    private String pendingContacts;

    private void contactsDone(final int added, final int skipped, final String err) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript("window.ruqyaContactsDone&&window.ruqyaContactsDone(" + added + "," + skipped + ",'" + err + "')", null);
        });
    }

    private void runContactsImport() {
        final String json = pendingContacts;
        pendingContacts = null;
        if (json == null) return;
        new Thread(() -> {
            try {
                int[] r = Contacts.importAll(MainActivity.this, new org.json.JSONArray(json));
                contactsDone(r[0], r[1], "");
            } catch (Exception e) {
                contactsDone(0, 0, "error");
            }
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code != CONTACTS_REQ) return;
        boolean ok = res.length > 0;
        for (int r : res) ok = ok && r == android.content.pm.PackageManager.PERMISSION_GRANTED;
        if (ok) runContactsImport();
        else {
            pendingContacts = null;
            contactsDone(0, 0, "denied");
        }
    }

    /** What the web page may ask of the phone: the widget, saving the Excel file and adding contacts. */
    public class Bridge {
        @JavascriptInterface
        public int version() {
            return 3;
        }

        /** [[name, phone], …] from the patients' list: added straight into the phone's contacts (after permission). */
        @JavascriptInterface
        public boolean importContacts(final String json) {
            if (json == null || json.length() > 5000000) return false;
            runOnUiThread(() -> {
                pendingContacts = json;
                if (Build.VERSION.SDK_INT >= 23 && (checkSelfPermission(android.Manifest.permission.WRITE_CONTACTS) != android.content.pm.PackageManager.PERMISSION_GRANTED
                        || checkSelfPermission(android.Manifest.permission.READ_CONTACTS) != android.content.pm.PackageManager.PERMISSION_GRANTED)) {
                    requestPermissions(new String[]{android.Manifest.permission.READ_CONTACTS, android.Manifest.permission.WRITE_CONTACTS}, CONTACTS_REQ);
                } else {
                    runContactsImport();
                }
            });
            return true;
        }

        /** The admin's Excel file or PDF report: written to Downloads (Android 10 and newer), then opened. */
        @JavascriptInterface
        @android.annotation.SuppressLint("NewApi")
        public boolean saveFile(String name, String b64) {
            if (name == null || b64 == null || b64.length() > 40000000) return false;
            final String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
            final boolean pdf = safe.endsWith(".pdf");   // 24.11: the period's PDF report too
            if (!(safe.endsWith(".xlsx") || pdf) || Build.VERSION.SDK_INT < 29) return false;
            final String mime = pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            try {
                byte[] data = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                android.content.ContentValues v = new android.content.ContentValues();
                v.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, safe);
                v.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1);
                final Uri uri = getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return false;
                try {
                    java.io.OutputStream o = getContentResolver().openOutputStream(uri);
                    if (o == null) throw new java.io.IOException("no stream");
                    try {
                        o.write(data);
                    } finally {
                        o.close();
                    }
                    android.content.ContentValues done = new android.content.ContentValues();
                    done.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0);
                    getContentResolver().update(uri, done, null, null);
                } catch (Exception e) {
                    try { getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
                    return false;
                }
                runOnUiThread(() -> {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW);
                        i.setDataAndType(uri, mime);
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(i);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, safe, Toast.LENGTH_LONG).show();
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** 24.11 notifications: start or stop the check (see Notify); asks Android 13+ for permission to show them */
        @JavascriptInterface
        public void notifyConfig(final String json) {
            Notify.config(MainActivity.this, json);
            if (json != null && json.contains("\"on\":true") && Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() { public void run() { requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 31); } });
            }
        }

        @JavascriptInterface
        public void notifyTest(String text) {
            Notify.show(MainActivity.this, 1, text == null || text.isEmpty() ? "✓" : text);
        }

        @JavascriptInterface
        public void setLook(final String look) {
            String l = "sand".equals(look) ? "sand" : "night";
            getSharedPreferences(LOOK_PREFS, 0).edit().putString("look", l).apply();
            runOnUiThread(new Runnable() { public void run() { applyLook(); } });
        }

        @JavascriptInterface
        public void setWidgetData(String json) {
            if (json == null || json.length() > 400000) return;
            getSharedPreferences(MonthWidget.PREFS, 0).edit().putString("data", json).apply();
            MonthWidget.updateAll(MainActivity.this);
        }

        @JavascriptInterface
        public int widgetCount() {
            AppWidgetManager m = AppWidgetManager.getInstance(MainActivity.this);
            return m.getAppWidgetIds(new ComponentName(MainActivity.this, MonthWidget.class)).length
                    + m.getAppWidgetIds(new ComponentName(MainActivity.this, DayWidget.class)).length
                    + m.getAppWidgetIds(new ComponentName(MainActivity.this, WeekWidget.class)).length;
        }

        /** Owner 23.11: «month», «day» or «week» widget onto the home screen (Android 8 and newer, one confirmation). */
        @JavascriptInterface
        public boolean pinWidgetOf(String kind) {
            if (Build.VERSION.SDK_INT < 26) return false;
            Class<?> c = "day".equals(kind) ? DayWidget.class : "week".equals(kind) ? WeekWidget.class : MonthWidget.class;
            try {
                AppWidgetManager m = getSystemService(AppWidgetManager.class);
                if (m == null || !m.isRequestPinAppWidgetSupported()) return false;
                return m.requestPinAppWidget(new ComponentName(MainActivity.this, c), null, null);
            } catch (Exception e) {
                return false;
            }
        }

        /** Android 8 and newer can place the widget on the home screen after one confirmation. */
        @JavascriptInterface
        public boolean pinWidget() {
            if (Build.VERSION.SDK_INT < 26) return false;
            try {
                AppWidgetManager m = getSystemService(AppWidgetManager.class);
                if (m == null || !m.isRequestPinAppWidgetSupported()) return false;
                return m.requestPinAppWidget(new ComponentName(MainActivity.this, MonthWidget.class), null, null);
            } catch (Exception e) {
                return false;
            }
        }
    }

    /** WhatsApp Business first, then the ordinary WhatsApp (owner 17.11). */
    static final String[] WA_PACKAGES = {"com.whatsapp.w4b", "com.whatsapp"};

    /** wa.me / api.whatsapp.com links and the whatsapp: scheme. */
    static boolean isWhatsApp(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(java.util.Locale.ROOT);
        return "whatsapp".equals(scheme)
                || ("https".equals(scheme) && ("wa.me".equals(host) || "api.whatsapp.com".equals(host) || "www.whatsapp.com".equals(host)));
    }

    /** Returns true when the link was handed to another app. */
    private boolean handle(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        // Only this app's own pages stay inside (other sites of the same GitHub account open outside).
        String path = uri.getPath() == null ? "" : uri.getPath();
        if ("https".equals(scheme) && HOST.equals(uri.getHost()) && (path.equals("/Ruqya") || path.startsWith("/Ruqya/"))) {
            return false;
        }
        try {
            Intent intent;
            if ("intent".equals(scheme)) {
                // Only what a browser would allow: no named component, no selector, browsable targets only.
                intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                intent.setComponent(null);
                if (Build.VERSION.SDK_INT >= 15) {
                    intent.setSelector(null);
                }
            } else {
                intent = new Intent(Intent.ACTION_VIEW, uri);
            }
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);   // no flags taken from the link itself
            // Owner 17.11: WhatsApp links (Wp, «Təsdiq») open WhatsApp Business first; without it the ordinary WhatsApp;
            // without both, whatever the phone offers (browser).
            if (isWhatsApp(uri)) {
                for (String pkg : WA_PACKAGES) {
                    try {
                        Intent wa = new Intent(Intent.ACTION_VIEW, uri);
                        wa.setPackage(pkg);
                        wa.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(wa);
                        return true;
                    } catch (ActivityNotFoundException notInstalled) {
                        // try the next one
                    }
                }
            }
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Bu linki açacaq proqram tapılmadı · Нет приложения для этой ссылки", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Linki açmaq olmadı · Не удалось открыть ссылку", Toast.LENGTH_LONG).show();
        }
        return true;
    }

    private void showOffline(WebView view) {
        view.loadDataWithBaseURL(HOME, offline(), "text/html", "utf-8", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) {
            web.saveState(out);
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
