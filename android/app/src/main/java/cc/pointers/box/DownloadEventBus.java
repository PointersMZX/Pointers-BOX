package cc.pointers.box;

import java.util.ArrayList;
import java.util.List;

/**
 * 进程内下载事件总线：InAppBrowserActivity / DownloadTracker 与主 WebView（Capacitor 桥）之间的
 * 唯一回传通道。事件全带下载 id（DownloadManager 系统id；blob 桥下载为负数自增 id），
 * 渲染层据此建立 DownloadTask 并支持 App 内取消。
 * 事件形状对齐桌面 Electron 'download:event' 通道（started/progress/done+state，
 * 见 capacitor.ts androidOnDownloadEvent 的映射）。
 */
public final class DownloadEventBus {

    public interface Listener {
        /**
         * @param type     started / progress / done
         * @param id       下载 id（DownloadManager 系统 id；blob 桥下载为负数自增）
         * @param filename 文件名
         * @param received 已接收字节（progress 用）
         * @param total    总字节（未知 -1）
         * @param state    done 时：completed / interrupted / cancelled；其余 ""
         * @param path     已知时为本地路径（"" 未知）
         */
        void onEvent(String type, long id, String filename, long received, long total, String state, String path);
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

    /** 开始下载（total 未知传 -1；path 未知传 ""） */
    public static void postStarted(long id, String filename, long total, String path) {
        post("started", id, filename, 0, total, "", path);
    }

    /** 下载进度（DownloadTracker 轮询驱动） */
    public static void postProgress(long id, String filename, long received, long total, String path) {
        post("progress", id, filename, received, total, "", path);
    }

    /** 结束：state = completed | interrupted | cancelled */
    public static void postDone(long id, String filename, String state, String path) {
        post("done", id, filename, 0, 0, state, path);
    }

    private static void post(String type, long id, String filename, long received, long total, String state, String path) {
        synchronized (LISTENERS) {
            for (Listener l : LISTENERS) {
                l.onEvent(type, id, filename, received, total, state, path);
            }
        }
    }
}
