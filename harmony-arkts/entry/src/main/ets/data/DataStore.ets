// Pointers-BOX 鸿蒙数据层（v2.6.0 ArkTS）：4 路并发+重试+缓存（对齐桌面 DataStore.cs）
import { http } from '@kit.NetworkKit';
import { Resource, Announcement, VersionLog, BoxInfo, DataSnapshot } from './Models';
import { openMuxed } from '../mcx/McxCrypto';

class Urls {
  static resources: string = 'https://api.pointers-box.cc.cd/box/resources.mcx';
  static announcement: string = 'https://api.pointers-box.cc.cd/box/announcement.mcx';
  static box: string = 'https://api.pointers-box.cc.cd/box/box.mcx';
  static versionLogs: string = 'https://api.pointers-box.cc.cd/box/boxbbgxrz.mcx';
}

async function fetchText(url: string, force: boolean): Promise<string> {
  const target = force ? `${url}?t=${Date.now()}` : url;
  const client = http.createHttp();
  try {
    const res: http.HttpResponse = await client.request(target, {
      method: http.RequestMethod.GET,
      readTimeout: 30000,
      connectTimeout: 30000
    } as http.HttpRequestOptions);
    if (res.responseCode < 200 || res.responseCode >= 300) {
      throw new Error(`HTTP ${res.responseCode}`);
    }
    return typeof res.result === 'string' ? res.result : '';
  } finally {
    client.destroy();
  }
}

// 带重试（服务器线路单次成功率低，5 次+退避）
async function fetchRetry(url: string, force: boolean): Promise<string> {
  let last: Error | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await fetchText(url, force);
    } catch (e) {
      last = e as Error;
      if (attempt < 5) {
        await new Promise<string>((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }
  throw last!;
}

export class DataStore {
  private cachePath: string = '/data/storage/el2/base/haps/entry/cache/snapshot.json';

  async getData(force: boolean = false): Promise<DataSnapshot> {
    const warnings: string[] = [];
    let resources: Resource[] | undefined = undefined;
    let announcement: Announcement | null = null;
    let box: BoxInfo | null = null;
    let versionLogs: VersionLog[] | null = null;

    // 4 路并发（Promise.allSettled 语义：单路失败不影响其他）
    const results = await Promise.allSettled([
      fetchRetry(Urls.resources, force),
      fetchRetry(Urls.announcement, force),
      fetchRetry(Urls.box, force),
      fetchRetry(Urls.versionLogs, force)
    ]);

    try {
      if (results[0].status === 'fulfilled') { resources = JSON.parse(openMuxed(results[0].value)) as Resource[]; }
    } catch (e) {
      warnings.push('资源数据获取失败');
    }
    try {
      if (results[1].status === 'fulfilled') { announcement = JSON.parse(openMuxed(results[1].value)) as Announcement; }
    } catch (e) {
      warnings.push('公告获取失败');
    }
    try {
      if (results[2].status === 'fulfilled') { box = JSON.parse(openMuxed(results[2].value)) as BoxInfo; }
    } catch (e) {
      warnings.push('应用信息获取失败');
    }
    try {
      // boxbbgxrz：接受 { version_logs: [...] } 包裹，也容忍顶层直接是数组（对齐桌面 DataStore.cs）
      if (results[3].status === 'fulfilled') {
        const root = JSON.parse(openMuxed(results[3].value)) as Record<string, object> | VersionLog[];
        const arr = (root instanceof Array) ? root : (root as Record<string, object>)['version_logs'];
        versionLogs = (arr as VersionLog[]) ?? null;
      }
    } catch (e) {
      warnings.push('版本日志获取失败');
    }

    const offline = resources === undefined && announcement === null;
    const snap = new DataSnapshot();
    snap.resources = resources;
    snap.announcement = announcement;
    snap.box = box;
    snap.versionLogs = versionLogs;
    snap.offline = offline;
    snap.warnings = warnings;
    return snap;
  }
}
