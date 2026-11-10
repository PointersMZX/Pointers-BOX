// Pointers-BOX 鸿蒙原生版（v2.6.0）主页面
// 首页（堆叠/平铺 + 我的收藏 + 快捷入口）· 资源库（搜索 + 分类横滑）· 链接（弹窗添加）· 设置（关于/版本日志/主题/更新/浏览器/下载）
import { router } from '@kit.ArkUI';
import { common, Want } from '@kit.AbilityKit';
import { http } from '@kit.NetworkKit';
import { DataStore } from '../data/DataStore';
import { DataSnapshot, Resource, AppConfig, ShareItem, UserLink, VersionLog } from '../data/Models';
import { Prefs } from '../data/Prefs';
import { OrbBackground } from '../ui/Glass';
import { ThemePalette, ACCENT_PRESETS, normalizeAccent, buildPalette } from '../ui/Theme';

const Green = '#7ee787';
const Amber = '#d29922';
const Redish = '#FF7b72';
const APP_VERSION = '3.0.0-Beta.1';

const THEME_LABELS: string[] = ['紫金黑', '自定义', '纯黑', '纯白'];

@Entry
@Component
struct Index {
  @State page: string = 'home';
  @State snapshot: DataSnapshot | null = null;
  @State recommends: Resource[] = [];
  @State links: UserLink[] = [];
  @State loaded: boolean = false;
  @State config: AppConfig = new AppConfig();
  @State palette: ThemePalette = buildPalette('zijin', '#7c5cff', true);
  // 资源库内切换：null=列表，非 null=详情
  @State detailRes: Resource | null = null;
  @State logsExpanded: boolean = false;
  @State logsExpandedSettings: boolean = false;
  @State keyword: string = '';
  @State category: string = '全部';
  @State updateMsg: string = '';
  @State updateUrl: string = '';
  @State checking: boolean = false;
  @State hexInput: string = '#7c5cff';
  private ctx: common.UIAbilityContext | null = null;
  private addDialog: CustomDialogController | null = null;

  aboutToAppear(): void {
    this.ctx = getContext(this) as common.UIAbilityContext;
    const cfg = Prefs.loadConfig(this.ctx);
    this.config = cfg;
    this.palette = buildPalette(cfg.theme, cfg.accent, cfg.liquidGlass);
    this.hexInput = cfg.accent;
    this.links = Prefs.loadLinks(this.ctx);
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const snap = await new DataStore().getData();
    this.snapshot = snap;
    this.recommends = this.pickRecommends();
    this.loaded = true;
  }

