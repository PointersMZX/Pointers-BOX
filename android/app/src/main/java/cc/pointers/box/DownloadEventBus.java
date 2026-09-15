package cc.pointers.box;

import java.util.ArrayList;
import java.util.List;

/**
 * v2.2.0 进程内下载事件总线（把 InAppBrowserActivity 的下载事件回传主 WebView）。
 *
 * 背景：InAppBrowserActivity 与主 WebView（MainActivity 承载的 Capacitor 桥）是同一进程内的
 * 两个独立组件，原生 DownloadManager 完成只弹 Toast、不回传，导致「下载管理」在 App 内恒空。
 * 这里用线程安全的静态列表做进程内广播：Activity 在开始/完成/失败时 push 事件，
 * InAppBrowserPlugin 订阅后通过 Capacitor notifyOnMainThread 抛给 JS。
 */
public final class DownloadEventBus {

    public interface Listener {
        void onEvent(String type, String filename, long total);
    }

    private static final List<Listener> LISTENERS = new ArrayList<>();

    private DownloadEventBus() {
    }

    public static synchronized void add(Listener l) {
        if (l != null && !LISTENERS.contains(l)) LISTENERS.add(l);
    }

    public static synchronized void remove(Listener l) {
        LISTENERS.remove(l);
    }

    /** 开始下载（total 为字节数，未知传 -1） */
    public static void postStarted(String filename, long total) {
        post("started", filename, total);
    }

    /** 完成（total 传 0） */
    public static void postDone(String filename) {
        post("done", filename, 0L);
    }

    /** 失败（total 传 0） */
    public static void postFailed(String filename) {
        post("failed", filename, 0L);
    }

    private static void post(String type, String filename, long total) {
        synchronized (LISTENERS) {
            for (Listener l : LISTENERS) {
                l.onEvent(type, filename, total);
            }
        }
    }
}
