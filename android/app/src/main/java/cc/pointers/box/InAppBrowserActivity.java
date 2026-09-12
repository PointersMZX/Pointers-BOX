package cc.pointers.box;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
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
 * v2.1.0 下载修复：
 * 1. blob:/data: 链接 DownloadManager 无法处理 → 明确提示并转系统浏览器打开；
 * 2. 文件名解析支持 RFC5987（filename*=UTF-8''…，中文不乱码）+ URL 解码；
 * 3. 补齐 User-Agent/Referer 请求头（部分站点缺 UA 直接 403）；
 * 4. 设置 mimeType（部分文件下载后无法打开）；
 * 5. 注册下载完成广播：成功提示文件名，失败提示原因。
 */
public class InAppBrowserActivity extends Activity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_RESET = "reset";

    private WebView webView;
    private EditText addressBar;
    private String homeUrl;
    private BroadcastReceiver downloadReceiver;

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
            // 使用 String 重载（全 API 兼容，避免 lint NewApi 拦停 release 构建）
            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
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
        webView.setDownloadListener(new DownloadHandler());
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

    /**
     * v2.1.0 下载接管：DownloadManager + 完整请求头 + RFC5987 文件名 + 完成广播。
     */
    private class DownloadHandler implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
            // blob:/data: 协议 DownloadManager 无法访问（网盘类"点击无反应"的主因）→ 转系统浏览器
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                Toast.makeText(InAppBrowserActivity.this,
                        "该链接为特殊协议，已转交系统浏览器下载", Toast.LENGTH_LONG).show();
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception e) {
                    Toast.makeText(InAppBrowserActivity.this,
                            "无法打开该下载链接", Toast.LENGTH_LONG).show();
                }
                return;
            }
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                // 站点依赖的请求头：Cookie / UA / Referer（缺 UA 时部分 CDN 直接 403）
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) req.addRequestHeader("Cookie", cookie);
                if (userAgent != null && !userAgent.isEmpty()) req.addRequestHeader("User-Agent", userAgent);
                String referer = webView.getUrl();
                if (referer != null) req.addRequestHeader("Referer", referer);
                // mimeType：DownloadManager 需要它来分类与打开文件（null 时按扩展名兜底）
                if (mimeType != null && !mimeType.isEmpty()) req.setMimeType(mimeType);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                String name = guessFileName(url, contentDisposition, mimeType);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                req.setTitle(name);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    final long id = dm.enqueue(req);
                    registerDoneReceiver(dm, id, name);
                    Toast.makeText(InAppBrowserActivity.this, "开始下载：" + name, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(InAppBrowserActivity.this, "下载失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    /** 下载完成/失败提示（v2.1.0：此前成功后无任何反馈） */
    private void registerDoneReceiver(DownloadManager dm, long id, String name) {
        unregisterQuietly();
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                long finishedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (finishedId != id) return;
                    Uri uri = dm.getUriForDownloadedFile(id);
                    if (uri != null) {
                        Toast.makeText(ctx, "下载完成：" + name, Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(ctx, "下载失败：" + name, Toast.LENGTH_LONG).show();
                    }
                    unregisterQuietly();
            }
        };
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_NOT_EXPORTED);
        } else {
            // Android 13 以下：Target 34 以下无需导出标志
            registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }
    }

    private void unregisterQuietly() {
        if (downloadReceiver != null) {
            try {
                unregisterReceiver(downloadReceiver);
            } catch (Exception ignored) {
            }
            downloadReceiver = null;
        }
    }

    @Override
    protected void onDestroy() {
        unregisterQuietly();
        super.onDestroy();
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

    /**
     * v2.1.0 文件名解析：
     * 1. RFC5987 filename*=UTF-8''xxx（标准中文文件名，原先直接乱码）；
     * 2. 普通 filename="xxx" 去引号；
     * 3. URL 解码（%20 空格等）；
     * 4. 上述全缺时按 URL 尾段 + mimeType 推断扩展名（URLUtil.guessFileName）。
     */
    private String guessFileName(String url, String contentDisposition, String mimeType) {
        try {
            if (contentDisposition != null) {
                // RFC 5987：filename*=UTF-8''%E4%B8%AD%E6%96%87.zip
                java.util.regex.Matcher m = java.util.regex.Pattern
                        .compile("filename\\*=UTF-8''([^;]+)", java.util.regex.Pattern.CASE_INSENSITIVE)
                        .matcher(contentDisposition);
                if (m.find()) {
                    return java.net.URLDecoder.decode(m.group(1), "UTF-8").replace("\"", "");
                }
                // 旧式 filename=xxx（可能带引号）
                int eq = contentDisposition.indexOf("filename=");
                if (eq >= 0) {
                    String name = contentDisposition.substring(eq + 9).replace("\"", "");
                    int semi = name.indexOf(';');
                    if (semi > 0) name = name.substring(0, semi);
                    name = name.trim();
                    if (!name.isEmpty()) return java.net.URLDecoder.decode(name, "UTF-8");
                }
            }
        } catch (Exception ignored) {
            // 解析失败走 URLUtil 兜底
        }
        return URLUtil.guessFileName(url, contentDisposition, mimeType);
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
