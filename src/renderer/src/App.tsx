import { ChakraProvider, useColorMode, useToast, Box, Flex } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Page } from '../../shared/routes'
import { backend, castPage, currentPlatform } from './platform'
import { useUiStore } from './store/uiStore'
import { useDataStore } from './store/dataStore'
import { useDownloadStore } from './store/downloadStore'
import { useThemeStore } from './store/themeStore'
import { useFavoritesStore } from './store/favoritesStore'
import { buildTheme } from './theme/buildTheme'
import { PAGE_ENTER, PAGE_ENTER_ACTIVE } from './theme/motion'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import StatusBar from './components/StatusBar'
import UpdateChannelModal from './components/UpdateChannelModal'
import AnnouncementModal from './components/AnnouncementModal'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import LinksPage from './pages/LinksPage'
import BrowserPage from './pages/BrowserPage'
import DownloadsPage from './pages/DownloadsPage'
import SettingsPage from './pages/SettingsPage'

function renderPage(page: Page) {
  switch (page) {
    case 'home':
      return <HomePage />
    case 'library':
      return <LibraryPage />
    case 'links':
      return <LinksPage />
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
  const isAndroid = useUiStore((s) => s.platform) === 'android'
  const toast = useToast()
  const shownWarnings = useRef('')
  const shellRef = useRef<HTMLDivElement>(null)
  const { setColorMode } = useColorMode()
  // v2.1.0：首次启动（配置中无更新渠道）弹必选弹窗，选完永不再弹
  const [needChannelChoice, setNeedChannelChoice] = useState(false)
  // v2.3.0：平台公告启动弹窗——公告数据首次到达即弹一次（同一会话内关闭后不重弹）；
  // 与首启渠道弹窗互斥：渠道未选定前不弹，选完若仍有未展示公告则补弹
  const [announceOpen, setAnnounceOpen] = useState(false)
  const announceShown = useRef(false)

  // 主题切换 → 内置组件明暗模式（v2.1.0：移除弹跳动画，纯切换）
  useEffect(() => {
    setColorMode(themeKey === 'white' ? 'light' : 'dark')
  }, [themeKey, setColorMode])

  // 平台探测 + 数据引导 + 托盘跳转监听 + 主题配置加载 + 收藏加载 + 首启渠道询问
  useEffect(() => {
    useUiStore.getState().setPlatform(currentPlatform())
    void useDataStore.getState().bootstrap()
    void useFavoritesStore.getState().bootstrap()
    void backend
      .getConfig()
      .then((cfg) => {
        useThemeStore.getState().applyLocal(cfg.theme, cfg.accent)
        if (!cfg.updateChannel) setNeedChannelChoice(true)
      })
      .catch(() => {})
    const off = backend.onNavigate((p) => {
      const target = castPage(p)
      if (target) useUiStore.getState().setPage(target)
    })
    return () => off()
  }, [])

  // v2.1.0：窗口隐藏到托盘时暂停背景光斑动画（document.visibilitychange 在 Electron 窗口 hide 时触发）
  useEffect(() => {
    const onVisibility = (): void => {
      document.body.classList.toggle('pbox-bg-paused', document.hidden)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
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

  // v2.3.0：公告启动弹窗（数据首达即弹一次；首启渠道弹窗未处理完前挂起，选完渠道后 effect 自动补弹）
  const announcement = useDataStore((s) => s.announcement)
  useEffect(() => {
    if (!announcement || announceShown.current || needChannelChoice) return
    announceShown.current = true
    setAnnounceOpen(true)
  }, [announcement, needChannelChoice])

  return (
    <Box ref={shellRef} h="100vh" bg="appbg" position="relative" zIndex={1}>
      <Flex h="full" direction="column" overflow="hidden">
        <Flex flex="1" minH={0}>
          {/* v2.0.0：Android 手机端以底部导航栏替代侧边栏（竖屏/横屏均适配） */}
          {!isAndroid && <Sidebar />}
          <Box flex="1" minW={0} overflowY="auto" paddingBottom={isAndroid ? '72px' : 0}>
            {/* v2.3.0：页面切换柔和淡入（仅入场，无过冲；key 触发重挂载动画） */}
            <motion.div
              key={page}
              initial={PAGE_ENTER}
              animate={PAGE_ENTER_ACTIVE}
              style={{ height: '100%' }}
            >
              {renderPage(page)}
            </motion.div>
          </Box>
        </Flex>
        {/* 安卓端隐藏状态栏（底栏已占据底部空间） */}
        {!isAndroid && <StatusBar />}
      </Flex>
      {isAndroid && <BottomNav />}
      {needChannelChoice && <UpdateChannelModal onChosen={() => setNeedChannelChoice(false)} />}
      <AnnouncementModal
        announcement={announcement}
        open={announceOpen}
        onClose={() => setAnnounceOpen(false)}
      />
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
      <ThemedShell />
    </ChakraProvider>
  )
}
