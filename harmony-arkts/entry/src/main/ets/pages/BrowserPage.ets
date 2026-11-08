// 浏览器页：ArkWeb 内嵌子页 + 资源快捷链接（对齐规格 M4：鸿蒙=ArkWeb 子页）
import { webview } from '@kit.ArkWeb';
import { router } from '@kit.ArkUI';
import { DataStore } from '../data/DataStore';
import { DataSnapshot, Resource } from '../data/Models';

const TextPrimary = '#f0eaf8';
const TextSecondary = '#a99cc4';
const Accent = '#7c5cff';
const CardBg = '#2a2135';
const CardBgAlt = '#241c2e';
const BgBase = '#0d0817';

@Entry
@Component
struct BrowserPage {
  @State urlInput: string = '';
  @State currentUrl: string = 'https://pointers-box.cc.cd';
  @State snapshot: DataSnapshot | null = null;
  controller: webview.WebviewController = new webview.WebviewController();

  aboutToAppear(): void {
    new DataStore().getData().then((snap: DataSnapshot) => {
      this.snapshot = snap;
    });
  }

  private normalize(raw: string): string {
    const u = raw.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return 'https://' + u;
  }

  private open(url: string): void {
    this.currentUrl = this.normalize(url);
    try {
      this.controller.loadUrl(this.currentUrl);
    } catch (e) {
      // controller 未就绪时由 src 属性首次加载
    }
  }

  build() {
    Column() {
      Row() {
        Text('← 返回')
          .fontSize(14)
          .fontColor(Accent)
          .onClick(() => { router.back(); })
        Blank()
        Text('浏览器')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor(TextPrimary)
        Blank()
        Row().width(50)
      }
      .width('100%')
      .padding({ top: 20, left: 16, right: 16, bottom: 12 })

      // 地址栏
      Row({ space: 8 }) {
        TextInput({ text: this.urlInput, placeholder: '输入网址，例如 pointers-box.cc.cd' })
          .layoutWeight(1)
          .backgroundColor(CardBgAlt)
          .borderRadius(12)
          .fontSize(14)
          .fontColor(TextPrimary)
          .onChange((v: string) => { this.urlInput = v; })
          .onSubmit(() => { this.open(this.urlInput); })
        Button('前往')
          .backgroundColor(Accent)
          .onClick(() => { this.open(this.urlInput); })
      }
      .width('100%')
      .padding({ left: 16, right: 16 })

      // 内嵌 ArkWeb
      Column() {
        Web({ src: this.currentUrl, controller: this.controller })
          .domStorageAccess(true)
          .javaScriptAccess(true)
          .width('100%')
          .layoutWeight(1)
      }
      .layoutWeight(1)
      .width('100%')
      .margin({ top: 12 })

      // 资源快捷链接
      Scroll() {
        Column({ space: 8 }) {
          Text('资源快捷链接')
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .fontColor(TextSecondary)
          if ((this.snapshot?.resources ?? []).length === 0) {
            Text('暂无快捷链接（数据加载中或离线）')
              .fontSize(12)
              .fontColor(TextSecondary)
          }
          ForEach(this.snapshot?.resources ?? [], (res: Resource) => {
            Row({ space: 8 }) {
              ForEach(res.links, (link: string) => {
                Text(res.name)
                  .fontSize(13)
                  .fontColor(Accent)
                  .padding({ left: 12, right: 12, top: 6, bottom: 6 })
                  .backgroundColor(CardBg)
                  .borderRadius(12)
                  .onClick(() => { this.open(link); })
              }, (link: string) => link)
            }
          }, (res: Resource) => res.name)
        }
        .alignItems(HorizontalAlign.Start)
        .padding({ left: 16, right: 16, bottom: 12 })
      }
      .scrollBar(BarState.Off)
      .width('100%')
      .backgroundColor(BgBase)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(BgBase)
  }
}
