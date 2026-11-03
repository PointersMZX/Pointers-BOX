import { webview } from '@kit.ArkWeb';

/**
 * Pointers-BOX 鸿蒙壳：ArkWeb 加载打包进 rawfile 的渲染层产物（out/renderer）。
 * javaScriptOnDocumentStart 在页面脚本执行前注入平台标识——渲染层
 * currentPlatform() 据此选择 harmony 后端（纯 Web 模式，见 platform/harmony.ts）。
 * ScriptItem 为 ArkUI 组件层全局类型（web.d.ts），无需从 Kit 导入。
 */
@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
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
