package cc.pointers.box;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * 安卓端内置浏览器（PRD 4.2）：WebView + 导航工具栏 + 下载接管 + 会话重置。
 * 由 InAppBrowserPlugin 以独立 Activity 打开，不占用应用主 WebView。
 */
public class InAppBrowserActivity extends Activity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_RESET = "reset";

    private WebView webView;
    private EditText addressBar;
    private String homeUrl;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        homeUrl = getIntent().getStringExtra(EXTRA_URL);
        if (homeUrl == null || homeUrl.isEmpty()) {
            homeUrl = "https://pointers-box.cc.cd/";
        }
        boolean reset = getIntent().getBooleanExtra(EXTRA_RESET, false);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setPadding(dp(6), dp(6), dp(6), dp(6));

        LinearLayout.LayoutParams wrap = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        LinearLayout.LayoutParams addrParams = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        addrParams.setMargins(dp(4), 0, dp(4), 0);

        Button back = mkButton(bar, "‹", wrap);
        Button fwd = mkButton(bar, "›", wrap);
        Button reload = mkButton(bar, "⟳", wrap);
        Button home = mkButton(bar, "⌂", wrap);
        addressBar = new EditText(this);
        addressBar.setSingleLine(true);
        addressBar.setTextSize(12f);
        bar.addView(addressBar, addrParams);
        Button go = mkButton(bar, "前往", wrap);
        Button close = mkButton(bar, "✕", wrap);
        root.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false; // 站内导航
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) req.addRequestHeader("Cookie", cookie);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                        guessFileName(url, contentDisposition));
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(req);
                    Toast.makeText(this, "开始下载", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(this, "下载失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
        root.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        TextView hint = new TextView(this);
        hint.setTextSize(11f);
        hint.setPadding(dp(8), dp(2), dp(8), dp(4));
        root.addView(hint, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        setContentView(root);

        back.setOnClickListener(v -> {
            if (webView.canGoBack()) webView.goBack();
        });
        fwd.setOnClickListener(v -> {
            if (webView.canGoForward()) webView.goForward();
        });
        reload.setOnClickListener(v -> webView.reload());
        home.setOnClickListener(v -> loadUrl(homeUrl));
        go.setOnClickListener(v -> loadUrl(addressBar.getText().toString()));
        addressBar.setOnEditorActionListener((v, actionId, event) -> {
            loadUrl(addressBar.getText().toString());
            return true;
        });
        close.setOnClickListener(v -> finish());

        if (reset) {
            // PRD 4.2 会话重置：清空 Cookie 等登录状态
            CookieManager.getInstance().removeAllCookies(null);
            CookieManager.getInstance().flush();
            webView.clearCache(true);
            Toast.makeText(this, "会话已重置", Toast.LENGTH_SHORT).show();
        }
        loadUrl(homeUrl);
    }

    private Button mkButton(LinearLayout bar, String label, LinearLayout.LayoutParams params) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextSize(13f);
        b.setPadding(dp(8), 0, dp(8), 0);
        bar.addView(b, params);
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void loadUrl(String raw) {
        String url = raw == null ? "" : raw.trim();
        if (url.isEmpty()) return;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        addressBar.setText(url);
        webView.loadUrl(url);
    }

    private String guessFileName(String url, String contentDisposition) {
        if (contentDisposition != null) {
            int eq = contentDisposition.indexOf("filename=");
            if (eq >= 0) {
                String name = contentDisposition.substring(eq + 9).replace("\"", "");
                if (!name.isEmpty()) return name;
            }
        }
        int slash = url.lastIndexOf('/');
        String name = slash >= 0 ? url.substring(slash + 1) : url;
        int q = name.indexOf('?');
        if (q > 0) name = name.substring(0, q);
        return name.isEmpty() ? "download" : name;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
