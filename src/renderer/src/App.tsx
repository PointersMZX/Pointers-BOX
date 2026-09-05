import { ChakraProvider, useColorMode, useToast, Box, Flex } from '@chakra-ui/react'
import { useEffect, useRef } from 'react'
import type { Page } from '../../shared/routes'
import { backend, castPage, currentPlatform } from './platform'
import { useUiStore } from './store/uiStore'
import { useDataStore } from './store/dataStore'
import { useDownloadStore } from './store/downloadStore'
import { useThemeStore } from './store/themeStore'
import { buildTheme } from './theme/buildTheme'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import RippleLayer from './components/RippleLayer'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import BrowserPage from './pages/BrowserPage'
import DownloadsPage from './pages/DownloadsPage'
import SettingsPage from './pages/SettingsPage'

function renderPage(page: Page) {
  switch (page) {
    case 'home':
      return <HomePage />
    case 'library':
      return <LibraryPage />
    case 'browser':
      return <BrowserPage />
    case 'downloads':
      return <DownloadsPage />
    case 'settings':
      return <SettingsPage />
  }
}

// 液态玻璃背景：三团缓慢漂移的模糊色斑（波浪氛围，纯装饰）
function GlassBlobs() {
  return (
    <>
      <Box className="pbox-blob b1" aria-hidden />
      <Box className="pbox-blob b2" aria-hidden />
      <Box className="pbox-blob b3" aria-hidden />
    </>
  )
}

function ThemedShell() {
  const page = useUiStore((s) => s.page)
  const themeKey = useThemeStore((s) => s.themeKey)
  const accent = useThemeStore((s) => s.accent)
  const toast = useToast()
  const shownWarnings = useRef('')
  const shellRef = useRef<HTMLDivElement>(null)
  const { setColorMode } = useColorMode()

  // 主题切换 → 内置组件明暗模式 + 弹跳动画（纯外观，不重挂载、不重置任何页面状态）
  useEffect(() => {
    setColorMode(themeKey === 'white' ? 'light' : 'dark')
    // 弹跳 + 回弹形变（Web Animations API，不改动布局与状态）
    shellRef.current?.animate(
      [
        { transform: 'scale(0.96) translateY(10px)', opacity: 0.55 },
        { transform: 'scale(1.02) translateY(-3px)', opacity: 1 },
        { transform: 'scale(0.998) translateY(1px)' },
        { transform: 'none' }
      ],
      { duration: 560, easing: 'cubic-bezier(.34,1.56,.64,1)' }
    )
  }, [themeKey, accent, setColorMode])

  // 平台探测 + 数据引导 + 托盘跳转监听 + 主题配置加载
  useEffect(() => {
    useUiStore.getState().setPlatform(currentPlatform())
    void useDataStore.getState().bootstrap()
    void backend
      .getConfig()
      .then((cfg) => useThemeStore.getState().applyLocal(cfg.theme, cfg.accent))
      .catch(() => {})
    const off = backend.onNavigate((p) => {
      const target = castPage(p)
      if (target) useUiStore.getState().setPage(target)
    })
    return () => off()
  }, [])

  // 全局快捷键 Ctrl+1/2/4/5（PRD 2.3）
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return
      const map: Record<string, Page> = {
        Digit1: 'home',
        Numpad1: 'home',
        Digit2: 'library',
        Numpad2: 'library',
        Digit4: 'downloads',
        Numpad4: 'downloads',
        Digit5: 'settings',
        Numpad5: 'settings'
      }
      const target = e.code ? map[e.code] : undefined
      if (target) {
        e.preventDefault()
        useUiStore.getState().setPage(target)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 下载事件全局订阅：无论当前处于哪个页面都不丢事件（修复"无法开始下载"）
  useEffect(() => {
    const off = backend.onDownloadEvent((e) => {
      const store = useDownloadStore.getState()
      if (e.type === 'done') {
        const task = store.tasks.find((t) => t.id === e.id)
        store.applyEvent(e)
        if (e.state === 'completed') {
          toast({
            title: `下载完成：${task?.filename ?? ''}`.trim(),
            status: 'success',
            duration: 2500,
            position: 'top',
            isClosable: true
          })
        } else if (e.state === 'cancelled') {
          // 用户主动取消：轻提示（半成品文件已在主进程清理）
          toast({
            title: `已取消下载：${task?.filename ?? ''}`.trim(),
            status: 'info',
            duration: 2000,
            position: 'top'
          })
        } else {
          toast({
            title: `下载失败：${task?.filename ?? ''}（请检查下载目录权限）`.trim(),
            status: 'error',
            duration: 5000,
            position: 'top',
            isClosable: true
          })
        }
        return
      }
      store.applyEvent(e)
    })
    return () => off()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 数据告警提示（PRD 7.6：解析失败弹出错误提示）
  useEffect(() => {
    const warnings = useDataStore.getState().warnings
    const key = warnings.join('|')
    if (warnings.length > 0 && key !== shownWarnings.current) {
      shownWarnings.current = key
      for (const w of warnings.slice(0, 3)) {
        toast({ title: w, status: 'warning', duration: 5000, isClosable: true, position: 'top' })
      }
    }
  })

  return (
    <Box ref={shellRef} h="100vh" bg="appbg" position="relative" zIndex={1}>
      <Flex h="full" direction="column" overflow="hidden">
        <Flex flex="1" minH={0}>
          <Sidebar />
          <Box flex="1" minW={0} overflowY="auto">
            {renderPage(page)}
          </Box>
        </Flex>
        <StatusBar />
      </Flex>
    </Box>
  )
}

// 主题 Provider 外壳：主题/强调色变化时重建主题对象（含全部外观令牌与动画）
export default function App() {
  const themeKey = useThemeStore((s) => s.themeKey)
  const accent = useThemeStore((s) => s.accent)

  return (
    <ChakraProvider theme={buildTheme(themeKey, accent)}>
      {themeKey === 'glass' && <GlassBlobs />}
      <RippleLayer />
      <ThemedShell />
    </ChakraProvider>
  )
}
