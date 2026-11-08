// 下载页：request.agent 下载代理 + 进度显示（对齐规格 M4：鸿蒙=下载代理）
import { request } from '@kit.BasicServicesKit';
import { common } from '@kit.AbilityKit';
import { http } from '@kit.NetworkKit';
import { fileIo } from '@kit.CoreFileKit';
import { util } from '@kit.ArkTS';
import { router } from '@kit.ArkUI';
import { Downloader } from '../data/Downloader';

const TextPrimary = '#f0eaf8';
const TextSecondary = '#a99cc4';
const Accent = '#7c5cff';
const Green = '#7ee787';
const Red = '#f87171';
const CardBg = '#2a2135';
const CardBgAlt = '#241c2e';
const BgBase = '#0d0817';

interface DownloadRow {
  url: string;
  fileName: string;
  progress: number; // 0..100，-1=未知
  status: string;   // downloading | done | failed
  statusText: string;
  color: string;
}

@Entry
@Component
struct DownloadsPage {
  @State urlInput: string = '';
  @State rows: DownloadRow[] = [];

  private normalize(raw: string): string {
    const u = raw.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return 'https://' + u;
  }

  private start(raw: string): void {
    const url = this.normalize(raw);
    if (!url.startsWith('http')) return;
    const fileName = Downloader.defaultFileName(url);
    const row: DownloadRow = {
      url: url,
      fileName: fileName,
      progress: -1,
      status: 'downloading',
      statusText: '下载中',
      color: Accent
    };
    this.rows = [row, ...this.rows].slice(0, 10);
    this.urlInput = '';
    this.enqueue(url, fileName, row);
  }

