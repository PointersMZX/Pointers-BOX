package cc.pointers.box;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.provider.MediaStore;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import android.util.Base64;

/**
 * 安卓端内置浏览器（v2.5.0 恢复并适配重做；v2.3.0 曾因体验差移除）。
 *
 * 相比旧版（v2.2.0 及之前）补齐的适配，全部针对当年"点击无反应/卡住/下载失败"的根因：
 * 1. WebChromeClient 全套：JS alert/confirm/prompt（旧版弹窗被吞 → 页面确认操作无响应）、
 *    加载进度条、文件选择器（网盘上传）、onCreateWindow（target=_blank 新窗口本页打开）；
 * 2. blob:/data: 下载不再"转系统浏览器"（系统浏览器同样打不开 blob:，等于死路）——
 *    改为注入 JS fetch → FileReader → base64 → @JavascriptInterface 回传 → 原生写文件；
 * 3. 下载事件走 DownloadTracker（Application 级）：关掉内嵌浏览器后主界面下载管理持续可见；
 * 4. 第三方 Cookie + 混合内容兼容（登录态丢失/http 图片裂图的常见根因）；
 * 5. "桌面版"一键切换 UA（部分资源站只有桌面版才给下载入口）；
 * 6. API 23-28 运行时存储权限（旧版无声明，DownloadManager 写公共目录在这些系统上会失败）；
 * 7. singleTask + onNewIntent：重复打开不重复压栈，直接载入新 URL；
 * 8. 转屏/锁屏不重建 WebView（configChanges）。
 */
