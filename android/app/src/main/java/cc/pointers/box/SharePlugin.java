package cc.pointers.box;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 安卓分享插件（v2.4.0）：
 * share → 拉起系统分享面板（ACTION_SEND text/plain，微信/QQ/钉钉等）；
 *       无分享目标或拉起失败 → 回落复制系统剪贴板，返回 mode=copied
 * copyText → 复制文本到系统剪贴板（PBoxApi.copyText 的安卓实现）
 *
 * 与 SystemBrowserPlugin 同一注册模式（MainActivity.registerPlugin）。
 * ⚠ Android 11+ 包可见性：resolveActivity 需要 AndroidManifest 的 <queries>
 * 声明 SEND/text/plain（见 AndroidManifest.xml），否则分享面板探测恒为 null。
 */
@CapacitorPlugin(name = "Share")
public class SharePlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            call.reject("text is required");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("text/plain");
            intent.putExtra(Intent.EXTRA_TEXT, text);
            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                // 无可用分享目标 → 回落复制
                copyToClipboard(text);
                call.resolve(mode("copied"));
                return;
            }
            getContext().startActivity(Intent.createChooser(intent, "通过以下应用分享"));
            call.resolve(mode("shared"));
        } catch (Exception e) {
            copyToClipboard(text);
            call.resolve(mode("copied"));
        }
    }

    @PluginMethod
    public void copyText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            call.reject("text is required");
            return;
        }
        copyToClipboard(text);
        call.resolve();
    }

    private JSObject mode(String value) {
        return new JSObject().put("mode", value);
    }

    private void copyToClipboard(String text) {
        ClipboardManager cm =
                (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null) {
            cm.setPrimaryClip(ClipData.newPlainText("Pointers-BOX", text));
        }
    }
}
