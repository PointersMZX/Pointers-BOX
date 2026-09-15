package cc.pointers.box;

import android.app.DownloadManager;
import android.content.Intent;
import android.webkit.CookieManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 安卓原生内置浏览器插件（PRD 4.2）：
 * open              → 打开内置浏览器 Activity（WebView + 工具栏 + 下载接管）
 * resetSession      → 清空 Cookie 等登录状态（对应桌面端"重置会话"）
 * openSystemDownloads → 打开系统下载记录（下载由系统 DownloadManager 接管）
 * openExternal      → 用系统浏览器打开
 * startDownloadWatch/stopDownloadWatch → v2.2.0：把 InAppBrowserActivity 的下载事件
 *                    （started/done/failed）通过事件回传给主 WebView，让「下载管理」可见
 */
@CapacitorPlugin(name = "InAppBrowser")
public class InAppBrowserPlugin extends Plugin {

    private DownloadEventBus.Listener listener;

    @Override
    protected void load() {
        super.load();
    }

    /**
     * v2.2.0：开始订阅下载事件。JS 侧调用后，Activity 里的下载事件会经
     * DownloadEventBus → 本插件 → notify 抛给主 WebView 渲染层。
     * 重复调用幂等（同一 listener 只注册一次）。
     */
    @PluginMethod
    public void startDownloadWatch(PluginCall call) {
        if (listener == null) {
            listener = new DownloadEventBus.Listener() {
                @Override
                public void onEvent(String type, String filename, long total) {
                    postDownloadEvent(type, filename, total);
                }
            };
            DownloadEventBus.add(listener);
        }
        call.resolve();
    }

    /** v2.2.0：停止订阅（页面卸载/切换时调用，避免悬挂监听） */
    @PluginMethod
    public void stopDownloadWatch(PluginCall call) {
        if (listener != null) {
            DownloadEventBus.remove(listener);
            listener = null;
        }
        call.resolve();
    }

    /** 把下载事件抛给 JS（Capacitor notify 内部切到主线程） */
    private void postDownloadEvent(String type, String filename, long total) {
        JSObject data = new JSObject();
        data.put("type", type);
        data.put("filename", filename);
        data.put("total", total);
        JSObject ret = new JSObject();
        ret.put("event", data);
        notify("downloadEvent", ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (listener != null) {
            DownloadEventBus.remove(listener);
            listener = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        Boolean reset = call.getBoolean("resetSession", false);
        if (url == null || url.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }
        Intent intent = new Intent(getContext(), InAppBrowserActivity.class);
        intent.putExtra(InAppBrowserActivity.EXTRA_URL, url);
        intent.putExtra(InAppBrowserActivity.EXTRA_RESET, Boolean.TRUE.equals(reset));
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void resetSession(PluginCall call) {
        CookieManager cm = CookieManager.getInstance();
        cm.removeAllCookies(null);
        cm.flush();
        call.resolve();
    }

    @PluginMethod
    public void openSystemDownloads(PluginCall call) {
        try {
            Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开下载记录：" + e.getMessage());
        }
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法用系统浏览器打开：" + e.getMessage());
        }
    }
}
