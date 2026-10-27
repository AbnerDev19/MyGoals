package com.abner.mygoals;

import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Atividade única do MyGoals: hospeda a interface web empacotada em assets/www.
 *
 * Decisões de segurança e compatibilidade:
 * - Só carrega file:///android_asset/www/ (conteúdo próprio). Outras navegações são bloqueadas.
 * - Rede bloqueada no WebView (o app é offline e não declara permissão INTERNET).
 * - A URL de origem NÃO deve mudar: o localStorage do WebView é indexado por origem e mudar
 *   a URL faria os dados atuais dos usuários "sumirem".
 * - A ponte JavaScript expõe apenas duas ações inofensivas (cor das barras e salvar backup).
 */
public class MainActivity extends Activity {
    private static final String APP_URL = "file:///android_asset/www/index.html";
    private static final String APP_URL_PREFIX = "file:///android_asset/www/";
    private static final int REQ_FILE_PICKER = 1207;
    private static final int REQ_SAVE_FILE = 1208;

    private WebView webView;
    private ValueCallback<Uri[]> uploadCallback;
    private String pendingSaveContent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean night = isNightMode();
        applySystemBars(night);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(backgroundColor(night));
        webView = new WebView(this);
        webView.setBackgroundColor(backgroundColor(night));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Assets em file:///android_asset continuam acessíveis com estas opções desligadas.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBlockNetworkLoads(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setDefaultTextEncodingName("UTF-8");
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        webView.setWebViewClient(new LocalOnlyClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(onlyImages(params) ? "image/*" : "*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Selecionar arquivo"),
                            REQ_FILE_PICKER);
                } catch (ActivityNotFoundException error) {
                    uploadCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        webView.loadUrl(APP_URL);
    }

    private static boolean onlyImages(WebChromeClient.FileChooserParams params) {
        if (params == null) return false;
        String[] types = params.getAcceptTypes();
        if (types == null) return false;
        boolean any = false;
        for (String type : types) {
            if (type == null || type.trim().isEmpty()) continue;
            any = true;
            if (!type.trim().startsWith("image/")) return false;
        }
        return any;
    }

    private boolean isNightMode() {
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private static int backgroundColor(boolean dark) {
        return dark ? Color.rgb(17, 17, 26) : Color.rgb(245, 246, 252);
    }

    private void applySystemBars(boolean dark) {
        int color = backgroundColor(dark);
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);
        int flags = 0;
        if (!dark) {
            flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    /** Bloqueia qualquer navegação para fora dos assets do aplicativo. */
    private class LocalOnlyClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !isAllowed(request.getUrl().toString());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return !isAllowed(url);
        }

        private boolean isAllowed(String url) {
            return url != null && (url.startsWith(APP_URL_PREFIX) || url.equals("about:blank"));
        }

        @TargetApi(26)
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // O processo de renderização morreu (ex.: pouca memória). Recria a tela;
            // os dados ficam no localStorage e são recarregados.
            recreate();
            return true;
        }
    }

    /** Ponte mínima exposta à interface local. */
    private class Bridge {
        @JavascriptInterface
        public void setSystemBars(final boolean dark) {
            runOnUiThread(() -> {
                applySystemBars(dark);
                if (webView != null) webView.setBackgroundColor(backgroundColor(dark));
            });
        }

        @JavascriptInterface
        public void saveFile(final String fileName, final String content) {
            runOnUiThread(() -> {
                pendingSaveContent = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                try {
                    startActivityForResult(intent, REQ_SAVE_FILE);
                } catch (ActivityNotFoundException error) {
                    pendingSaveContent = null;
                    notifySaveResult(false);
                }
            });
        }
    }

    private void notifySaveResult(boolean ok) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.MGApp&&MGApp.onNativeSave&&MGApp.onNativeSave(" + ok + ")", null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_PICKER) {
            if (uploadCallback != null) {
                uploadCallback.onReceiveValue(
                        WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                uploadCallback = null;
            }
        } else if (requestCode == REQ_SAVE_FILE) {
            String content = pendingSaveContent;
            pendingSaveContent = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || content == null) {
                notifySaveResult(false);
                return;
            }
            boolean ok = false;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                if (out != null) {
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    ok = true;
                }
            } catch (IOException | SecurityException error) {
                ok = false;
            }
            notifySaveResult(ok);
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "(window.MGApp&&MGApp.handleBack)?MGApp.handleBack():'exit'",
                value -> {
                    if (value == null || "\"exit\"".equals(value) || "null".equals(value)) finish();
                });
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("window.MGApp&&MGApp.flush&&MGApp.flush()", null);
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("window.MGApp&&MGApp.onResume&&MGApp.onResume()", null);
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
