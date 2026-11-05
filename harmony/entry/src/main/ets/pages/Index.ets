import { webview } from '@kit.ArkWeb';
import { http } from '@kit.NetworkKit';

/**
 * Pointers-BOX 鸿蒙壳：ArkWeb 加载打包进 rawfile 的渲染层产物（out/renderer）。
 * javaScriptOnDocumentStart 在页面脚本执行前注入平台标识——渲染层
 * currentPlatform() 据此选择 harmony 后端（纯 Web 模式，见 platform/harmony.ts）。
 * javaScriptProxy 暴露原生数据桥：resource:// 页面 origin 为 null，渲染层直接
 * fetch 远程数据会被 CORS 拦截；原生 http（NetworkKit）不受浏览器同源策略限制。
 * ScriptItem 为 ArkUI 组件层全局类型（web.d.ts），无需从 Kit 导入。
 */

/** 原生数据桥：渲染层跨域数据请求经由原生 http 完成（无 CORS 限制）。 */
class PboxBridge {
  private controller: webview.WebviewController;

  constructor(controller: webview.WebviewController) {
    this.controller = controller;
  }

  // proxy 方法返回 Promise（API 12+ 支持），JS 侧直接 await
  // headersJson：可选请求头 JSON 字符串（如 GitHub API 的 Accept/UA）
  async fetchText(url: string, headersJson: string): Promise<string> {
    const client = http.createHttp();
    let options: http.HttpRequestOptions = {
      method: http.RequestMethod.GET,
      readTimeout: 15000,
      connectTimeout: 15000
    } as http.HttpRequestOptions;
    if (headersJson && headersJson.length > 0) {
      try {
        const parsed: Record<string, string> = JSON.parse(headersJson) as Record<string, string>;
        if (Object.keys(parsed).length > 0) {
          options.header = parsed;
        }
      } catch (err) {
        // 头解析失败按无自定义头处理
      }
    }
    try {
      const res: http.HttpResponse = await client.request(url, options);
      if (res.responseCode < 200 || res.responseCode >= 300) {
        throw new Error(`HTTP ${res.responseCode}`);
      }
      return typeof res.result === 'string' ? res.result : '';
    } finally {
      client.destroy();
    }
  }
}

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  private bridge: PboxBridge = new PboxBridge(this.controller);
  @State injectScript: ScriptItem[] = [
    {
      script: 'window.__pboxHarmony = true;',
      // scriptRules：匹配所有页面（空规则数组 = 全局注入）
      scriptRules: ['*']
    }
  ];

  build() {
    Column() {
      Web({ src: $rawfile('www/index.html'), controller: this.controller })
        .javaScriptAccess(true)
        .javaScriptOnDocumentStart(this.injectScript)
        .javaScriptProxy({
          object: this.bridge,
          name: '__pboxNative',
          methodList: ['fetchText'],
          controller: this.controller
        })
        .domStorageAccess(true)
        .databaseAccess(true)
        .fileAccess(true)
        .onlineImageAccess(true)
        .zoomAccess(false)
        .width('100%')
        .height('100%')
        .backgroundColor('#0d0817')
    }
    .width('100%')
    .height('100%')
  }
}
