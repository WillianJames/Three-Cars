package com.willianjss.threecars;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {

    private static final String GAME_URL = "file:///android_asset/www/index.html";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_FULLSCREEN
            );
            createWebView();
            hideSystemUi();
        } catch (Throwable error) {
            showStartupError(error);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 8, 26));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setLongClickable(false);
        webView.setOnLongClickListener(view -> true);
        webView.setHapticFeedbackEnabled(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setTextZoom(100);
        settings.setDefaultTextEncodingName("UTF-8");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return url != null && !url.startsWith("file:///android_asset/");
            }
        });

        setContentView(
                webView,
                new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );
        webView.loadUrl(GAME_URL);
    }

    private void showStartupError(Throwable error) {
        Log.e("ThreeCars", "Falha ao iniciar", error);

        try {
            LinearLayout root = new LinearLayout(this);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setBackgroundColor(Color.rgb(5, 8, 26));
            root.setPadding(48, 96, 48, 48);

            TextView title = new TextView(this);
            title.setText("Three Cars\nFalha ao iniciar");
            title.setTextColor(Color.rgb(241, 245, 255));
            title.setTextSize(24);
            title.setTypeface(Typeface.DEFAULT_BOLD);
            root.addView(title);

            TextView details = new TextView(this);
            details.setText(Log.getStackTraceString(error));
            details.setTextColor(Color.rgb(190, 203, 230));
            details.setTextSize(10);
            details.setTypeface(Typeface.MONOSPACE);
            details.setTextIsSelectable(true);
            details.setPadding(0, 32, 0, 0);
            root.addView(details);

            setContentView(root);
        } catch (Throwable ignored) {
            // Mantém o tratamento padrão do Android se a tela de erro falhar.
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            try {
                hideSystemUi();
            } catch (Throwable ignored) {
                // A interface continua funcional mesmo sem esconder as barras.
            }
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            try {
                webView.evaluateJavascript(
                        "window.threeCarsPause ? String(window.threeCarsPause()) : 'false'",
                        null
                );
                webView.onPause();
            } catch (Throwable ignored) {
                // WebView já pode ter sido destruída.
            }
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            try {
                webView.onResume();
            } catch (Throwable ignored) {
                // WebView já pode ter sido destruída.
            }
        }
        try {
            hideSystemUi();
        } catch (Throwable ignored) {
            // A interface continua funcional mesmo sem esconder as barras.
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            try {
                webView.loadUrl("about:blank");
                webView.stopLoading();
                webView.setWebChromeClient(null);
                webView.setWebViewClient(null);
                webView.destroy();
            } catch (Throwable ignored) {
                // Descarte defensivo.
            }
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }

        try {
            webView.evaluateJavascript(
                    "window.threeCarsBack ? String(window.threeCarsBack()) : 'false'",
                    result -> {
                        if (!"\"true\"".equals(result) && !"true".equals(result)) {
                            finish();
                        }
                    }
            );
        } catch (Throwable error) {
            super.onBackPressed();
        }
    }
}
