export class ShareItem {
  name: string = '';
  url: string = '';
}

export class Resource {
  id?: string;
  name: string = '';
  introduction: string = '';
  release_date?: string;
  category: string = '';
  links: string[] = [];
  shares?: ShareItem[];
}

export class Announcement {
  date: string = '';
  content: string = '';
}

export class VersionLog {
  version: string = '';
  log: string = '';
}

export class BoxInfo {
  app_name: string = '';
  app_introduction: string = '';
  general_key?: string;
  developer: string = '';
  community_qq: string = '';
  copyright: string = '';
}

export class DataSnapshot {
  resources?: Resource[];
  announcement?: Announcement | null = null;
  box?: BoxInfo | null = null;
  versionLogs?: VersionLog[] | null = null;
  offline: boolean = false;
  warnings: string[] = [];
}

export class AppConfig {
  updateChannel: string = 'gitee';
  theme: string = 'zijin';
  accent: string = '#7c5cff';
  liquidGlass: boolean = true;
}

export class UserLink {
  id: string = '';
  name: string = '';
  url: string = '';
  remark: string = '';
  createdAt: number = 0;
}
