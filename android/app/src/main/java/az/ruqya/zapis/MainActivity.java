package az.ruqya.zapis;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Thin shell: shows the hosted web app full screen and hands other links to the phone. */
public class MainActivity extends Activity {

    private static final String HOST = "taghiyevalimt-png.github.io";
    private static final String HOME = "https://" + HOST + "/Ruqya/";
    private static final String OFFLINE =
            "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'></head>"
                    + "<body style='font-family:sans-serif;padding:48px 24px;text-align:center'>"
                    + "<h3>Нет интернета</h3><p>Проверьте подключение и попробуйте снова.</p>"
                    + "<p><a href='" + HOME + "'>Обновить</a></p></body></html>";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.parseColor("#0E6B5B"));

        web = new WebView(this);
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // No app can open this link; stay on the current page.
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(null, OFFLINE, "text/html", "utf-8", null);
                }
            }
        });

        if (state == null) {
            web.loadUrl(HOME);
        } else {
            web.restoreState(state);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