  private async enqueue(url: string, fileName: string, row: DownloadRow): Promise<void> {
    try {
      const ctx = getContext(this) as common.UIAbilityContext;
      const config: request.agent.Config = {
        action: request.agent.Action.DOWNLOAD,
        url: url,
        title: fileName,
        saveas: fileName,
        overwrite: false,
        mode: request.agent.Mode.BACKGROUND,
        network: request.agent.Network.ANY,
        retry: true,
        redirect: true
      };
      // 模拟器上 create 的 Promise 可能永久挂起：8 秒不返回即落兜底
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('agent timeout')), 8000));
      const task = await Promise.race([request.agent.create(ctx, config), timeout]);
      task.on('progress', (p: request.agent.Progress) => {
        this.updateRow(row, (task: DownloadRow) => {
          task.progress = p.sizes.length > 0 && p.sizes[0] > 0
            ? Math.floor(p.processed * 100 / p.sizes[0]) : -1;
        });
      });
      task.on('completed', () => {
        this.updateRow(row, (task: DownloadRow) => {
          task.progress = 100;
          task.status = 'done';
          task.statusText = '完成';
          task.color = Green;
        });
      });
      task.on('failed', () => {
        this.updateRow(row, (task: DownloadRow) => {
          task.status = 'failed';
          task.statusText = '失败';
          task.color = Red;
        });
      });
    } catch (e) {
      console.error('DownloadCreateFail ' + ((e as BusinessError)?.code ?? '') + ' ' + ((e as BusinessError)?.message ?? ''));
      // 下载代理不可用（模拟器限制/权限不足）→ 回退自研流式下载（对齐桌面 Downloader）
      this.fallbackDownload(url, fileName, row);
    }
  }

  private async fallbackDownload(url: string, fileName: string, row: DownloadRow): Promise<void> {
    const client = http.createHttp();
    try {
      const resp = await client.request(url, {
        method: http.RequestMethod.GET,
        readTimeout: 60000,
        connectTimeout: 30000
      } as http.HttpRequestOptions);
      if (resp.responseCode < 200 || resp.responseCode >= 300) {
        this.updateRow(row, (t: DownloadRow) => {
          t.status = 'failed';
          t.statusText = `HTTP ${resp.responseCode}`;
          t.color = Red;
        });
        return;
      }
      const ctx = getContext(this) as common.UIAbilityContext;
      const file = ctx.cacheDir + '/' + fileName;
      const out = fileIo.openSync(file, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC);
      let size = 0;
      if (typeof resp.result === 'string') {
        const bytes = new util.TextEncoder().encodeInto(resp.result);
        fileIo.writeSync(out.fd, bytes.buffer);
        size = bytes.length;
      } else {
        const body = resp.result as ArrayBuffer;
        fileIo.writeSync(out.fd, body);
        size = body.byteLength;
      }
      fileIo.closeSync(out.fd);
      this.updateRow(row, (t: DownloadRow) => {
        t.progress = 100;
        t.status = 'done';
        t.statusText = `完成（${Math.ceil(size / 1024)} KB）`;
        t.color = Green;
      });
    } catch (e) {
      this.updateRow(row, (t: DownloadRow) => {
        t.status = 'failed';
        t.statusText = '网络失败';
        t.color = Red;
      });
    } finally {
      client.destroy();
    }
  }

  // @State 数组元素内字段不触发刷新，整行替换
  private updateRow(row: DownloadRow, mutate: (r: DownloadRow) => void): void {
    const idx = this.rows.indexOf(row);
    if (idx < 0) return;
    const copy: DownloadRow = {
      url: row.url, fileName: row.fileName,
      progress: row.progress, status: row.status,
      statusText: row.statusText, color: row.color
    };
    mutate(copy);
    const next = this.rows.slice();
    next[idx] = copy;
    this.rows = next;
  }

  build() {
    Column() {
      Row() {
        Text('← 返回')
          .fontSize(14)
          .fontColor(Accent)
          .onClick(() => { router.back(); })
        Blank()
        Text('下载')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor(TextPrimary)
        Blank()
        Row().width(50)
      }
      .width('100%')
      .padding({ top: 20, left: 16, right: 16, bottom: 12 })

      Row({ space: 8 }) {
        TextInput({ text: this.urlInput, placeholder: '粘贴下载链接，例如 https://…' })
          .layoutWeight(1)
          .backgroundColor(CardBgAlt)
          .borderRadius(12)
          .fontSize(14)
          .fontColor(TextPrimary)
          .onChange((v: string) => { this.urlInput = v; })
          .onSubmit(() => { this.start(this.urlInput); })
        Button('下载')
          .backgroundColor(Accent)
          .onClick(() => { this.start(this.urlInput); })
      }
      .width('100%')
      .padding({ left: 16, right: 16 })

      Text('文件由系统下载代理接管，保存到应用下载目录')
        .fontSize(12)
        .fontColor(TextSecondary)
        .margin({ top: 8, left: 16 })
        .width('100%')

      if (this.rows.length === 0) {
        Text('暂无下载任务')
          .fontSize(13)
          .fontColor(TextSecondary)
          .margin({ top: 30 })
      }

      List({ space: 10 }) {
        ForEach(this.rows, (row: DownloadRow) => {
          ListItem() {
            Column({ space: 8 }) {
              Row() {
                Text(row.fileName)
                  .fontSize(15)
                  .fontWeight(FontWeight.Medium)
                  .fontColor(TextPrimary)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                  .layoutWeight(1)
                Text(row.statusText)
                  .fontSize(13)
                  .fontColor(row.color)
              }
              .width('100%')
              Row() {
                Progress({ value: row.progress < 0 ? 0 : row.progress, total: 100, type: ProgressType.Linear })
                  .style({ strokeWidth: 6 })
                  .color(Accent)
                  .layoutWeight(1)
                Text(row.progress < 0 ? '大小未知' : `${row.progress}%`)
                  .fontSize(12)
                  .fontColor(TextSecondary)
                  .margin({ left: 10 })
              }
              .width('100%')
            }
            .width('100%')
            .padding(16)
            .backgroundColor(CardBg)
            .borderRadius(16)
          }
        }, (row: DownloadRow) => row.url + row.status + row.progress)
      }
      .width('100%')
      .layoutWeight(1)
      .padding({ left: 16, right: 16, top: 12 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(BgBase)
  }
}
