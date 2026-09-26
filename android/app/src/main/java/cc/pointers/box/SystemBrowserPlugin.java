package cc.pointers.box;

import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 安卓系统浏览器插件（v2.3.0）：
 * openExternal → 用系统浏览器打开 URL（ACTION_VIEW）
 *
 * 内嵌 WebView 浏览器（InAppBrowserActivity）与下载事件桥（DownloadEventBus）
 * 已随 v2.3.0 删除：资源链接/页面统一自动跳转系统浏览器，应用内不再有下载功能。
 */
@CapacitorPlugin(name = "SystemBrowser")
public class SystemBrowserPlugin extends Plugin {

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
