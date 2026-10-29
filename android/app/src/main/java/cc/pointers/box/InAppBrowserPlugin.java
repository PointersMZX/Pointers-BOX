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
 * 安卓原生内置浏览器插件（v2.5.0 恢复）：
 * open                  → 打开内置浏览器 Activity（singleTask 复用，onNewIntent 换页）
 * resetSession          → 清空 Cookie 等登录状态（对应桌面端"重置会话"）
 * openSystemDownloads   → 打开系统下载记录
 * openExternal          → 用系统浏览器打开（逃生门）
 * startDownloadWatch / stopDownloadWatch → 订阅 DownloadEventBus 的下载事件
 * cancelDownload        → App 内取消 DownloadManager 下载（dm.remove）
 * 事件经 notifyListeners('downloadEvent') 抛给主 WebView：
 * { event: { type: started|progress|done, id, filename, received, total, state, path } }
 */
@CapacitorPlugin(name = "InAppBrowser")
public class InAppBrowserPlugin extends Plugin {

    private DownloadEventBus.Listener listener;

    @PluginMethod
    public void open(PluginCall call) {
        final String url = call.getString("url");
        final Boolean reset = call.getBoolean("resetSession", false);
        if (url == null || url.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }
        final Intent intent = new Intent(getContext(), InAppBrowserActivity.class);
        intent.putExtra(InAppBrowserActivity.EXTRA_URL, url);
        intent.putExtra(InAppBrowserActivity.EXTRA_RESET, Boolean.TRUE.equals(reset));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void resetSession(PluginCall call) {
        final CookieManager cm = CookieManager.getInstance();
        cm.removeAllCookies(null);
        cm.flush();
        call.resolve();
    }

    @PluginMethod
    public void openSystemDownloads(PluginCall call) {
        try {
            final Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开下载记录：" + e.getMessage());
        }
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }
        try {
            final Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法用系统浏览器打开：" + e.getMessage());
        }
    }

    /** 开始订阅下载事件（幂等）；事件回调切主线程后 notifyListeners 抛给 JS */
    @PluginMethod
    public void startDownloadWatch(PluginCall call) {
        if (listener == null) {
            listener = (type, id, filename, received, total, state, path) ->
                    postDownloadEvent(type, id, filename, received, total, state, path);
            DownloadEventBus.add(listener);
        }
        call.resolve();
    }

    /** 停止订阅 */
    @PluginMethod
    public void stopDownloadWatch(PluginCall call) {
        if (listener != null) {
            DownloadEventBus.remove(listener);
            listener = null;
        }
        call.resolve();
    }

    /** App 内取消（渲染层下载管理页的取消按钮；pause/resume DownloadManager 不支持，渲染层已按桌面能力隐藏） */
    @PluginMethod
    public void cancelDownload(PluginCall call) {
        final Double idNum = call.getDouble("id");
        if (idNum == null) {
            call.reject("id is required");
            return;
        }
        final boolean ok = DownloadTracker.get(getContext()).cancel(idNum.longValue());
        final JSObject ret = new JSObject();
        ret.put("ok", ok);
        call.resolve(ret);
    }

    private void postDownloadEvent(String type, long id, String filename, long received, long total,
                                   String state, String path) {
        final JSObject data = new JSObject();
        data.put("type", type);
        data.put("id", id);
        data.put("filename", filename);
        data.put("received", received);
        data.put("total", total);
        data.put("state", state);
        data.put("path", path);
        final JSObject ret = new JSObject();
        ret.put("event", data);
        // Capacitor 6 的 notifyListeners 内部已切主线程派发（3a6b00a 的教训：6.x 无 notify）
        notifyListeners("downloadEvent", ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (listener != null) {
            DownloadEventBus.remove(listener);
            listener = null;
        }
        super.handleOnDestroy();
    }
}
