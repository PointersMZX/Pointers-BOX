// Pointers-BOX 鸿蒙原生版（v2.6.0）：主页完整 + 导航（首页/资源/浏览器/下载/设置）
import { router } from '@kit.ArkUI';
import { DataStore } from '../data/DataStore';
import { DataSnapshot, Resource } from '../data/Models';

const BgBase = '#0d0817';
const CardBg = '#2a2135';
const CardBgAlt = '#241c2e';
const TextPrimary = '#f0eaf8';
const TextSecondary = '#a99cc4';
const Accent = '#7c5cff';
const Green = '#7ee787';
const Amber = '#d29922';

enum Page { Home, Resources, Browser, Downloads, Settings }

@Entry
@Component
struct Index {
  @State page: Page = Page.Home;
  @State snapshot: DataSnapshot | null = null;
  @State recommends: Resource[] = [];
  @State loaded: boolean = false;

  aboutToAppear(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const store = new DataStore();
    const snap = await store.getData();
    this.snapshot = snap;
    const all = snap.resources ?? [];
    this.recommends = all.sort(() => Math.random() - 0.5).slice(0, 4);
    this.loaded = true;
  }

  build() {
    Column() {
      Column() {
        if (this.page === Page.Home) {
          this.HomePage()
        } else if (this.page === Page.Resources) {
          this.ResourcesPage()
        } else {
          this.SettingsPage()
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Row() {
        this.NavItem('首页', Page.Home)
        this.NavItem('资源', Page.Resources)
        this.NavItem('浏览器', Page.Browser)
        this.NavItem('下载', Page.Downloads)
        this.NavItem('设置', Page.Settings)
      }
      .width('100%')
      .padding({ top: 10, bottom: 10 })
      .backgroundColor('#1a1425')
      .borderRadius(24)
      .margin(12)
      .justifyContent(FlexAlign.SpaceEvenly)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(BgBase)
  }

  @Builder
  NavItem(label: string, page: Page) {
    Text(label)
      .fontSize(14)
      .fontWeight(this.page === page ? FontWeight.Bold : FontWeight.Normal)
      .fontColor(this.page === page ? Accent : TextSecondary)
      .onClick(() => {
        // 浏览器/下载是独立子页，走 router；首页/资源/设置原地切换
        if (page === Page.Browser || page === Page.Downloads) {
          router.pushUrl({ url: page === Page.Browser ? 'pages/BrowserPage' : 'pages/DownloadsPage' });
        } else {
          this.page = page;
        }
      })
  }

  @Builder
  HomePage() {
    Scroll() {
      Column({ space: 14 }) {
        Text('主页')
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor(TextPrimary)
          .margin({ top: 24 })

        Row() {
          Text('今日推荐')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor(TextSecondary)
          Blank()
          Button('换一批')
            .onClick(() => {
              this.recommends = (this.snapshot?.resources ?? []).sort(() => Math.random() - 0.5).slice(0, 4);
            })
        }
        .width('100%')

        if (this.recommends.length === 0) {
          Text(this.loaded ? '暂无资源' : '加载中…（线路重试中）')
            .fontSize(13)
            .fontColor(TextSecondary)
        }
        ForEach(this.recommends, (res: Resource) => {
          Column() {
            Text(res.name)
              .fontSize(18)
              .fontWeight(FontWeight.Medium)
              .fontColor(TextPrimary)
            if (res.introduction !== '') {
              Text(res.introduction)
                .fontSize(13)
                .fontColor(TextSecondary)
                .margin({ top: 6 })
            }
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(20)
          .backgroundColor(CardBg)
          .borderRadius(18)
        }, (res: Resource) => res.name)

        if (this.snapshot?.announcement) {
          Column() {
            Text('公告')
              .fontSize(16)
              .fontWeight(FontWeight.Medium)
              .fontColor(TextPrimary)
            Text(this.snapshot.announcement.content)
              .fontSize(13)
              .fontColor(TextSecondary)
              .margin({ top: 8 })
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(20)
          .backgroundColor(CardBgAlt)
          .borderRadius(18)
        }

        Column() {
          Text('数据状态')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(TextPrimary)
          Text(this.snapshot?.offline ? '离线（展示本地缓存）' : '在线')
            .fontSize(13)
            .fontColor(this.snapshot?.offline ? Amber : Green)
            .margin({ top: 8 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(CardBgAlt)
        .borderRadius(18)
        .margin({ bottom: 20 })
      }
      .width('100%')
      .padding({ left: 16, right: 16 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }

  @Builder
  ResourcesPage() {
    Text('资源')
      .fontSize(30)
      .fontWeight(FontWeight.Bold)
      .fontColor(TextPrimary)
      .margin({ top: 24, left: 16 })
  }

  @Builder
  SettingsPage() {
    Text('设置')
      .fontSize(30)
      .fontWeight(FontWeight.Bold)
      .fontColor(TextPrimary)
      .margin({ top: 24, left: 16 })
  }
}
