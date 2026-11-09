// Pointers-BOX 鸿蒙原生版（v2.6.0）：主页完整 + 导航 + 资源库页内详情 + 版本日志折叠 + 四主题
import { router } from '@kit.ArkUI';
import { DataStore } from '../data/DataStore';
import { DataSnapshot, Resource, AppConfig, ShareItem } from '../data/Models';
import { OrbBackground } from '../ui/Glass';
import { ThemePalette, ACCENT_PRESETS, normalizeAccent, buildPalette } from '../ui/Theme';

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
  @State config: AppConfig = new AppConfig();
  // 资源详情页内切换：null=列表视图，非 null=详情视图
  @State detailRes: Resource | null = null;
  @State logsExpanded: boolean = false;
  private palette: ThemePalette = buildPalette(this.config.theme, this.config.accent, this.config.liquidGlass);

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

  private applyConfig(c: AppConfig): void {
    this.config = c;
    this.palette = buildPalette(c.theme, c.accent, c.liquidGlass);
  }

  private themeKey(label: string): string {
    return label === '紫金黑' ? 'zijin' : label === '自定义' ? 'custom' : label === '纯黑' ? 'black' : 'white';
  }

  private applyTheme(label: string): void {
    const key = this.themeKey(label);
    // 切主题按旧版语义联动玻璃开关（紫金黑锁死开，纯黑/纯白默认关）
    const glass = key === 'zijin' ? true : (key === 'black' || key === 'white') ? false : this.config.liquidGlass;
    this.applyConfig({
      updateChannel: this.config.updateChannel,
      theme: key,
      accent: this.config.accent,
      liquidGlass: glass
    } as AppConfig);
  }

  private detailMeta(res: Resource): string {
    return [
      res.category !== '' ? res.category : '',
      res.release_date ?? '',
      res.id ? `序号 ${res.id}` : ''
    ].filter((s: string): boolean => s !== '').join(' · ');
  }

  private shareItems(res: Resource): ShareLike[] {
    if ((res.shares ?? []).length > 0) {
      return (res.shares ?? []).map((s: ShareItem): ShareLike => {
        const sl = new ShareLike();
        sl.name = s.name;
        sl.url = s.url;
        return sl;
      });
    }
    return res.links.map((url: string, i: number): ShareLike => {
      const sl = new ShareLike();
      sl.name = `分享项 ${i + 1}`;
      sl.url = url;
      return sl;
    });
  }

  build() {
    Stack() {
      if (this.palette.glassOn) {
        OrbBackground()
      }
      Column() {
      Column() {
        if (this.page === Page.Home) {
          this.HomePage()
        } else if (this.page === Page.Resources) {
          if (this.detailRes !== null) {
            this.ResourceDetailView(this.detailRes)
          } else {
            this.ResourcesPage()
          }
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
      .backgroundColor(this.palette.navBg)
      .borderRadius(24)
      .border({ width: 1, color: this.palette.navBorder })
      .margin(12)
      .justifyContent(FlexAlign.SpaceEvenly)
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.palette.appBg)
    .alignContent(Alignment.TopStart)
  }

  @Builder
  NavItem(label: string, page: Page) {
    Text(label)
      .fontSize(14)
      .fontWeight(this.page === page ? FontWeight.Bold : FontWeight.Normal)
      .fontColor(this.page === page ? this.palette.accent : this.palette.textSecondary)
      .onClick(() => {
        // 浏览器/下载是独立子页，走 router；首页/资源/设置原地切换
        if (page === Page.Browser || page === Page.Downloads) {
          router.pushUrl({ url: page === Page.Browser ? 'pages/BrowserPage' : 'pages/DownloadsPage' });
        } else {
          this.page = page;
          if (page !== Page.Resources) {
            this.detailRes = null;
          }
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
          .fontColor(this.palette.textPrimary)
          .margin({ top: 24 })

        Row() {
          Text('今日推荐')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textSecondary)
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
            .fontColor(this.palette.textSecondary)
        }
        ForEach(this.recommends, (res: Resource) => {
          Column() {
            Text(res.name)
              .fontSize(18)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.palette.textPrimary)
            if (res.introduction !== '') {
              Text(res.introduction)
                .fontSize(13)
                .fontColor(this.palette.textSecondary)
                .margin({ top: 6 })
            }
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(20)
          .backgroundColor(this.palette.cardBg)
          .borderRadius(18)
          .border({ width: 1, color: this.palette.navBorder })
          .onClick(() => {
            // 点卡切页内详情（不弹窗）
            this.detailRes = res;
            this.page = Page.Resources;
          })
        }, (res: Resource) => res.name)

        if (this.snapshot?.announcement) {
          Column() {
            Text('公告')
              .fontSize(16)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.palette.textPrimary)
            Text(`${this.snapshot.announcement.date}\n${this.snapshot.announcement.content}`)
              .fontSize(13)
              .fontColor(this.palette.textSecondary)
              .margin({ top: 8 })
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(20)
          .backgroundColor(this.palette.cardBgAlt)
          .borderRadius(18)
          .border({ width: 1, color: this.palette.navBorder })
        }

        Column() {
          Text('数据状态')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Text(this.snapshot?.offline ? '离线（展示本地缓存）' : '在线')
            .fontSize(13)
            .fontColor(this.snapshot?.offline ? Amber : Green)
            .margin({ top: 8 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        // 版本日志（可折叠：默认收起=1 条摘要，展开=最近 3 条完整）
        if ((this.snapshot?.versionLogs ?? []).length > 0) {
          Column() {
            Row() {
              Text('版本日志')
                .fontSize(16)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.palette.textPrimary)
              Blank()
              Text(this.logsExpanded ? '收起 ▴' : '展开 ▾')
                .fontSize(12)
                .fontColor(this.palette.textSecondary)
            }
            .width('100%')
            .onClick(() => {
              this.logsExpanded = !this.logsExpanded;
            })
            .margin({ bottom: 8 })

            if (this.logsExpanded) {
              ForEach((this.snapshot?.versionLogs ?? []).slice(0, 3), (v: VersionLogItem) => {
                Row() {
                  Text(v.version)
                    .fontSize(11)
                    .fontColor(this.palette.accent)
                    .backgroundColor(`${this.palette.accent}33`)
                    .borderRadius(10)
                    .padding({ left: 8, right: 8, top: 2, bottom: 2 })
                  Text(v.log)
                    .fontSize(12)
                    .fontColor(this.palette.textSecondary)
                    .layoutWeight(1)
                    .margin({ left: 8 })
                }
                .alignItems(VerticalAlign.Top)
                .width('100%')
                .margin({ bottom: 6 })
              }, (v: VersionLogItem) => v.version)
            } else {
              Text(`${(this.snapshot?.versionLogs ?? [])[0].version}  ${(this.snapshot?.versionLogs ?? [])[0].log}`)
                .fontSize(12)
                .fontColor(this.palette.textSecondary)
                .maxLines(2)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(20)
          .backgroundColor(this.palette.cardBgAlt)
          .borderRadius(18)
          .border({ width: 1, color: this.palette.navBorder })
          .margin({ bottom: 20 })
        }
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
    Scroll() {
      Column({ space: 12 }) {
        Text('资源')
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.palette.textPrimary)
          .margin({ top: 24 })

        if ((this.snapshot?.resources ?? []).length === 0) {
          Text(this.loaded ? '暂无资源' : '加载中…（线路重试中）')
            .fontSize(13)
            .fontColor(this.palette.textSecondary)
        }
        ForEach(this.snapshot?.resources ?? [], (res: Resource) => {
          Column() {
            Row() {
              Text(res.name)
                .fontSize(17)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.palette.textPrimary)
                .layoutWeight(1)
              if (res.category !== '') {
                Text(res.category)
                  .fontSize(12)
                  .fontColor(this.palette.accent)
              }
            }
            .width('100%')
            if (res.introduction !== '') {
              Text(res.introduction)
                .fontSize(13)
                .fontColor(this.palette.textSecondary)
                .margin({ top: 6 })
            }
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(18)
          .backgroundColor(this.palette.cardBg)
          .borderRadius(18)
          .border({ width: 1, color: this.palette.navBorder })
          .onClick(() => {
            // 点卡切页内详情（不弹窗）
            this.detailRes = res;
          })
        }, (res: Resource) => `${res.name}_${res.id ?? ''}`)
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 20 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }

  @Builder
  ResourceDetailView(res: Resource) {
    Scroll() {
      Column({ space: 14 }) {
        Row() {
          Text(res.name)
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.palette.textPrimary)
            .layoutWeight(1)
          Text('✕ 返回')
            .fontSize(14)
            .fontColor(this.palette.textPrimary)
            .backgroundColor(this.palette.cardBg)
            .borderRadius(12)
            .padding({ left: 14, right: 14, top: 8, bottom: 8 })
            .onClick(() => {
              this.detailRes = null;
            })
        }
        .width('100%')
        .margin({ top: 24 })

        Column() {
          if (this.detailMeta(res) !== '') {
            Text(this.detailMeta(res))
              .fontSize(12)
              .fontColor(this.palette.accent)
          }
          Text(res.introduction !== '' ? res.introduction : '（暂无介绍）')
            .fontSize(13)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 8 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBg)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        // 分享项（领取=打开链接，不露明文）
        Column() {
          if ((res.shares ?? []).length > 0 || res.links.length > 0) {
            Text('分享项')
              .fontSize(16)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.palette.textPrimary)
            ForEach(this.shareItems(res),
              (item: ShareLike) => {
                Row() {
                  Text(item.name)
                    .fontSize(13)
                    .fontColor(this.palette.textPrimary)
                    .layoutWeight(1)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                  Button('领取')
                    .onClick(() => {
                      if (item.url !== '') {
                        // 应用内浏览器打开（ ArkWeb 子页）
                        router.pushUrl({ url: 'pages/BrowserPage', params: { url: item.url } });
                      }
                    })
                }
                .width('100%')
                .padding({ left: 12, right: 12, top: 8, bottom: 8 })
                .backgroundColor(this.palette.cardBgAlt)
                .borderRadius(12)
                .border({ width: 1, color: this.palette.navBorder })
              }, (item: ShareLike) => `${item.name}_${item.url}`)
          }
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
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
  SettingsPage() {
    Scroll() {
      Column({ space: 14 }) {
        Text('设置')
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.palette.textPrimary)
          .margin({ top: 24 })

        // 主题外观（四主题 + 玻璃开关 + 自定义颜色）
        Column() {
          Text('主题外观')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Text('默认「紫金黑」（液态玻璃锁死开启），「自定义」支持自选颜色与玻璃开关，「纯黑 / 纯白」玻璃默认关闭')
            .fontSize(12)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 4 })
          Row({ space: 8 }) {
            ForEach(['紫金黑', '自定义', '纯黑', '纯白'], (label: string) => {
              Text(label)
                .fontSize(13)
                .fontWeight(this.config.theme === this.themeKey(label) ? FontWeight.Bold : FontWeight.Normal)
                .fontColor(this.config.theme === this.themeKey(label) ? this.palette.textPrimary : this.palette.textSecondary)
                .backgroundColor(this.config.theme === this.themeKey(label) ? this.palette.accent : this.palette.cardBg)
                .borderRadius(12)
                .padding({ left: 14, right: 14, top: 8, bottom: 8 })
                .onClick(() => {
                  this.applyTheme(label);
                })
            }, (label: string) => label)
          }
          .margin({ top: 12 })

          Row() {
            Text('液态玻璃')
              .fontSize(13)
              .fontColor(this.palette.textPrimary)
            Toggle({ type: ToggleType.Switch, isOn: this.config.liquidGlass })
              .selectedColor(this.palette.accent)
              .enabled(this.config.theme !== 'zijin')
              .margin({ left: 8 })
              .onChange((on: boolean) => {
                this.applyConfig({
                  updateChannel: this.config.updateChannel,
                  theme: this.config.theme,
                  accent: this.config.accent,
                  liquidGlass: on
                } as AppConfig);
              })
            Text(this.config.theme === 'zijin' ? '（紫金黑主题玻璃锁死开启，不可关闭）' : '（切换开关可开关液态玻璃质感）')
              .fontSize(11)
              .fontColor(this.palette.textSecondary)
              .layoutWeight(1)
          }
          .width('100%')
          .margin({ top: 12 })

          if (this.config.theme === 'custom') {
            Text('主题颜色')
              .fontSize(13)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.palette.textPrimary)
              .margin({ top: 12 })
            Row({ space: 8 }) {
              ForEach(ACCENT_PRESETS, (preset: string) => {
                Column()
                  .width(26)
                  .height(26)
                  .borderRadius(13)
                  .backgroundColor(preset)
                  .border({ width: 2, color: normalizeAccent(this.config.accent).toLowerCase() === preset.toLowerCase() ? this.palette.textPrimary : Color.Transparent })
                  .onClick(() => {
                    this.applyConfig({
                      updateChannel: this.config.updateChannel,
                      theme: this.config.theme,
                      accent: preset,
                      liquidGlass: this.config.liquidGlass
                    } as AppConfig);
                  })
              }, (preset: string) => preset)
            }
            .margin({ top: 8 })
          }
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        // 更新渠道
        Column() {
          Text('更新渠道')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Row() {
            Text('国内镜像（Gitee）')
              .fontSize(13)
              .fontColor(this.config.updateChannel === 'gitee' ? this.palette.accent : this.palette.textSecondary)
              .onClick(() => {
                this.applyConfig({
                  updateChannel: 'gitee',
                  theme: this.config.theme,
                  accent: this.config.accent,
                  liquidGlass: this.config.liquidGlass
                } as AppConfig);
              })
            Text('全球官方（GitHub）')
              .fontSize(13)
              .fontColor(this.config.updateChannel === 'github' ? this.palette.accent : this.palette.textSecondary)
              .margin({ left: 16 })
              .onClick(() => {
                this.applyConfig({
                  updateChannel: 'github',
                  theme: this.config.theme,
                  accent: this.config.accent,
                  liquidGlass: this.config.liquidGlass
                } as AppConfig);
              })
          }
          .width('100%')
          .margin({ top: 10 })
          Text('国内网络建议选 Gitee；移动端检测到新版本后请到发布页下载对应安装包')
            .fontSize(12)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 6 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        // 关于应用（简介/通用密钥/QQ 群来自 box 数据）
        Column() {
          Text('关于应用')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Text(this.snapshot?.box?.app_name ?? 'Pointers-BOX')
            .fontSize(13)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 6 })
          if ((this.snapshot?.box?.app_introduction ?? '') !== '') {
            Text(this.snapshot!.box!.app_introduction)
              .fontSize(12)
              .fontColor(this.palette.textSecondary)
              .margin({ top: 4 })
          }
          if ((this.snapshot?.box?.general_key ?? '') !== '') {
            Text(`通用密钥：${this.snapshot!.box!.general_key}`)
              .fontSize(12)
              .fontColor(this.palette.textSecondary)
              .margin({ top: 4 })
          }
          if ((this.snapshot?.box?.community_qq ?? '') !== '') {
            Text(`社区 QQ 群：${this.snapshot!.box!.community_qq}`)
              .fontSize(12)
              .fontColor(this.palette.textSecondary)
              .margin({ top: 4 })
          }
          Text(this.snapshot?.box?.copyright ?? 'Copyright © 2026 Pointers-BOX All Rights Reserved')
            .fontSize(12)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })
        .margin({ bottom: 20 })
      }
      .width('100%')
      .padding({ left: 16, right: 16 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }
}

class ShareLike {
  name: string = '';
  url: string = '';
}

class VersionLogItem {
  version: string = '';
  log: string = '';
}