public class InAppBrowserActivity extends Activity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_RESET = "reset";
    private static final int FILE_CHOOSER_CODE = 4201;
    /** blob 桥下载上限（base64 过桥内存翻倍，64MB 是安全线） */
    private static final long BLOB_MAX_BYTES = 64L * 1024 * 1024;
    private static final String DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    private WebView webView;
    private EditText addressBar;
    private ProgressBar progressBar;
    private TextView desktopBtn;
    private String homeUrl;
    private boolean desktopMode = false;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean destroyed = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        homeUrl = getIntent().getStringExtra(EXTRA_URL);
        if (homeUrl == null || homeUrl.isEmpty()) {
            homeUrl = "https://www.pointers-box.cc.cd/";
        }

        buildUi();
        applyWebViewDefaults();

        if (getIntent().getBooleanExtra(EXTRA_RESET, false)) {
            // PRD 4.2 会话重置：清空 Cookie 等登录状态
            CookieManager.getInstance().removeAllCookies(null);
            CookieManager.getInstance().flush();
            webView.clearCache(true);
            webView.clearHistory();
            Toast.makeText(this, "会话已重置", Toast.LENGTH_SHORT).show();
        }

        requestLegacyStoragePermission();
        loadUrl(homeUrl);
    }

    /** singleTask 复用：已打开时新 claim/导航直接换页，不重复压栈 */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        final String url = intent.getStringExtra(EXTRA_URL);
        if (url != null && !url.isEmpty() && webView != null) {
            homeUrl = url;
            loadUrl(url);
        }
    }

    // ───────────────────────── UI（代码布局，紫金黑主题） ─────────────────────────

    private void buildUi() {
        final LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFF14101F);

        // 工具栏
        final LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setPadding(dp(6), dp(6), dp(6), dp(6));
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(0xFF241638);

        final LinearLayout.LayoutParams iconParams =
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        final LinearLayout.LayoutParams addrParams = new LinearLayout.LayoutParams(
                0, dp(34), 1f);
        addrParams.setMargins(dp(6), 0, dp(6), 0);

        mkIcon(bar, "‹", iconParams, v -> {
            if (webView != null && webView.canGoBack()) webView.goBack();
        });
        mkIcon(bar, "›", iconParams, v -> {
            if (webView != null && webView.canGoForward()) webView.goForward();
        });
        mkIcon(bar, "⟳", iconParams, v -> {
            if (webView != null) webView.reload();
        });
        mkIcon(bar, "⌂", iconParams, v -> loadUrl(homeUrl));
        desktopBtn = mkIcon(bar, "桌面", iconParams, v -> toggleDesktopUa());

        addressBar = new EditText(this);
        addressBar.setSingleLine(true);
        addressBar.setTextSize(12f);
        addressBar.setTextColor(0xFFFFFFFF);
        addressBar.setHintTextColor(0x80FFFFFF);
        addressBar.setHint("输入网址");
        addressBar.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        addressBar.setImeOptions(EditorInfo.IME_ACTION_GO);
        addressBar.setBackground(roundedBg(0x14FFFFFF, 0x33FFFFFF));
        addressBar.setPadding(dp(12), 0, dp(12), 0);
        addressBar.setTextSize(12f);
        bar.addView(addressBar, addrParams);
        addressBar.setOnEditorActionListener((v, actionId, event) -> {
            loadUrl(addressBar.getText().toString());
            return true;
        });

        mkIcon(bar, "✕", iconParams, v -> finish());
        root.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // 细加载进度条
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.getProgressDrawable().setColorFilter(0xFF7C5CFF, android.graphics.PorterDuff.Mode.SRC_IN);
        root.addView(progressBar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        // WebView
        webView = new WebView(this);
        root.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
    }

    private TextView mkIcon(LinearLayout bar, String label, LinearLayout.LayoutParams params,
                            View.OnClickListener onClick) {
        final TextView b = new TextView(this);
        b.setText(label);
        b.setTextSize(label.length() > 1 ? 12f : 17f);
        b.setTextColor(0xFFFFFFFF);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(9), dp(4), dp(9), dp(4));
        b.setOnClickListener(onClick);
        bar.addView(b, params);
        return b;
    }

    private android.graphics.drawable.Drawable roundedBg(int fill, int stroke) {
        final android.graphics.drawable.GradientDrawable d = new android.graphics.drawable.GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(dp(17));
        d.setStroke(dp(1), stroke);
        return d;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    // ───────────────────────── WebView 配置 ─────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private void applyWebViewDefaults() {
        final WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        // 安全基线：内嵌浏览器不给本地文件访问
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        // 兼容性：混合内容（https 页面里的 http 图片/资源）走兼容模式，旧版此处理缺失导致部分站点裂图
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        // target=_blank / window.open 支持（旧版缺失 → 大量站点"点了没反应"）
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);

        final CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        // 第三方 Cookie：部分站点登录态依赖（旧版缺失 → 网盘登录后仍提示未登录）
        try {
            cm.setAcceptThirdPartyCookies(webView, true);
        } catch (Exception ignored) {
        }

        webView.setWebViewClient(new PboxWebViewClient());
        webView.setWebChromeClient(new PboxWebChromeClient());
        webView.addJavascriptInterface(new BlobBridge(), "__pboxBlob");
        webView.setDownloadListener(new DownloadHandler());
        webView.setBackgroundColor(0xFF14101F);
    }

    private void requestLegacyStoragePermission() {
        // API 23-28：DownloadManager 写公共 Downloads 目录需要运行时存储权限；API 29+ 走 MediaStore 无需
        if (Build.VERSION.SDK_INT >= 23 && Build.VERSION.SDK_INT < 29) {
            if (checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE}, 4202);
            }
        }
    }

    // ───────────────────────── 导航 / 工具 ─────────────────────────

    private void toggleDesktopUa() {
        desktopMode = !desktopMode;
        webView.getSettings().setUserAgentString(desktopMode ? DESKTOP_UA : null);
        desktopBtn.setText(desktopMode ? "手机" : "桌面");
        webView.reload();
        Toast.makeText(this, desktopMode ? "已请求桌面版网站" : "已切回手机版", Toast.LENGTH_SHORT).show();
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

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
            Toast.makeText(this, "无法打开该链接", Toast.LENGTH_LONG).show();
        }
    }

    // ───────────────────────── WebViewClient ─────────────────────────

    private class PboxWebViewClient extends WebViewClient {
        // 使用 String 重载（全 API 兼容，避免 lint NewApi 拦停 release 构建——v2.0.0 1da0b8f 的教训）
        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (url.startsWith("http://") || url.startsWith("https://")) {
                return false; // 站内导航
            }
            // intent:// / magnet: / thunder: / tel: 等非 web 协议交给系统
            openExternal(url);
            return true;
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            Toast.makeText(InAppBrowserActivity.this,
                    "页面加载失败（" + errorCode + "），请检查网络后重试", Toast.LENGTH_LONG).show();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                Toast.makeText(InAppBrowserActivity.this,
                        "页面加载失败，请检查网络后重试", Toast.LENGTH_LONG).show();
            }
        }
    }

    // ───────────────────────── WebChromeClient（当年全部缺位的部分） ─────────────────────────

    private class PboxWebChromeClient extends WebChromeClient {

        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        /** JS alert（旧版未实现 → 页面提示框被吞、看似"点了没反应"） */
        @Override
        public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
            new AlertDialog.Builder(InAppBrowserActivity.this)
                    .setMessage(message)
                    .setPositiveButton("确定", (d, w) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
            new AlertDialog.Builder(InAppBrowserActivity.this)
                    .setMessage(message)
                    .setPositiveButton("确定", (d, w) -> result.confirm())
                    .setNegativeButton("取消", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onJsPrompt(WebView view, String url, String message, String defaultValue,
                                  final JsPromptResult result) {
            final EditText input = new EditText(InAppBrowserActivity.this);
            input.setText(defaultValue);
            new AlertDialog.Builder(InAppBrowserActivity.this)
                    .setMessage(message)
                    .setView(input)
                    .setPositiveButton("确定", (d, w) -> result.confirm(input.getText().toString()))
                    .setNegativeButton("取消", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        /** 文件选择（网盘"上传"入口；旧版缺失 → 上传按钮无响应） */
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }
            filePathCallback = callback;
            try {
                startActivityForResult(params.createIntent(), FILE_CHOOSER_CODE);
            } catch (Exception e) {
                filePathCallback = null;
                Toast.makeText(InAppBrowserActivity.this, "无法打开文件选择器", Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }

        /** target=_blank 新窗口：临时 WebView 捕获首个导航 URL，在本页打开（不开多标签，克制） */
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                                      Message resultMsg) {
            final WebView temp = new WebView(view.getContext());
            temp.setWebViewClient(new WebViewClient() {
                @SuppressWarnings("deprecation")
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, String url) {
                    if (url.startsWith("http://") || url.startsWith("https://")) {
                        loadUrl(url);
                    } else {
                        openExternal(url);
                    }
                    return true;
                }
            });
            final WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(temp);
            resultMsg.sendToTarget();
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_CODE && filePathCallback != null) {
            filePathCallback.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ───────────────────────── 下载接管 ─────────────────────────

    private class DownloadHandler implements android.webkit.DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                    String mimeType, long contentLength) {
            final String name = guessFileName(url, contentDisposition, mimeType);
            // blob:/data: 是页面内存里的数据，任何浏览器都打不开 blob:——旧版"转系统浏览器"是死路。
            // 正解：注入 JS fetch → FileReader → base64 → BlobBridge 回传 → 原生写文件。
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                downloadViaJsBridge(url, name);
                return;
            }
            try {
                final DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                // 站点依赖的请求头：Cookie / UA / Referer（缺 UA 时部分 CDN 直接 403）
                final String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) req.addRequestHeader("Cookie", cookie);
                if (userAgent != null && !userAgent.isEmpty()) req.addRequestHeader("User-Agent", userAgent);
                final String referer = webView.getUrl();
                if (referer != null) req.addRequestHeader("Referer", referer);
                if (mimeType != null && !mimeType.isEmpty()) req.setMimeType(mimeType);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                req.setTitle(name);
                final long id = DownloadTracker.get(InAppBrowserActivity.this).enqueue(req, name);
                if (id >= 0) {
                    Toast.makeText(InAppBrowserActivity.this, "开始下载：" + name, Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(InAppBrowserActivity.this, "下载任务创建失败", Toast.LENGTH_LONG).show();
                }
            } catch (Exception e) {
                Toast.makeText(InAppBrowserActivity.this,
                        "下载失败：" + (e.getMessage() == null ? "未知错误" : e.getMessage()), Toast.LENGTH_LONG).show();
            }
        }
    }

    /** blob/data 下载：JS fetch 回传。id/文件名/URL 经 JSON 转义后内联进脚本，随回调原样带回（无并发歧义）。 */
    private void downloadViaJsBridge(String url, String name) {
        final long id = DownloadTracker.get(this).allocBlobId();
        DownloadEventBus.postStarted(id, name, -1, "");
        final String jsId = jsString(String.valueOf(id));
        final String jsUrl = jsString(url);
        final String jsName = jsString(name);
        final String js = "(function(){var B=window.__pboxBlob;if(!B)return;" +
                "var BID=" + jsId + ",NAME=" + jsName + ";" +
                "fetch(" + jsUrl + ").then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.blob();})" +
                ".then(function(b){if(b.size>" + BLOB_MAX_BYTES + "){B.onError(BID,NAME,'文件过大（超过 64MB），请用系统浏览器下载');return;}" +
                "var fr=new FileReader();" +
                "fr.onload=function(){B.save(BID,NAME,String(b.size),fr.result.substring(fr.result.indexOf(',')+1));};" +
                "fr.onerror=function(){B.onError(BID,NAME,'文件读取失败');};" +
                "fr.readAsDataURL(b);})" +
                ".catch(function(e){B.onError(BID,NAME,String(e&&e.message||e));});})()";
        webView.loadUrl("javascript:" + js);
        Toast.makeText(this, "开始下载：" + name, Toast.LENGTH_SHORT).show();
    }

    /** JSON 字符串字面量（含引号），安全内联进 javascript: 脚本 */
    private static String jsString(String raw) {
        final StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < raw.length(); i++) {
            final char ch = raw.charAt(i);
            switch (ch) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '<': sb.append("\\u003c"); break;
                case '>': sb.append("\\u003e"); break;
                default:
                    if (ch < 0x20) sb.append(String.format("\\u%04x", (int) ch));
                    else sb.append(ch);
            }
        }
        return sb.append('"').toString();
    }

    /** JS 桥：接收 fetch 到的 blob 数据并写文件。id 由注入脚本闭包带回，快速连点也不串号。 */
    private class BlobBridge {
        @JavascriptInterface
        public void save(String idStr, String name, String sizeStr, String base64) {
            final long id = parseLongSafely(idStr);
            final long size = parseLongSafely(sizeStr);
            final String path = writeDownloadFile(name, base64);
            if (path != null) {
                DownloadTracker.get(InAppBrowserActivity.this).blobSaved(id, name, path, size);
            } else {
                DownloadTracker.get(InAppBrowserActivity.this).blobFailed(id, name);
                runOnUiThread(() -> Toast.makeText(InAppBrowserActivity.this,
                        "下载保存失败：" + name, Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void onError(String idStr, String name, String message) {
            final long id = parseLongSafely(idStr);
            DownloadTracker.get(InAppBrowserActivity.this).blobFailed(id, name);
            runOnUiThread(() -> Toast.makeText(InAppBrowserActivity.this,
                    "下载失败：" + message, Toast.LENGTH_LONG).show());
        }
    }

    private static long parseLongSafely(String s) {
        try {
            return Long.parseLong(s);
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * 写公共 Downloads 目录：API 29+ MediaStore；API 22-28 直接文件（权限已在进入时申请）。
     * 重名自动加序号。返回实际路径，失败 null。
     */
    private String writeDownloadFile(String name, String base64) {
        final byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (Exception e) {
            return null;
        }
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                final ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, guessMime(name));
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
                final Uri uri = getContentResolver().insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) return null;
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os == null) return null;
                    os.write(bytes);
                    os.flush();
                }
                cv.clear();
                cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
                getContentResolver().update(uri, cv, null, null);
                return Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        + File.separator + name;
            }
            final File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, name);
            int seq = 1;
            while (out.exists()) {
                final int dot = name.lastIndexOf('.');
                final String stem = dot > 0 ? name.substring(0, dot) : name;
                final String ext = dot > 0 ? name.substring(dot) : "";
                out = new File(dir, stem + " (" + seq + ")" + ext);
                seq++;
            }
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(bytes);
                fos.flush();
            }
            return out.getAbsolutePath();
        } catch (Exception e) {
            return null;
        }
    }

    private static String guessMime(String name) {
        final String n = name.toLowerCase();
        if (n.endsWith(".zip")) return "application/zip";
        if (n.endsWith(".rar")) return "application/x-rar-compressed";
        if (n.endsWith(".7z")) return "application/x-7z-compressed";
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".apk")) return "application/vnd.android.package-archive";
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".mp4")) return "video/mp4";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /**
     * 文件名解析（v2.1.0 起的完整版）：
     * 1. RFC5987 filename*=UTF-8''xxx（标准中文文件名）；
     * 2. 普通 filename="xxx" 去引号；
     * 3. URL 解码（%20 空格等）；
     * 4. 全缺时 URLUtil.guessFileName 按 URL 尾段 + mimeType 兜底。
     */
    private static String guessFileName(String url, String contentDisposition, String mimeType) {
        try {
            if (contentDisposition != null) {
                final Matcher m = Pattern.compile("filename\\*=UTF-8''([^;]+)", Pattern.CASE_INSENSITIVE)
                        .matcher(contentDisposition);
                if (m.find()) {
                    return java.net.URLDecoder.decode(m.group(1), "UTF-8").replace("\"", "");
                }
                final int eq = contentDisposition.indexOf("filename=");
                if (eq >= 0) {
                    String name = contentDisposition.substring(eq + 9).replace("\"", "");
                    final int semi = name.indexOf(';');
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

    // ───────────────────────── 生命周期 ─────────────────────────

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
