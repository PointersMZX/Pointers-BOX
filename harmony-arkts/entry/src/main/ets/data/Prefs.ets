// 本地偏好与用户数据持久化（鸿蒙 Preferences）：配置 + 用户链接 + 下载历史
import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { AppConfig, UserLink } from './Models';

const STORE_NAME = 'pointers_box';
const KEY_CONFIG = 'app_config';
const KEY_LINKS = 'user_links';
const KEY_HISTORY = 'download_history';

function getStore(ctx: common.UIAbilityContext): preferences.Preferences | null {
  try {
    return preferences.getPreferencesSync(ctx, { name: STORE_NAME });
  } catch (e) {
    return null;
  }
}

export class Prefs {
  static loadConfig(ctx: common.UIAbilityContext): AppConfig {
    const p = getStore(ctx);
    const raw = (p?.getSync(KEY_CONFIG, '') as string) ?? '';
    const cfg = new AppConfig();
    if (raw !== '') {
      try {
        const obj = JSON.parse(raw) as AppConfig;
        cfg.updateChannel = obj.updateChannel ?? cfg.updateChannel;
        cfg.theme = obj.theme ?? cfg.theme;
        cfg.accent = obj.accent ?? cfg.accent;
        cfg.liquidGlass = obj.liquidGlass ?? cfg.liquidGlass;
        cfg.androidBrowser = obj.androidBrowser ?? cfg.androidBrowser;
        cfg.homeLayout = obj.homeLayout ?? cfg.homeLayout;
        cfg.keepDownloadHistory = obj.keepDownloadHistory ?? cfg.keepDownloadHistory;
        cfg.favorites = obj.favorites ?? cfg.favorites;
      } catch (e) {
        // 旧版本/损坏数据：回落默认
      }
    }
    return cfg;
  }

  static saveConfig(ctx: common.UIAbilityContext, cfg: AppConfig): void {
    const p = getStore(ctx);
    if (p === null) {
      return;
    }
    p.putSync(KEY_CONFIG, JSON.stringify(cfg));
    p.flush();
  }

  static loadLinks(ctx: common.UIAbilityContext): UserLink[] {
    const p = getStore(ctx);
    const raw = (p?.getSync(KEY_LINKS, '') as string) ?? '';
    if (raw === '') {
      return [];
    }
    try {
      return JSON.parse(raw) as UserLink[];
    } catch (e) {
      return [];
    }
  }

  static saveLinks(ctx: common.UIAbilityContext, links: UserLink[]): void {
    const p = getStore(ctx);
    if (p === null) {
      return;
    }
    p.putSync(KEY_LINKS, JSON.stringify(links));
    p.flush();
  }

  static loadHistory(ctx: common.UIAbilityContext): string[] {
    const p = getStore(ctx);
    const raw = (p?.getSync(KEY_HISTORY, '') as string) ?? '';
    if (raw === '') {
      return [];
    }
    try {
      return JSON.parse(raw) as string[];
    } catch (e) {
      return [];
    }
  }

  static saveHistory(ctx: common.UIAbilityContext, list: string[]): void {
    const p = getStore(ctx);
    if (p === null) {
      return;
    }
    p.putSync(KEY_HISTORY, JSON.stringify(list));
    p.flush();
  }
}
