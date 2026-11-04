import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// PBOX_HARMONY_BUILD=1：鸿蒙 ArkWeb 专用渲染层打包——
// resource://rawfile 页面 origin 为 null，外部 script（无论 module 还是普通）
// 都会被 CORS 拦截，必须把 JS/CSS 全部内联进 index.html。
const isHarmony = process.env.PBOX_HARMONY_BUILD === '1'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), ...(isHarmony ? [viteSingleFile()] : [])],
    build: isHarmony
      ? {
          rollupOptions: {
            output: {
              format: 'iife',
              inlineDynamicImports: true,
              entryFileNames: 'assets/index.js',
              chunkFileNames: 'assets/[name].js'
            }
          }
        }
      : undefined
  }
})
