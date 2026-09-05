"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const electronUpdater = require("electron-updater");
function resourcesRoot() {
  const devRoot = path.join(electron.app.getAppPath(), "resources");
  if (fs.existsSync(path.join(devRoot, "icons"))) return devRoot;
  return process.resourcesPath || devRoot;
}
function iconFile(name) {
  return path.join(resourcesRoot(), "icons", name);
}
function splashFile() {
  return path.join(resourcesRoot(), "splash", "splash.html");
}
let quitting = false;
function markQuitting() {
  quitting = true;
}
function isQuitting() {
  return quitting;
}
let mainWindow = null;
let splashWindow = null;
function getMainWindow() {
  return mainWindow;
}
function windowIconPath() {
  const path2 = process.platform === "win32" ? iconFile("app.ico") : iconFile("app-icon.png");
  return fs.existsSync(path2) ? path2 : void 0;
}
function createSplashWindow() {
  if (!fs.existsSync(splashFile())) return;
  splashWindow = new electron.BrowserWindow({
    width: 420,
    height: 480,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#1a365d",
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  splashWindow.once("ready-to-show", () => splashWindow?.show());
  void splashWindow.loadFile(splashFile());
}
function closeSplash() {
  if (splashWindow) {
    splashWindow.destroy();
    splashWindow = null;
  }
}
function createMainWindow() {
  const win = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: "Pointers-BOX",
    icon: windowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.once("ready-to-show", () => {
    win.show();
    setTimeout(closeSplash, 800);
  });
  win.on("close", (e) => {
    if (!isQuitting()) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on("closed", () => {
    mainWindow = null;
  });
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow = win;
  return win;
}
let tray = null;
function showWindow() {
  const win = getMainWindow() ?? createMainWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function navigate(page) {
  showWindow();
  getMainWindow()?.webContents.send("navigate", page);
}
function createTray() {
  const icon = electron.nativeImage.createFromPath(iconFile("tray.png"));
  tray = new electron.Tray(icon);
  tray.setToolTip("Pointers-BOX");
  tray.setContextMenu(
    electron.Menu.buildFromTemplate([
      { label: "显示窗口", click: () => showWindow() },
      { label: "打开资源库", click: () => navigate("library") },
      { label: "设置", click: () => navigate("settings") },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          markQuitting();
          electron.app.quit();
        }
      }
    ])
  );
  tray.on("double-click", () => showWindow());
}
function normalizeConfig(raw, defaultDownloadDir) {
  const r = typeof raw === "object" && raw !== null ? raw : {};
  const downloadDirRaw = r["downloadDir"];
  const downloadDir = typeof downloadDirRaw === "string" && downloadDirRaw.trim() !== "" ? downloadDirRaw : defaultDownloadDir;
  const androidBrowser = r["androidBrowser"] === "system" ? "system" : "builtin";
  return { downloadDir, androidBrowser };
}
let cached = null;
function configPath() {
  return path.join(electron.app.getPath("userData"), "config.json");
}
function getConfig() {
  if (cached) return cached;
  let raw = null;
  try {
    if (fs.existsSync(configPath())) raw = JSON.parse(fs.readFileSync(configPath(), "utf-8"));
  } catch {
  }
  cached = normalizeConfig(raw, electron.app.getPath("downloads"));
  return cached;
}
function setConfig(patch) {
  const next = normalizeConfig({ ...getConfig(), ...patch }, electron.app.getPath("downloads"));
  cached = next;
  try {
    fs.mkdirSync(electron.app.getPath("userData"), { recursive: true });
    const tmp = `${configPath()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf-8");
    fs.renameSync(tmp, configPath());
  } catch {
  }
  return next;
}
const REMOTE_URLS = {
  resources: "https://pointers-box.cc.cd/box/resources.json",
  box: "https://pointers-box.cc.cd/box/box.json",
  boxzzyhs: "https://pointers-box.cc.cd/box/boxzzyhs.json"
};
function backupFileName(kind, now) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${kind}-${stamp}.json.bak`;
}
function backupTimestamp(name) {
  const m = /^.+-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json\.bak$/.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}
function pruneBackupNames(names, keep) {
  const scored = names.map((n) => ({ n, t: backupTimestamp(n) ?? -1 }));
  scored.sort((x, y) => y.t - x.t);
  return scored.slice(Math.max(0, keep)).map((s) => s.n);
}
const SYNC_TTL_MS = 5 * 60 * 1e3;
function shouldRefetch(lastSync, now, ttl = SYNC_TTL_MS) {
  if (lastSync === null) return true;
  return now - lastSync >= ttl;
}
function requestText(url, timeoutMs, headers) {
  return new Promise((resolve, reject) => {
    const request = electron.net.request(url);
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        request.setHeader(name, value);
      }
    }
    let settled = false;
    const timer = setTimeout(() => {
      request.abort();
      finish(new Error("请求超时"));
    }, timeoutMs);
    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else if (result) resolve(result);
    };
    request.on("response", (response) => {
      const chunks = [];
      response.on("data", (c) => chunks.push(c));
      response.on(
        "end",
        () => finish(null, {
          status: response.statusCode ?? 0,
          text: Buffer.concat(chunks).toString("utf-8")
        })
      );
      response.on("error", (e) => finish(e));
    });
    request.on("error", (e) => finish(e));
    request.end();
  });
}
class DataFileError extends Error {
  constructor(message) {
    super(message);
    this.name = "DataFileError";
  }
}
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v) {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function asLooseString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}
function parseLooseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
    }
  }
  throw new DataFileError("JSON 解析失败：文件内容不是合法 JSON（含围栏包裹内容）");
}
function validateResources(raw) {
  if (!isRecord(raw) || !Array.isArray(raw["resources"])) {
    throw new DataFileError("resource.json 结构错误：缺少 resources 数组");
  }
  const resources = [];
  const errors = [];
  const list = raw["resources"];
  list.forEach((item, idx) => {
    if (!isRecord(item)) {
      errors.push(`resources[${idx}] 不是对象，已跳过`);
      return;
    }
    const id = item["id"];
    const name = asString(item["name"]);
    const links = Array.isArray(item["links"]) ? item["links"].filter(
      (l) => typeof l === "string" && l.trim() !== ""
    ) : [];
    const idOk = typeof id === "number" || typeof id === "string";
    if (!idOk || name === null || links.length === 0) {
      errors.push(`resources[${idx}] 缺少有效 id/name/links，已跳过`);
      return;
    }
    resources.push({
      id,
      name,
      introduction: asLooseString(item["introduction"]),
      release_date: asString(item["release_date"]) ?? void 0,
      last_modified: asString(item["last_modified"]) ?? void 0,
      category: asString(item["category"]) ?? "未分类",
      links
    });
  });
  return { valid: resources, invalidCount: errors.length, errors };
}
function validateAnnouncement(raw) {
  if (!isRecord(raw)) return null;
  const a = raw["announcement"];
  if (!isRecord(a)) return null;
  const content = asString(a["content"]);
  if (content === null) return null;
  return { date: asString(a["date"]) ?? "", content };
}
function validateVersionLogs(raw) {
  if (!isRecord(raw) || !Array.isArray(raw["version_logs"])) return [];
  return raw["version_logs"].filter(isRecord).map((v) => ({ version: asString(v["version"]) ?? "", log: asLooseString(v["log"]) })).filter((v) => v.version !== "");
}
function validateBoxInfo(raw) {
  if (!isRecord(raw)) return null;
  const app_name = asString(raw["app_name"]);
  if (app_name === null) return null;
  return {
    app_name,
    app_version: asString(raw["app_version"]) ?? "",
    app_introduction: asLooseString(raw["app_introduction"]),
    general_key: asString(raw["general_key"]) ?? void 0,
    developer: asString(raw["developer"]) ?? "",
    community_qq: asString(raw["community_qq"]) ?? "",
    copyright: asLooseString(raw["copyright"])
  };
}
function validateAuthorWords(raw) {
  if (!isRecord(raw)) return null;
  const content = asString(raw["content"]);
  return content === null ? null : { content };
}
const KEEP_BACKUPS = 10;
const FETCH_TIMEOUT_MS$1 = 1e4;
const WORK_FILES = {
  resources: "resources.json",
  box: "box.json",
  boxzzyhs: "boxzzyhs.json"
};
function backupKind(key) {
  return key === "resources" ? "resource" : key;
}
function emptyResourceData() {
  return { resources: [], version_logs: [], announcement: null };
}
let state = null;
function userDir() {
  return electron.app.getPath("userData");
}
function dataDir() {
  return path.join(userDir(), "data");
}
function backupDir() {
  return path.join(userDir(), "backups");
}
function lastSyncPath() {
  return path.join(userDir(), "last-sync.json");
}
function workPath(key) {
  return path.join(dataDir(), WORK_FILES[key]);
}
function ensureDirs() {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.mkdirSync(backupDir(), { recursive: true });
}
function msg(e) {
  return e instanceof Error ? e.message : String(e);
}
function atomicWrite(path2, text) {
  const tmp = `${path2}.tmp`;
  try {
    fs.writeFileSync(tmp, text, "utf-8");
    fs.renameSync(tmp, path2);
  } catch {
    fs.writeFileSync(path2, text, "utf-8");
  }
}
function backupWork(key) {
  ensureDirs();
  const path$1 = workPath(key);
  if (!fs.existsSync(path$1)) return;
  fs.copyFileSync(path$1, path.join(backupDir(), backupFileName(backupKind(key), /* @__PURE__ */ new Date())));
  rotateBackups(backupKind(key));
}
function rotateBackups(kind) {
  const names = fs.readdirSync(backupDir()).filter(
    (n) => n.startsWith(`${kind}-`) && n.endsWith(".json.bak")
  );
  for (const n of pruneBackupNames(names, KEEP_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(backupDir(), n));
    } catch {
    }
  }
}
function persistWork(key, rawText) {
  const path2 = workPath(key);
  if (fs.existsSync(path2)) {
    if (fs.readFileSync(path2, "utf-8") === rawText) return;
    backupWork(key);
  }
  atomicWrite(path2, rawText);
}
async function fetchJson(url) {
  const { status, text } = await requestText(url, FETCH_TIMEOUT_MS$1);
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
  return parseLooseJson(text);
}
function loadFromDisk() {
  const warnings = [];
  let data = emptyResourceData();
  let box = null;
  let authorWords = null;
  const resourcesPath = workPath("resources");
  if (fs.existsSync(resourcesPath)) {
    try {
      const raw = parseLooseJson(fs.readFileSync(resourcesPath, "utf-8"));
      const clean = validateResources(raw);
      data = {
        resources: clean.valid,
        version_logs: validateVersionLogs(raw),
        announcement: validateAnnouncement(raw)
      };
      warnings.push(...clean.errors);
    } catch (e) {
      warnings.push(`本地 resources.json 无效已忽略：${msg(e)}`);
    }
  }
  const boxPath = workPath("box");
  if (fs.existsSync(boxPath)) {
    try {
      box = validateBoxInfo(parseLooseJson(fs.readFileSync(boxPath, "utf-8")));
    } catch (e) {
      warnings.push(`本地 box.json 无效已忽略：${msg(e)}`);
    }
  }
  const wordsPath = workPath("boxzzyhs");
  if (fs.existsSync(wordsPath)) {
    try {
      authorWords = validateAuthorWords(parseLooseJson(fs.readFileSync(wordsPath, "utf-8")));
    } catch (e) {
      warnings.push(`本地 boxzzyhs.json 无效已忽略：${msg(e)}`);
    }
  }
  let lastSync = null;
  try {
    if (fs.existsSync(lastSyncPath())) {
      const parsed = JSON.parse(fs.readFileSync(lastSyncPath(), "utf-8"));
      const v = parsed["lastSync"];
      if (typeof v === "number") lastSync = v;
    }
  } catch {
  }
  const s = {
    data,
    box,
    authorWords,
    offline: true,
    // 磁盘数据视作离线态，远程刷新成功后置 false
    lastSync,
    warnings
  };
  state = s;
  return s;
}
function getMemory() {
  return state ?? loadFromDisk();
}
function getSnapshot() {
  const s = getMemory();
  return {
    data: s.data,
    box: s.box,
    authorWords: s.authorWords,
    offline: s.offline,
    lastSync: s.lastSync,
    warnings: [...s.warnings]
  };
}
async function refreshRemote(force = false) {
  const s = getMemory();
  if (!force && !shouldRefetch(s.lastSync, Date.now())) return getSnapshot();
  ensureDirs();
  const results = await Promise.allSettled([
    fetchJson(REMOTE_URLS.resources),
    fetchJson(REMOTE_URLS.box),
    fetchJson(REMOTE_URLS.boxzzyhs)
  ]);
  const warnings = [];
  let okCount = 0;
  const resourcesResult = results[0];
  if (resourcesResult && resourcesResult.status === "fulfilled") {
    try {
      const clean = validateResources(resourcesResult.value);
      s.data = {
        resources: clean.valid,
        version_logs: validateVersionLogs(resourcesResult.value),
        announcement: validateAnnouncement(resourcesResult.value)
      };
      warnings.push(...clean.errors);
      persistWork("resources", JSON.stringify(resourcesResult.value, null, 2));
      okCount++;
    } catch (e) {
      warnings.push(`resources.json 解析失败（保留本地数据）：${msg(e)}`);
    }
  } else if (resourcesResult && resourcesResult.status === "rejected") {
    warnings.push(`resources.json 获取失败：${msg(resourcesResult.reason)}`);
  }
  const boxResult = results[1];
  if (boxResult && boxResult.status === "fulfilled") {
    try {
      const info = validateBoxInfo(boxResult.value);
      if (!info) throw new DataFileError("缺少 app_name");
      s.box = info;
      persistWork("box", JSON.stringify(boxResult.value, null, 2));
      okCount++;
    } catch (e) {
      warnings.push(`box.json 解析失败（保留本地数据）：${msg(e)}`);
    }
  } else if (boxResult && boxResult.status === "rejected") {
    warnings.push(`box.json 获取失败：${msg(boxResult.reason)}`);
  }
  const wordsResult = results[2];
  if (wordsResult && wordsResult.status === "fulfilled") {
    try {
      const w = validateAuthorWords(wordsResult.value);
      if (!w) throw new DataFileError("缺少 content");
      s.authorWords = w;
      persistWork("boxzzyhs", JSON.stringify(wordsResult.value, null, 2));
      okCount++;
    } catch (e) {
      warnings.push(`boxzzyhs.json 解析失败（保留本地数据）：${msg(e)}`);
    }
  } else if (wordsResult && wordsResult.status === "rejected") {
    warnings.push(`boxzzyhs.json 获取失败：${msg(wordsResult.reason)}`);
  }
  s.warnings = warnings;
  s.offline = okCount === 0;
  if (okCount === 3) {
    s.lastSync = Date.now();
    atomicWrite(lastSyncPath(), JSON.stringify({ lastSync: s.lastSync }, null, 2));
  }
  return getSnapshot();
}
async function restoreFromFile(target) {
  const s = getMemory();
  const picked = await electron.dialog.showOpenDialog({
    title: target === "resources" ? "选择 resources.json 以恢复资源数据" : "选择 box.json 以恢复应用信息",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (picked.canceled || picked.filePaths.length === 0) return false;
  const file = picked.filePaths[0];
  if (!file) return false;
  try {
    const raw = parseLooseJson(fs.readFileSync(file, "utf-8"));
    if (target === "resources") {
      const clean = validateResources(raw);
      backupWork("resources");
      atomicWrite(workPath("resources"), JSON.stringify(raw, null, 2));
      s.data = {
        resources: clean.valid,
        version_logs: validateVersionLogs(raw),
        announcement: validateAnnouncement(raw)
      };
      s.warnings = [...clean.errors];
      s.offline = true;
    } else {
      const info = validateBoxInfo(raw);
      if (!info) throw new DataFileError("box.json 结构错误：缺少 app_name");
      backupWork("box");
      atomicWrite(workPath("box"), JSON.stringify(raw, null, 2));
      s.box = info;
      s.warnings = [];
    }
    return true;
  } catch (e) {
    s.warnings = [`恢复失败：${msg(e)}`];
    return false;
  }
}
const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
function sanitizeFilename(name) {
  let cleaned = name.replace(ILLEGAL_CHARS, "_");
  cleaned = cleaned.replace(/^[\s.]+/, "").replace(/[\s.]+$/, "");
  if (cleaned === "" || /^_+$/.test(cleaned)) cleaned = "download";
  const stem = cleaned.split(".")[0] ?? "";
  if (RESERVED_NAMES.test(stem)) cleaned = `_${cleaned}`;
  return cleaned;
}
const MAX_TRIES = 9999;
function pickAvailablePath(exists, dir, filename) {
  const target = path.join(dir, filename);
  if (!exists(target)) return target;
  const dotIdx = filename.startsWith(".") ? -1 : filename.lastIndexOf(".");
  const stem = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : "";
  for (let i = 1; i <= MAX_TRIES; i++) {
    const candidate = path.join(dir, `${stem}(${i})${ext}`);
    if (!exists(candidate)) return candidate;
  }
  return path.join(dir, `${stem}-${Date.now()}${ext}`);
}
const RESET_STORAGES = [
  "cookies",
  "localstorage",
  "cachestorage",
  "indexdb",
  "serviceworkers",
  "shadercache",
  "websql",
  "filesystem"
];
function isHttpUrl(url) {
  return /^https?:/i.test(url);
}
const BROWSER_PARTITION = "pbox-mem";
function getBrowserSession() {
  return electron.session.fromPartition(BROWSER_PARTITION);
}
async function resetBrowserSession() {
  await getBrowserSession().clearStorageData({ storages: [...RESET_STORAGES] });
}
const active = /* @__PURE__ */ new Map();
let counter = 0;
function makeTask(rec) {
  const total = rec.total > 0 ? rec.total : 0;
  const percent = total > 0 ? Math.min(100, rec.received / total * 100) : 0;
  return {
    id: rec.id,
    filename: rec.filename,
    path: rec.path,
    received: rec.received,
    total,
    percent,
    bytesPerSecond: rec.bytesPerSecond,
    source: "browser"
  };
}
function broadcast$1(payload) {
  getMainWindow()?.webContents.send("download:event", payload);
}
function attachDownloadHandling(target = getBrowserSession()) {
  target.on("will-download", (_event, item) => {
    const cfg = getConfig();
    try {
      fs.mkdirSync(cfg.downloadDir, { recursive: true });
    } catch {
    }
    const filename = sanitizeFilename(item.getFilename());
    const savePath = pickAvailablePath(fs.existsSync, cfg.downloadDir, filename);
    item.setSavePath(savePath);
    counter += 1;
    const id = `dl-${counter}`;
    const rec = {
      id,
      filename,
      path: savePath,
      received: 0,
      total: item.getTotalBytes(),
      bytesPerSecond: 0,
      lastReceived: 0,
      lastTime: Date.now()
    };
    active.set(id, rec);
    broadcast$1({ type: "started", task: makeTask(rec) });
    item.on("updated", () => {
      const cur = active.get(id);
      if (!cur) return;
      cur.received = item.getReceivedBytes();
      cur.total = item.getTotalBytes();
      const now = Date.now();
      const dt = (now - cur.lastTime) / 1e3;
      if (dt >= 0.5) {
        cur.bytesPerSecond = Math.round((cur.received - cur.lastReceived) / dt);
        cur.lastTime = now;
        cur.lastReceived = cur.received;
      }
      broadcast$1({ type: "progress", task: makeTask(cur) });
    });
    item.once("done", (_e, state2) => {
      active.delete(id);
      broadcast$1({
        type: "done",
        id,
        state: state2 === "completed" ? "completed" : state2 === "cancelled" ? "cancelled" : "interrupted"
      });
    });
  });
}
function hasActiveDownloads() {
  return active.size > 0;
}
const VERSION_RE = /^\s*v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?\s*$/;
function parseVersion(input) {
  const m = VERSION_RE.exec(input);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    // noUncheckedIndexedAccess：正则捕获组存在性由 VERSION_RE 保证
    pre: m[4] ? m[4].split(".") : []
  };
}
function comparePre(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i];
    const y = b[i];
    if (x === void 0) return -1;
    if (y === void 0) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d < 0 ? -1 : 1;
    } else if (nx !== ny) {
      return nx ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return comparePre(pa.pre, pb.pre);
}
function isNewerVersion(candidate, current) {
  return compareVersions(candidate, current) > 0;
}
function parseReleaseJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const rec = data;
  const tagName = rec["tag_name"];
  if (typeof tagName !== "string" || tagName.trim() === "") return null;
  return {
    tagName,
    htmlUrl: typeof rec["html_url"] === "string" ? rec["html_url"] : void 0,
    notes: typeof rec["body"] === "string" ? rec["body"] : void 0
  };
}
const RELEASE_API = "https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/latest";
const FETCH_TIMEOUT_MS = 1e4;
const CHECK_TTL_MS = 10 * 60 * 1e3;
let lastResult = null;
let lastCheckAt = 0;
function broadcast(e) {
  getMainWindow()?.webContents.send("update:event", e);
}
function initUpdater() {
  electronUpdater.autoUpdater.autoDownload = false;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
  electronUpdater.autoUpdater.on(
    "update-available",
    (info) => broadcast({ type: "available", version: info?.version ?? "" })
  );
  electronUpdater.autoUpdater.on("update-not-available", () => broadcast({ type: "not-available" }));
  electronUpdater.autoUpdater.on("download-progress", (progress) => {
    broadcast({ type: "progress", percent: progress.percent });
    getMainWindow()?.webContents.send("download:event", {
      type: "progress",
      task: {
        id: "app-update",
        filename: "Pointers-BOX 更新包",
        path: "",
        received: progress.transferred,
        total: progress.total,
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        source: "update"
      }
    });
  });
  electronUpdater.autoUpdater.on("update-downloaded", () => broadcast({ type: "downloaded" }));
  electronUpdater.autoUpdater.on("error", (e) => broadcast({ type: "error", message: e?.message ?? String(e) }));
  if (electron.app.isPackaged) {
    setTimeout(() => {
      void checkUpdate(false);
    }, 3e4).unref?.();
  }
}
async function checkUpdate(force = true) {
  const current = electron.app.getVersion();
  if (!force && lastResult && Date.now() - lastCheckAt < CHECK_TTL_MS) {
    return lastResult;
  }
  try {
    const { status, text } = await requestText(RELEASE_API, FETCH_TIMEOUT_MS, {
      "User-Agent": "Pointers-BOX-Updater",
      Accept: "application/vnd.github+json"
    });
    if (status === 403) throw new Error("GitHub API 限流，请稍后再试");
    if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
    const release = parseReleaseJson(text);
    if (!release) throw new Error("Release 数据缺少 tag_name");
    const result = {
      current,
      latest: release.tagName,
      hasUpdate: isNewerVersion(release.tagName, current),
      releaseUrl: release.htmlUrl,
      releaseNotes: release.notes?.slice(0, 600)
    };
    lastResult = result;
    lastCheckAt = Date.now();
    return result;
  } catch (e) {
    return {
      current,
      latest: null,
      hasUpdate: false,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
async function downloadUpdate() {
  if (!electron.app.isPackaged) {
    throw new Error("开发模式下不支持自动下载更新，请在打包安装版中使用");
  }
  const res = await electronUpdater.autoUpdater.checkForUpdates();
  const remoteVersion = res?.updateInfo?.version;
  if (remoteVersion && remoteVersion !== electron.app.getVersion()) {
    await electronUpdater.autoUpdater.downloadUpdate();
  } else {
    broadcast({ type: "not-available" });
  }
}
function installUpdate() {
  if (!electron.app.isPackaged) return;
  electronUpdater.autoUpdater.quitAndInstall(false, true);
}
function registerIpcHandlers() {
  electron.ipcMain.handle("data:snapshot", () => getSnapshot());
  electron.ipcMain.handle("data:refresh", (_e, force) => refreshRemote(Boolean(force)));
  electron.ipcMain.handle(
    "data:restore",
    (_e, target) => restoreFromFile(
      target === "box" ? "box" : "resources"
    )
  );
  electron.ipcMain.handle("config:get", () => getConfig());
  electron.ipcMain.handle(
    "config:set",
    (_e, patch) => setConfig(typeof patch === "object" && patch !== null ? patch : {})
  );
  electron.ipcMain.handle("browser:resetSession", () => resetBrowserSession());
  electron.ipcMain.handle("downloads:chooseDir", async () => {
    if (hasActiveDownloads()) return null;
    const picked = await electron.dialog.showOpenDialog({
      title: "选择下载目录",
      properties: ["openDirectory", "createDirectory"]
    });
    if (picked.canceled || picked.filePaths.length === 0) return null;
    const dir = picked.filePaths[0] ?? "";
    if (!dir) return null;
    setConfig({ downloadDir: dir });
    return dir;
  });
  electron.ipcMain.handle("downloads:hasActive", () => hasActiveDownloads());
  electron.ipcMain.handle("shell:openPath", async (_e, path2) => {
    if (typeof path2 !== "string" || path2.trim() === "") return false;
    try {
      if (!fs.existsSync(path2)) fs.mkdirSync(path2, { recursive: true });
    } catch {
    }
    const err = await electron.shell.openPath(path2);
    return err === "";
  });
  electron.ipcMain.handle("update:check", () => checkUpdate(true));
  electron.ipcMain.handle("update:download", () => downloadUpdate());
  electron.ipcMain.handle("update:install", () => {
    installUpdate();
    return true;
  });
}
function attachWebviewPolicies() {
  electron.app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() !== "webview") return;
    contents.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url)) void contents.loadURL(url);
      return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => {
      if (!isHttpUrl(url)) event.preventDefault();
    });
    contents.on("will-attach-webview", (_event2, webPreferences, params) => {
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      if (!/^pbox-mem$/.test(params.partition ?? "")) {
        params.partition = "pbox-mem";
      }
    });
  });
  electron.app.on("will-quit", () => {
    try {
      void electron.session.fromPartition("pbox-mem").clearStorageData();
    } catch {
    }
  });
}
attachWebviewPolicies();
const gotLock = electron.app.requestSingleInstanceLock();
if (!gotLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  void electron.app.whenReady().then(() => {
    void resetBrowserSession();
    attachDownloadHandling();
    initUpdater();
    registerIpcHandlers();
    createSplashWindow();
    setTimeout(closeSplash, 8e3);
    createMainWindow();
    createTray();
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
  electron.app.on("window-all-closed", () => {
  });
  electron.app.on("before-quit", () => {
    markQuitting();
  });
}
