// 文件名工具（对齐桌面 Downloader.DefaultFileName / Android DownloadManager 配套逻辑）
export class Downloader {
  static defaultFileName(url: string): string {
    try {
      const noQuery = url.split('?')[0].split('#')[0];
      const parts = noQuery.split('/').filter((p: string) => p.length > 0);
      let name = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : '';
      if (name.length === 0) return 'download';
      const bad = '\\/:*?"<>|';
      for (const c of bad) name = name.split(c).join('_');
      return name;
    } catch (e) {
      return 'download';
    }
  }
}
