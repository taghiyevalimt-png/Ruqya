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
    private static final String OFFLINE =
            "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'></head>"
                    + "<body style='font-family:sans-serif;padding:48px 24px;text-align:center;background:#050505;color:#f4ecd8'>"
                    + "<h3>İnternet yoxdur</h3><p>Bağlantını yoxlayın və yenidən cəhd edin.</p>"
                    + "<h3>Нет интернета</h3><p>Проверьте подключение и попробуйте снова.</p>"
                    + "<p><a style='color:#d4b062' href='" + HOME + "'>Yenilə · Обновить</a></p></body></html>";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(Color.parseColor("#050505"));
        }

        web = new WebView(this);
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

    /** What the web page may ask of the phone: only the widget, nothing else. */
    public class Bridge {
        @JavascriptInterface
        public int version() {
            return 1;
        }

        @JavascriptInterface
        public void setWidgetData(String json) {
            if (json == null || json.length() > 400000) return;
            getSharedPreferences(MonthWidget.PREFS, 0).edit().putString("data", json).apply();
            MonthWidget.updateAll(MainActivity.this);
        }

        @JavascriptInterface
        public int widgetCount() {
            return AppWidgetManager.getInstance(MainActivity.this)
                    .getAppWidgetIds(new ComponentName(MainActivity.this, MonthWidget.class)).length;
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

    /** Returns true when the link was handed to another app. */
    private boolean handle(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if (("https".equals(scheme) || "http".equals(scheme)) && HOST.equals(uri.getHost())) {
            return false;
        }
        try {
            Intent intent;
            if ("intent".equals(scheme)) {
                intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
            } else {
                intent = new Intent(Intent.ACTION_VIEW, uri);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Bu linki açacaq proqram tapılmadı · Нет приложения для этой ссылки", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Linki açmaq olmadı · Не удалось открыть ссылку", Toast.LENGTH_LONG).show();
        }
        return true;
    }

    private void showOffline(WebView view) {
        view.loadDataWithBaseURL(HOME, OFFLINE, "text/html", "utf-8", null);
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
