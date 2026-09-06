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
 */
@CapacitorPlugin(name = "InAppBrowser")
public class InAppBrowserPlugin extends Plugin {

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
