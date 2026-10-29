package cc.pointers.box;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Application 级下载跟踪器（v2.5.0 适配重做）：
 * 1. 事件不再挂在 Activity 生命周期上——跟踪器以 applicationContext 注册，内嵌浏览器关闭后
 *    主界面「下载管理」持续可见进度与结果；
 * 2. 真实进度：每 800ms 轮询 DownloadManager 查询已收字节/总字节，progress 事件实时回传渲染层
 *    （旧实现 percent 直接置 100，下载管理页看不到进度）；
 * 3. 全事件带系统 id，支持 App 内取消（dm.remove）；
 * 4. blob 桥下载（JS fetch 回传）走同一事件通道：负数自增 id，保存完成即 done。
 * 事件统一经 DownloadEventBus 抛给 InAppBrowserPlugin → notifyListeners('downloadEvent')。
 */
public final class DownloadTracker {

    private static final long POLL_MS = 800;
    /** blob 桥下载 id 从 -1000 递减，与 DownloadManager 的正数系统 id 永不冲突 */
    private static final long BLOB_ID_BASE = -1000;

    private static volatile DownloadTracker instance;

    private final DownloadManager dm;
    private final Handler handler = new Handler(Looper.getMainLooper());
    /** dmId -> 文件名（进行中的下载） */
    private final Map<Long, String> active = new ConcurrentHashMap<>();
    private final AtomicBoolean polling = new AtomicBoolean(false);
    private final AtomicLong blobSeq = new AtomicLong(BLOB_ID_BASE);

    private DownloadTracker(Context appContext) {
        this.dm = (DownloadManager) appContext.getSystemService(Context.DOWNLOAD_SERVICE);
    }

    public static synchronized DownloadTracker get(Context context) {
        if (instance == null) {
            instance = new DownloadTracker(context.getApplicationContext());
        }
        return instance;
    }

    /** 分配一个 blob 桥下载 id（调用方先用它 postStarted） */
    public long allocBlobId() {
        return blobSeq.decrementAndGet();
    }

    /** DownloadManager 下载入队：登记 + started 事件 + 启动轮询。返回系统 id（-1 失败） */
    public long enqueue(DownloadManager.Request request, String name) {
        if (dm == null) return -1;
        final long id = dm.enqueue(request);
        if (id < 0) return -1;
        active.put(id, name);
        DownloadEventBus.postStarted(id, name, -1, "");
        startPolling();
        return id;
    }

    /** blob 桥下载保存完成（JS 桥线程调用，切主线程发事件） */
    public void blobSaved(final long id, final String name, final String path, final long size) {
        handler.post(() -> {
            DownloadEventBus.postProgress(id, name, size, size, path);
            DownloadEventBus.postDone(id, name, "completed", path);
            active.remove(id);
        });
    }

    /** blob 桥下载失败 */
    public void blobFailed(final long id, final String name) {
        handler.post(() -> {
            DownloadEventBus.postDone(id, name, "interrupted", "");
            active.remove(id);
        });
    }

    /** App 内取消：DownloadManager 下载 = dm.remove；blob 下载不可取消返回 false */
    public boolean cancel(long id) {
        if (id < BLOB_ID_BASE + 1) {
            // blob 下载是同步保存，无法中断
            return false;
        }
        final String name = active.remove(id);
        if (name == null || dm == null) return false;
        try {
            dm.remove(id);
        } catch (Exception ignored) {
        }
        DownloadEventBus.postDone(id, name, "cancelled", "");
        return true;
    }

    /** 是否有进行中的下载（渲染层"下载中"判定用） */
    public boolean hasActive() {
        return !active.isEmpty();
    }

    private final Runnable poller = new Runnable() {
        @Override
        public void run() {
            pollOnce();
            if (active.isEmpty()) {
                polling.set(false);
                return;
            }
            handler.postDelayed(this, POLL_MS);
        }
    };

    private void startPolling() {
        if (polling.compareAndSet(false, true)) {
            handler.post(poller);
        }
    }

    private void pollOnce() {
        if (dm == null || active.isEmpty()) return;
        final Long[] ids = active.keySet().toArray(new Long[0]);
        final long[] idArr = new long[ids.length];
        for (int i = 0; i < ids.length; i++) idArr[i] = ids[i];

        Cursor c = null;
        try {
            DownloadManager.Query q = new DownloadManager.Query();
            q.setFilterById(idArr);
            c = dm.query(q);
            if (c == null) return;
            final int colStatus = c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS);
            final int colReceived = c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
            final int colTotal = c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
            final int colUri = c.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI);
            while (c.moveToNext()) {
                final long id = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_ID));
                final String name = active.get(id);
                if (name == null) continue; // 已在别处结束
                final int status = c.getInt(colStatus);
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    final String path = c.getString(colUri);
                    DownloadEventBus.postDone(id, name, "completed", path == null ? "" : path);
                    active.remove(id);
                } else if (status == DownloadManager.STATUS_FAILED) {
                    DownloadEventBus.postDone(id, name, "interrupted", "");
                    active.remove(id);
                } else if (status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PENDING) {
                    final long received = Math.max(c.getLong(colReceived), 0);
                    long total = c.getLong(colTotal);
                    if (total < 0) total = -1; // 未知大小
                    DownloadEventBus.postProgress(id, name, received, total, "");
                }
                // STATUS_PAUSED / STATUS_PENDING：DownloadManager 自身排队，等下一轮
            }
        } catch (Exception ignored) {
            // 查询异常（如 dm 被系统清理）下一轮重试；连续异常不致命
        } finally {
            if (c != null) try { c.close(); } catch (Exception ignored) {}
        }
    }
}
