package az.ruqya.zapis;

import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;

/** Thin shell: shows the hosted web app full screen and hands other links to the phone. */
public class MainActivity extends Activity {

    private static final String HOST = "taghiyevalimt-png.github.io";
    private static final String HOME = "https://" + HOST + "/Ruqya/";
    private static final String OFFLINE =
            "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'></head>"
                    + "<body style='font-family:sans-serif;padding:48px 24px;text-align:center'>"
                    + "<h3>İnternet yoxdur</h3><p>Bağlantını yoxlayın və yenidən cəhd edin.</p>"
                    + "<p><a href='" + HOME + "'>Yenilə</a></p></body></html>";

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
        settings.setUserAgentString(settings.getUserAgentString() + " RuqyaApp");

        if (Build.VERSION.SDK_INT >= 29) {
            web.addJavascriptInterface(new Bridge(), "RuqyaNative");
        }
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

    /** Lets the page hand over a generated Excel file: saved to Downloads, then offered for sharing. */
    @TargetApi(29)
    private class Bridge {
        private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        @JavascriptInterface
        public void saveFile(String name, String base64) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, XLSX);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                final Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    throw new IllegalStateException("no uri");
                }
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    out.write(data);
                }
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Fayl «Yükləmələr» qovluğunda saxlanıldı", Toast.LENGTH_LONG).show();
                    try {
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType(XLSX);
                        send.putExtra(Intent.EXTRA_STREAM, uri);
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(send, name));
                    } catch (Exception ignored) {
                        // The file is saved; sharing is optional.
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() ->
                        Toast.makeText(MainActivity.this, "Faylı saxlamaq olmadı", Toast.LENGTH_LONG).show());
            }
        }
    }
}
