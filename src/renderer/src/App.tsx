import { Box, Flex, useToast } from '@chakra-ui/react'
import { useEffect, useRef } from 'react'
import type { Page } from '../../shared/routes'
import { castPage, currentPlatform, backend } from './platform'
import { useUiStore } from './store/uiStore'
import { useDataStore } from './store/dataStore'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
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

export default function App() {
  const page = useUiStore((s) => s.page)
  const toast = useToast()
  const shownWarnings = useRef('')

  // 平台探测 + 数据引导 + 托盘跳转监听
  useEffect(() => {
    useUiStore.getState().setPlatform(currentPlatform())
    void useDataStore.getState().bootstrap()
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
    <Flex h="100vh" direction="column" overflow="hidden">
      <Flex flex="1" minH={0}>
        <Sidebar />
        <Box flex="1" minW={0} overflowY="auto" bg="gray.50">
          {renderPage(page)}
        </Box>
      </Flex>
      <StatusBar />
    </Flex>
  )
}