  private pickRecommends(): Resource[] {
    const all: Resource[] = (this.snapshot?.resources ?? []).slice();
    // 洗牌后取前 N（堆叠 3 张 / 平铺 4 张）
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = all[i];
      all[i] = all[j];
      all[j] = tmp;
    }
    return all.slice(0, this.config.homeLayout === 'stacked' ? 3 : 4);
  }

  private saveConfig(c: AppConfig): void {
    this.config = c;
    this.palette = buildPalette(c.theme, c.accent, c.liquidGlass);
    if (this.ctx !== null) {
      Prefs.saveConfig(this.ctx, c);
    }
  }

  /** 构造新配置（ArkTS 无对象展开，逐字段赋值；传 undefined 沿用当前值） */
  private cfgWith(theme?: string, accent?: string, liquidGlass?: boolean,
                  updateChannel?: string, androidBrowser?: string,
                  homeLayout?: string, keepDownloadHistory?: boolean,
                  favorites?: string[]): AppConfig {
    const c = new AppConfig();
    c.theme = theme ?? this.config.theme;
    c.accent = accent ?? this.config.accent;
    c.liquidGlass = liquidGlass ?? this.config.liquidGlass;
    c.updateChannel = updateChannel ?? this.config.updateChannel;
    c.androidBrowser = androidBrowser ?? this.config.androidBrowser;
    c.homeLayout = homeLayout ?? this.config.homeLayout;
    c.keepDownloadHistory = keepDownloadHistory ?? this.config.keepDownloadHistory;
    c.favorites = favorites ?? this.config.favorites;
    return c;
  }

  private themeKey(label: string): string {
    if (label === '紫金黑') {
      return 'zijin';
    }
    if (label === '自定义') {
      return 'custom';
    }
    return label === '纯黑' ? 'black' : 'white';
  }

  private applyTheme(label: string): void {
    const key = this.themeKey(label);
    // 紫金黑固定开玻璃；纯黑/纯白为实色；仅「自定义」可自行开关
    const glass = key === 'zijin' ? true : (key === 'custom' ? this.config.liquidGlass : false);
    this.saveConfig(this.cfgWith(key, undefined, glass));
  }

  private accentTint(): string {
    const a = this.palette.accent;
    return a.length === 7 ? `#33${a.slice(1)}` : a;
  }

  private isFav(res: Resource): boolean {
    const id = res.id ?? '';
    return id !== '' && this.config.favorites.indexOf(id) >= 0;
  }

  private toggleFav(res: Resource): void {
    const id = res.id ?? '';
    if (id === '') {
      return;
    }
    const list: string[] = this.config.favorites.slice();
    const idx = list.indexOf(id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(id);
    }
    this.saveConfig(this.cfgWith(undefined, undefined, undefined, undefined, undefined, undefined, undefined, list));
  }

  /** 按「浏览器偏好」打开：内置=ArkWeb 子页，系统=交给外部浏览器 */
  private openUrl(url: string): void {
    if (url === '') {
      return;
    }
    if (this.config.androidBrowser === 'external') {
      const ctx = this.ctx;
      if (ctx !== null) {
        const want: Want = {
          action: 'ohos.want.action.viewData',
          entities: ['entity.system.browsable'],
          uri: url
        };
        ctx.startAbility(want);
      }
    } else {
      router.pushUrl({ url: 'pages/BrowserPage', params: { url: url } });
    }
  }

  // ---- 数据辅助（不用非空断言） ----
  private boxName(): string {
    return this.snapshot?.box?.app_name ?? 'Pointers-BOX';
  }
  private boxIntro(): string {
    return this.snapshot?.box?.app_introduction ?? '';
  }
  private boxKey(): string {
    return this.snapshot?.box?.general_key ?? '';
  }
  private boxQq(): string {
    return this.snapshot?.box?.community_qq ?? '';
  }
  private boxCopyright(): string {
    return this.snapshot?.box?.copyright ?? 'Copyright © 2026 Pointers-BOX All Rights Reserved';
  }
  private annText(): string {
    const a = this.snapshot?.announcement;
    if (a === null || a === undefined) {
      return '';
    }
    return `${a.date}\n${a.content}`;
  }
  private logs(): VersionLog[] {
    return this.snapshot?.versionLogs ?? [];
  }
  private dataStateText(): string {
    const snap = this.snapshot;
    if (snap === null) {
      return '加载中…';
    }
    return snap.offline ? '离线（展示本地缓存）' : '在线';
  }
  private dataStateColor(): string {
    const snap = this.snapshot;
    return snap !== null && !snap.offline ? Green : Amber;
  }

  private detailMeta(res: Resource): string {
    const parts: string[] = [];
    if (res.category !== '') {
      parts.push(res.category);
    }
    const date = res.release_date ?? '';
    if (date !== '') {
      parts.push(date);
    }
    const id = res.id ?? '';
    if (id !== '') {
      parts.push(`序号 ${id}`);
    }
    return parts.join(' · ');
  }

  private shareItems(res: Resource): ShareItem[] {
    const shares = res.shares ?? [];
    if (shares.length > 0) {
      return shares;
    }
    return res.links.map((url: string, i: number): ShareItem => {
      const s = new ShareItem();
      s.name = `分享项 ${i + 1}`;
      s.url = url;
      return s;
    });
  }

  private categories(): string[] {
    const out: string[] = ['全部'];
    const seen: string[] = [];
    (this.snapshot?.resources ?? []).forEach((r: Resource) => {
      if (r.category !== '' && seen.indexOf(r.category) < 0) {
        seen.push(r.category);
      }
    });
    seen.sort();
    seen.forEach((c: string) => out.push(c));
    return out;
  }

  private filteredResources(): Resource[] {
    const kw = this.keyword.trim();
    return (this.snapshot?.resources ?? []).filter((r: Resource): boolean => {
      const catOk = this.category === '全部' || r.category === this.category;
      const kwOk = kw === '' || r.name.indexOf(kw) >= 0 || r.introduction.indexOf(kw) >= 0;
      return catOk && kwOk;
    });
  }

  private favorites(): Resource[] {
    return (this.snapshot?.resources ?? []).filter((r: Resource): boolean => this.isFav(r));
  }

  private normalizeHttp(raw: string): string {
    const u = raw.trim();
    if (u === '' || u.indexOf('://') >= 0) {
      return u;
    }
    return `https://${u}`;
  }

  private addLink(name: string, url: string, remark: string): void {
    const link = new UserLink();
    link.id = `${Date.now()}`;
    link.name = name;
    link.url = this.normalizeHttp(url);
    link.remark = remark;
    link.createdAt = Date.now();
    const list: UserLink[] = [link];
    this.links.forEach((l: UserLink) => list.push(l));
    this.links = list;
    if (this.ctx !== null) {
      Prefs.saveLinks(this.ctx, list);
    }
  }

  private deleteLink(id: string): void {
    const list = this.links.filter((l: UserLink): boolean => l.id !== id);
    this.links = list;
    if (this.ctx !== null) {
      Prefs.saveLinks(this.ctx, list);
    }
  }

  private openAddDialog(): void {
    if (this.addDialog === null) {
      this.addDialog = new CustomDialogController({
        builder: AddLinkDialog({
          palette: this.palette,
          onConfirm: (name: string, url: string, remark: string): void => {
            this.addLink(name, url, remark);
          }
        }),
        autoCancel: true,
        alignment: DialogAlignment.Center
      });
    }
    this.addDialog.open();
  }

  private isNewer(latest: string, current: string): boolean {
    const la = latest.replace('v', '').replace('V', '').split('.');
    const cu = current.split('.');
    const n = Math.max(la.length, cu.length);
    for (let i = 0; i < n; i++) {
      const a = i < la.length ? Number.parseInt(la[i]) : 0;
      const b = i < cu.length ? Number.parseInt(cu[i]) : 0;
      if (a !== b) {
        return a > b;
      }
    }
    return false;
  }

  private async checkUpdate(): Promise<void> {
    if (this.checking) {
      return;
    }
    this.checking = true;
    this.updateMsg = '检查中…';
    this.updateUrl = '';
    const isGitee = this.config.updateChannel === 'gitee';
    const api = isGitee
      ? 'https://gitee.com/api/v5/repos/PointersMZX/Pointers-BOX/releases/latest'
      : 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/latest';
    const page = isGitee
      ? 'https://gitee.com/PointersMZX/Pointers-BOX/releases'
      : 'https://github.com/PointersMZX/Pointers-BOX/releases';
    const client = http.createHttp();
    try {
      const res: http.HttpResponse = await client.request(api, {
        method: http.RequestMethod.GET,
        readTimeout: 15000,
        connectTimeout: 15000
      } as http.HttpRequestOptions);
      if (res.responseCode === 403) {
        this.updateMsg = '接口访问受限（限流），请稍后再试';
      } else if (res.responseCode === 404) {
        this.updateMsg = '未找到任何发布版本';
      } else if (res.responseCode < 200 || res.responseCode >= 300) {
        this.updateMsg = `检查失败：HTTP ${res.responseCode}`;
      } else {
        const text = typeof res.result === 'string' ? res.result : '';
        const root = JSON.parse(text) as Record<string, string>;
        const tag = root['tag_name'] ?? '';
        const html = root['html_url'] ?? page;
        if (tag === '') {
          this.updateMsg = '发布数据缺少版本号';
        } else if (this.isNewer(tag, APP_VERSION)) {
          this.updateMsg = `发现新版本 ${tag}（当前 v${APP_VERSION}）`;
          this.updateUrl = html;
        } else {
          this.updateMsg = `已是最新版本（v${APP_VERSION}）`;
          this.updateUrl = html;
        }
      }
    } catch (e) {
      this.updateMsg = '检查失败：网络不可用';
    } finally {
      client.destroy();
      this.checking = false;
    }
  }

  build() {
    Stack() {
      if (this.palette.glassOn) {
        OrbBackground()
      }
      Column() {
        Column() {
          if (this.page === 'home') {
            this.HomePage()
          } else if (this.page === 'resources') {
            if (this.detailRes !== null) {
              this.ResourceDetailView(this.detailRes)
            } else {
              this.ResourcesPage()
            }
          } else if (this.page === 'links') {
            this.LinksPage()
          } else {
            this.SettingsPage()
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Row() {
          this.NavItem('首页', 'home')
          this.NavItem('资源', 'resources')
          this.NavItem('链接', 'links')
          this.NavItem('浏览器', 'browser')
          this.NavItem('下载', 'downloads')
          this.NavItem('设置', 'settings')
        }
        .width('100%')
        .padding({ top: 10, bottom: 10 })
        .backgroundColor(this.palette.navBg)
        .backgroundBlurStyle(BlurStyle.Thin)
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
  NavItem(label: string, key: string) {
    Text(label)
      .fontSize(14)
      .fontWeight(this.page === key ? FontWeight.Bold : FontWeight.Normal)
      .fontColor(this.page === key ? this.palette.accent : this.palette.textSecondary)
      .onClick(() => {
        if (key === 'browser') {
          router.pushUrl({ url: 'pages/BrowserPage' });
          return;
        }
        if (key === 'downloads') {
          router.pushUrl({ url: 'pages/DownloadsPage' });
          return;
        }
        this.page = key;
        if (key !== 'resources') {
          this.detailRes = null;
        }
      })
  }

  // ================= 首页 =================
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
          Row({ space: 8 }) {
            ForEach(['堆叠', '平铺'], (label: string) => {
              Text(label)
                .fontSize(12)
                .fontWeight(this.layoutKey() === (label === '堆叠' ? 'stacked' : 'flat') ? FontWeight.Bold : FontWeight.Normal)
                .fontColor(this.layoutKey() === (label === '堆叠' ? 'stacked' : 'flat') ? this.palette.textPrimary : this.palette.textSecondary)
                .backgroundColor(this.layoutKey() === (label === '堆叠' ? 'stacked' : 'flat') ? this.palette.accent : this.palette.cardBg)
                .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
                .borderRadius(10)
                .padding({ left: 10, right: 10, top: 5, bottom: 5 })
                .onClick(() => {
                  this.saveConfig(this.cfgWith(undefined, undefined, undefined, undefined, undefined,
                    label === '堆叠' ? 'stacked' : 'flat'));
                  this.recommends = this.pickRecommends();
                })
            }, (label: string) => label)
            Text('换一批')
              .fontSize(12)
              .fontColor(this.palette.textPrimary)
              .backgroundColor(this.palette.cardBg)
              .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
              .borderRadius(10)
              .padding({ left: 10, right: 10, top: 5, bottom: 5 })
              .onClick(() => {
                this.recommends = this.pickRecommends();
              })
          }
        }
        .width('100%')

        if (this.recommends.length === 0) {
          Text(this.loaded ? '暂无资源' : '加载中…（线路重试中）')
            .fontSize(13)
            .fontColor(this.palette.textSecondary)
        }

        if (this.config.homeLayout === 'stacked') {
          this.StackedCards()
        } else {
          ForEach(this.recommends.slice(0, 4), (res: Resource) => {
            this.RecommendCard(res)
          }, (res: Resource) => `${res.id ?? res.name}_flat`)
        }

        if (this.annText() !== '') {
          Column() {
            Text('公告')
              .fontSize(16)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.palette.textPrimary)
            Text(this.annText())
              .fontSize(13)
              .fontColor(this.palette.textSecondary)
              .margin({ top: 8 })
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(20)
          .backgroundColor(this.palette.cardBgAlt)
          .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
          .borderRadius(18)
          .border({ width: 1, color: this.palette.navBorder })
        }

        Column() {
          Text('数据状态')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Text(this.dataStateText())
            .fontSize(13)
            .fontColor(this.dataStateColor())
            .margin({ top: 8 })
          Text(`更新渠道：${this.config.updateChannel === 'gitee' ? '国内镜像（Gitee）' : '全球官方（GitHub）'}`)
            .fontSize(12)
            .fontColor(this.palette.accent)
            .margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        this.VersionLogsCard(false)

        if (this.favorites().length > 0) {
          Column() {
            Text('我的收藏')
              .fontSize(16)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.palette.textPrimary)
            Scroll() {
              Row({ space: 10 }) {
                ForEach(this.favorites().slice(0, 8), (res: Resource) => {
                  Column() {
                    Text(res.name)
                      .fontWeight(FontWeight.Medium)
                      .fontColor(this.palette.textPrimary)
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                    if (res.introduction !== '') {
                      Text(res.introduction)
                        .fontSize(12)
                        .fontColor(this.palette.textSecondary)
                        .maxLines(2)
                        .textOverflow({ overflow: TextOverflow.Ellipsis })
                        .margin({ top: 4 })
                    }
                  }
                  .alignItems(HorizontalAlign.Start)
                  .width(190)
                  .padding(12)
                  .backgroundColor(this.palette.cardBg)
                  .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
                  .borderRadius(14)
                  .border({ width: 1, color: this.palette.navBorder })
                  .onClick(() => {
                    this.detailRes = res;
                    this.page = 'resources';
                  })
                }, (res: Resource) => `${res.id ?? res.name}_fav`)
              }
            }
            .scrollable(ScrollDirection.Horizontal)
            .scrollBar(BarState.Off)
            .width('100%')
            .margin({ top: 10 })
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(20)
          .backgroundColor(this.palette.cardBgAlt)
          .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
          .borderRadius(18)
          .border({ width: 1, color: this.palette.navBorder })
        }

        Column() {
          Text('快捷入口')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Row({ space: 10 }) {
            ForEach(['资源库', '链接', '浏览器', '下载'], (label: string) => {
              Text(label)
                .fontSize(13)
                .fontColor(this.palette.textPrimary)
                .backgroundColor(this.palette.cardBg)
                .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
                .borderRadius(12)
                .padding({ left: 14, right: 14, top: 8, bottom: 8 })
                .onClick(() => {
                  if (label === '浏览器') {
                    router.pushUrl({ url: 'pages/BrowserPage' });
                  } else if (label === '下载') {
                    router.pushUrl({ url: 'pages/DownloadsPage' });
                  } else {
                    this.page = label === '资源库' ? 'resources' : 'links';
                  }
                })
            }, (label: string) => label)
          }
          .margin({ top: 10 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
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

  private layoutKey(): string {
    return this.config.homeLayout === 'flat' ? 'flat' : 'stacked';
  }

  @Builder
  RecommendCard(res: Resource) {
    Column() {
      Row() {
        Text(res.name)
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.palette.textPrimary)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.isFav(res) ? '★' : '☆')
          .fontSize(18)
          .fontColor(Amber)
          .onClick(() => {
            this.toggleFav(res);
          })
      }
      .width('100%')
      if (res.introduction !== '') {
        Text(res.introduction)
          .fontSize(13)
          .fontColor(this.palette.textSecondary)
          .maxLines(3)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 6 })
      }
      Blank()
      if (this.detailMeta(res) !== '') {
        Text(this.detailMeta(res))
          .fontSize(11)
          .fontColor(this.palette.accent)
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .height(148)
    .padding(20)
    .backgroundColor(this.palette.cardBg)
    .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
    .borderRadius(18)
    .border({ width: 1, color: this.palette.navBorder })
    .onClick(() => {
      this.detailRes = res;
      this.page = 'resources';
    })
  }

  /** 堆叠卡：深层卡只露边角（不画文字，避免透过玻璃叠字） */
  @Builder
  StackedCards() {
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach(this.recommends.slice(0, 3).reverse(), (res: Resource, i: number) => {
        if (i === 0) {
          this.RecommendCard(res)
        } else {
          Column()
            .width('100%')
            .height(148)
            .backgroundColor(this.palette.cardBg)
            .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
            .borderRadius(18)
            .border({ width: 1, color: this.palette.navBorder })
            .margin({ left: 10, right: 10 })
            .offset({ x: i * 12, y: i * 14 })
        }
      }, (res: Resource) => `${res.id ?? res.name}_stack`)
    }
    .width('100%')
    .height(this.recommends.length > 1 ? 148 + 14 * (Math.min(this.recommends.length, 3) - 1) : 148)
    .padding({ right: 24, bottom: 28 })
  }

  @Builder
  VersionLogsCard(inSettings: boolean) {
    if (this.logs().length > 0) {
      Column() {
        Row() {
          Text('版本日志')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Blank()
          Text((inSettings ? this.logsExpandedSettings : this.logsExpanded) ? '收起 ▴' : '展开 ▾')
            .fontSize(12)
            .fontColor(this.palette.textSecondary)
        }
        .width('100%')
        .onClick(() => {
          if (inSettings) {
            this.logsExpandedSettings = !this.logsExpandedSettings;
          } else {
            this.logsExpanded = !this.logsExpanded;
          }
        })
        .margin({ bottom: 8 })

        if (inSettings ? this.logsExpandedSettings : this.logsExpanded) {
          ForEach(inSettings ? this.logs() : this.logs().slice(0, 3), (v: VersionLog) => {
            Row() {
              Text(v.version)
                .fontSize(11)
                .fontColor(this.palette.accent)
                .backgroundColor(this.accentTint())
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
          }, (v: VersionLog) => `${v.version}_${inSettings ? 'set' : 'home'}`)
        } else {
          Text(`${this.logs()[0].version}  ${this.logs()[0].log}`)
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
      .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
      .borderRadius(18)
      .border({ width: 1, color: this.palette.navBorder })
    }
  }

  // ================= 资源库 =================
  @Builder
  ResourcesPage() {
    Scroll() {
      Column({ space: 12 }) {
        Text('资源')
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.palette.textPrimary)
          .margin({ top: 24 })

        TextInput({ placeholder: '搜索资源名称/简介', text: this.keyword })
          .height(44)
          .borderRadius(12)
          .backgroundColor(this.palette.cardBg)
          .fontColor(this.palette.textPrimary)
          .placeholderColor(this.palette.textSecondary)
          .onChange((v: string) => {
            this.keyword = v;
          })

        // 分类横滑（可拖动，不再被截断）
        Scroll() {
          Row({ space: 8 }) {
            ForEach(this.categories(), (c: string) => {
              Text(c)
                .fontSize(13)
                .fontWeight(this.category === c ? FontWeight.Bold : FontWeight.Normal)
                .fontColor(this.category === c ? this.palette.textPrimary : this.palette.textSecondary)
                .backgroundColor(this.category === c ? this.palette.accent : this.palette.cardBg)
                .backgroundBlurStyle(this.palette.glassOn && this.category !== c ? BlurStyle.Thin : BlurStyle.NONE)
                .borderRadius(12)
                .padding({ left: 12, right: 12, top: 6, bottom: 6 })
                .onClick(() => {
                  this.category = c;
                })
            }, (c: string) => c)
          }
        }
        .scrollable(ScrollDirection.Horizontal)
        .scrollBar(BarState.Off)
        .width('100%')

        if (this.filteredResources().length === 0) {
          Text(this.loaded ? '没有匹配的资源' : '加载中…（线路重试中）')
            .fontSize(13)
            .fontColor(this.palette.textSecondary)
        }
        ForEach(this.filteredResources(), (res: Resource) => {
          Column() {
            Row() {
              Text(res.name)
                .fontSize(17)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.palette.textPrimary)
                .layoutWeight(1)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
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
                .maxLines(2)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .margin({ top: 6 })
            }
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(18)
          .backgroundColor(this.palette.cardBg)
          .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
          .borderRadius(18)
          .border({ width: 1, color: this.palette.navBorder })
          .onClick(() => {
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
            .maxLines(2)
          Text('✕ 返回')
            .fontSize(14)
            .fontColor(this.palette.textPrimary)
            .backgroundColor(this.palette.cardBg)
            .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
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
        .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        Column({ space: 8 }) {
          Text('分享项')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          ForEach(this.shareItems(res), (item: ShareItem) => {
            Row() {
              Text(item.name)
                .fontSize(13)
                .fontColor(this.palette.textPrimary)
                .layoutWeight(1)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Button('领取')
                .fontSize(13)
                .height(34)
                .onClick(() => {
                  this.openUrl(item.url);
                })
            }
            .width('100%')
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .backgroundColor(this.palette.cardBgAlt)
            .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
            .borderRadius(12)
            .border({ width: 1, color: this.palette.navBorder })
          }, (item: ShareItem) => `${item.name}_${item.url}`)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')

        Button(this.isFav(res) ? '★ 已收藏' : '☆ 收藏')
          .width('100%')
          .onClick(() => {
            this.toggleFav(res);
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 24 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }

  // ================= 链接 =================
  @Builder
  LinksPage() {
    Scroll() {
      Column({ space: 12 }) {
        Row() {
          Text('链接')
            .fontSize(30)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.palette.textPrimary)
          Blank()
          Button('+ 添加')
            .fontSize(14)
            .height(36)
            .onClick(() => {
              this.openAddDialog();
            })
        }
        .width('100%')
        .margin({ top: 24 })

        if (this.links.length === 0) {
          Text('还没有链接，点右上「+ 添加」新建一条')
            .fontSize(13)
            .fontColor(this.palette.textSecondary)
        }
        ForEach(this.links, (link: UserLink) => {
          Row() {
            Column() {
              Text(link.name)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.palette.textPrimary)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(link.url)
                .fontSize(12)
                .fontColor(this.palette.accent)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              if (link.remark !== '') {
                Text(link.remark)
                  .fontSize(12)
                  .fontColor(this.palette.textSecondary)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Row() {
              Text('打开')
                .fontSize(13)
                .fontColor(this.palette.accent)
                .padding(8)
                .onClick(() => {
                  this.openUrl(link.url);
                })
              Text('删除')
                .fontSize(13)
                .fontColor(Redish)
                .padding(8)
                .onClick(() => {
                  this.deleteLink(link.id);
                })
            }
          }
          .width('100%')
          .padding(14)
          .backgroundColor(this.palette.cardBgAlt)
          .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
          .borderRadius(14)
          .border({ width: 1, color: this.palette.navBorder })
          .onClick(() => {
            this.openUrl(link.url);
          })
        }, (link: UserLink) => link.id)
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 20 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }

  // ================= 设置 =================
  @Builder
  SettingsPage() {
    Scroll() {
      Column({ space: 14 }) {
        Text('设置')
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.palette.textPrimary)
          .margin({ top: 24 })

        // 关于应用（置顶，版本号直接可见）
        Column() {
          Text('关于应用')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Text(this.boxName())
            .fontSize(13)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 6 })
          Text(`v${APP_VERSION}`)
            .fontSize(12)
            .fontColor(this.palette.accent)
            .margin({ top: 2 })
          if (this.boxIntro() !== '') {
            Text(this.boxIntro())
              .fontSize(12)
              .fontColor(this.palette.textSecondary)
              .margin({ top: 4 })
          }
          if (this.boxKey() !== '') {
            Text(`通用密钥：${this.boxKey()}`)
              .fontSize(12)
              .fontColor(this.palette.textSecondary)
              .margin({ top: 4 })
          }
          if (this.boxQq() !== '') {
            Text(`社区 QQ 群：${this.boxQq()}`)
              .fontSize(12)
              .fontColor(this.palette.textSecondary)
              .margin({ top: 4 })
          }
          Text(this.boxCopyright())
            .fontSize(12)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        // 版本日志（默认收起，不再把下面的设置挤出屏幕）
        this.VersionLogsCard(true)

        // 主题外观
        Column() {
          Text('主题外观')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Text('默认「紫金黑」（液态玻璃锁死开启）；「自定义」可选颜色并自由开关玻璃；「纯黑 / 纯白」为实色主题')
            .fontSize(12)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 4 })
          Row({ space: 8 }) {
            ForEach(THEME_LABELS, (label: string) => {
              Text(label)
                .fontSize(13)
                .fontWeight(this.config.theme === this.themeKey(label) ? FontWeight.Bold : FontWeight.Normal)
                .fontColor(this.config.theme === this.themeKey(label) ? this.palette.textPrimary : this.palette.textSecondary)
                .backgroundColor(this.config.theme === this.themeKey(label) ? this.palette.accent : this.palette.cardBg)
                .backgroundBlurStyle(this.palette.glassOn && this.config.theme !== this.themeKey(label) ? BlurStyle.Thin : BlurStyle.NONE)
                .borderRadius(12)
                .padding({ left: 12, right: 12, top: 8, bottom: 8 })
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
              .enabled(this.config.theme === 'custom')
              .margin({ left: 8 })
              .onChange((on: boolean) => {
                this.saveConfig(this.cfgWith(undefined, undefined, on));
              })
            Text(this.config.theme === 'custom' ? '（可开关）' : '（仅「自定义」主题可切换）')
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
                  .border({
                    width: 2,
                    color: normalizeAccent(this.config.accent).toLowerCase() === preset.toLowerCase()
                      ? this.palette.textPrimary : Color.Transparent
                  })
                  .onClick(() => {
                    this.hexInput = preset;
                    this.saveConfig(this.cfgWith(undefined, preset));
                  })
              }, (preset: string) => preset)
            }
            .margin({ top: 8 })
            // 色值输入即生效，无需「确定」按钮
            TextInput({ placeholder: '输入 #RRGGBB 即时生效', text: this.hexInput })
              .height(44)
              .borderRadius(12)
              .backgroundColor(this.palette.cardBg)
              .fontColor(this.palette.textPrimary)
              .placeholderColor(this.palette.textSecondary)
              .margin({ top: 8 })
              .onChange((v: string) => {
                this.hexInput = v;
                const t = v.trim();
                if (/^#[0-9a-fA-F]{3}$/.test(t) || /^#[0-9a-fA-F]{6}$/.test(t)) {
                  this.saveConfig(this.cfgWith(undefined, t));
                }
              })
          }
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        // 更新检查
        Column() {
          Text('更新检查')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Row() {
            Text('国内镜像（Gitee）')
              .fontSize(13)
              .fontColor(this.config.updateChannel === 'gitee' ? this.palette.accent : this.palette.textSecondary)
              .onClick(() => {
                this.saveConfig(this.cfgWith(undefined, undefined, undefined, 'gitee'));
              })
            Text('全球官方（GitHub）')
              .fontSize(13)
              .fontColor(this.config.updateChannel === 'github' ? this.palette.accent : this.palette.textSecondary)
              .margin({ left: 16 })
              .onClick(() => {
                this.saveConfig(this.cfgWith(undefined, undefined, undefined, 'github'));
              })
          }
          .width('100%')
          .margin({ top: 10 })
          Text('国内网络建议选 Gitee；发现新版本后到发布页下载对应安装包')
            .fontSize(12)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 6 })
          Row() {
            Button(this.checking ? '检查中…' : '检查更新')
              .fontSize(14)
              .height(36)
              .onClick(() => {
                this.checkUpdate();
              })
            if (this.updateMsg !== '') {
              Text(this.updateMsg)
                .fontSize(12)
                .fontColor(this.palette.textSecondary)
                .layoutWeight(1)
                .margin({ left: 10 })
            }
          }
          .width('100%')
          .margin({ top: 10 })
          if (this.updateUrl !== '') {
            Button('打开发布页')
              .fontSize(14)
              .height(36)
              .margin({ top: 8 })
              .onClick(() => {
                this.openUrl(this.updateUrl);
              })
          }
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        // 浏览器偏好（真正接线：影响「领取」与链接打开方式）
        Column() {
          Text('浏览器偏好')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Text('影响资源「领取」与链接页的打开方式')
            .fontSize(12)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 6 })
          Row() {
            Text('内置浏览器')
              .fontSize(13)
              .fontColor(this.config.androidBrowser !== 'external' ? this.palette.accent : this.palette.textSecondary)
              .onClick(() => {
                this.saveConfig(this.cfgWith(undefined, undefined, undefined, undefined, 'builtin'));
              })
            Text('系统浏览器')
              .fontSize(13)
              .fontColor(this.config.androidBrowser === 'external' ? this.palette.accent : this.palette.textSecondary)
              .margin({ left: 16 })
              .onClick(() => {
                this.saveConfig(this.cfgWith(undefined, undefined, undefined, undefined, 'external'));
              })
          }
          .width('100%')
          .margin({ top: 10 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })

        // 下载设置
        Column() {
          Text('下载设置')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.palette.textPrimary)
          Row() {
            Text('保留下载历史')
              .fontSize(13)
              .fontColor(this.palette.textPrimary)
            Toggle({ type: ToggleType.Switch, isOn: this.config.keepDownloadHistory })
              .selectedColor(this.palette.accent)
              .margin({ left: 10 })
              .onChange((on: boolean) => {
                this.saveConfig(this.cfgWith(undefined, undefined, undefined, undefined, undefined, undefined, on));
              })
          }
          .margin({ top: 10 })
          Text('关闭后下载记录不再跨次保留')
            .fontSize(11)
            .fontColor(this.palette.textSecondary)
            .margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(20)
        .backgroundColor(this.palette.cardBgAlt)
        .backgroundBlurStyle(this.palette.glassOn ? BlurStyle.Thin : BlurStyle.NONE)
        .borderRadius(18)
        .border({ width: 1, color: this.palette.navBorder })
        .margin({ bottom: 24 })
      }
      .width('100%')
      .padding({ left: 16, right: 16 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }
}

/** 添加链接弹窗：名称/网址（自动补 https://）/备注，校验失败就地提示 */
@CustomDialog
struct AddLinkDialog {
  controller?: CustomDialogController;
  palette: ThemePalette = new ThemePalette();
  onConfirm: (name: string, url: string, remark: string) => void = (): void => {};
  @State name: string = '';
  @State url: string = '';
  @State remark: string = '';
  @State error: string = '';

  build() {
    Column({ space: 10 }) {
      Text('添加链接')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.palette.textPrimary)
      TextInput({ placeholder: '名称，例如 官方网站', text: this.name })
        .height(44)
        .borderRadius(12)
        .backgroundColor(this.palette.cardBg)
        .fontColor(this.palette.textPrimary)
        .placeholderColor(this.palette.textSecondary)
        .onChange((v: string) => {
          this.name = v;
          this.error = '';
        })
      TextInput({ placeholder: '网址，例如 pointers-box.cc.cd（自动补 https://）', text: this.url })
        .height(44)
        .borderRadius(12)
        .backgroundColor(this.palette.cardBg)
        .fontColor(this.palette.textPrimary)
        .placeholderColor(this.palette.textSecondary)
        .onChange((v: string) => {
          this.url = v;
          this.error = '';
        })
      TextInput({ placeholder: '备注（可选）', text: this.remark })
        .height(44)
        .borderRadius(12)
        .backgroundColor(this.palette.cardBg)
        .fontColor(this.palette.textPrimary)
        .placeholderColor(this.palette.textSecondary)
        .onChange((v: string) => {
          this.remark = v;
        })
      if (this.error !== '') {
        Text(this.error)
          .fontSize(12)
          .fontColor(Redish)
      }
      Row({ space: 10 }) {
        Blank()
        Button('取消')
          .fontSize(14)
          .height(36)
          .backgroundColor(this.palette.cardBg)
          .fontColor(this.palette.textSecondary)
          .onClick(() => {
            this.controller?.close();
          })
        Button('添加')
          .fontSize(14)
          .height(36)
          .backgroundColor(this.palette.accent)
          .onClick(() => {
            const n = this.name.trim();
            const u = this.url.trim();
            if (n === '') {
              this.error = '请填写名称';
              return;
            }
            if (u === '') {
              this.error = '请填写网址';
              return;
            }
            this.onConfirm(n, u, this.remark.trim());
            this.controller?.close();
          })
      }
      .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(20)
    .backgroundColor(this.palette.cardBgAlt)
    .borderRadius(18)
  }
}
