import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  VStack
} from '@chakra-ui/react'
import {
  FiArrowLeft,
  FiArrowRight,
  FiGlobe,
  FiHome,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX
} from 'react-icons/fi'
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  DEFAULT_START_URL,
  normalizeAddressInput
} from '../../../shared/browser'
import type {
  PBoxWebview,
  WebviewFailLoadEvent,
  WebviewNavigateEvent
} from '../types/webview'
import { useBrowserStore, shouldSleepTab } from '../store/browserStore'
import { useUiStore } from '../store/uiStore'
import { useDownloadStore } from '../store/downloadStore'
import { backend } from '../platform'
import EmptyState from '../components/EmptyState'
import AndroidBrowserPage from './AndroidBrowserPage'

// 内置浏览器（PRD 4.2）：按平台分发——桌面用 webview，安卓用原生浏览器窗口
export default function BrowserPage() {
  const platform = useUiStore((s) => s.platform)
  return platform === 'android' ? <AndroidBrowserPage /> : <ElectronBrowserPage />
}

// 桌面多标签浏览器（v2.0.0）：新建/关闭/拖拽排序；全部 webview 常驻挂载保留各标签会话
// v2.1.0：后台标签闲置休眠（默认 5 分钟，设置页可调）——超时标签卸载 webview 释放渲染进程
function ElectronBrowserPage() {
  const tabs = useBrowserStore((s) => s.tabs)
  const activeId = useBrowserStore((s) => s.activeId)
  const newTab = useBrowserStore((s) => s.newTab)
  const closeTab = useBrowserStore((s) => s.closeTab)
  const setActive = useBrowserStore((s) => s.setActive)
  const updateTab = useBrowserStore((s) => s.updateTab)
  const reorderTabs = useBrowserStore((s) => s.reorderTabs)
  const resetAllTabs = useBrowserStore((s) => s.resetAllTabs)
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  // 休眠判定依据：设置里的闲置分钟数（0 = 永不）
  const sleepMinutes = useDownloadStore((s) => s.config?.tabSleepMinutes ?? 5)

  // 每个 webview 的 ref 与首次挂载 URL（src 只在挂载时绑定，后续导航走 loadURL）
  const webviewRefs = useRef(new Map<string, PBoxWebview>())
  const initialUrls = useRef(new Map<string, string>())
  const lastUrls = useRef(new Map<string, string>())
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const dragIdx = useRef(0)

  const [address, setAddress] = useState(activeTab?.url ?? DEFAULT_START_URL)
  const [loading, setLoading] = useState(false)
  const [canBack, setCanBack] = useState(false)
  const [canForward, setCanForward] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  // 已发出 dom-ready 的 webview（此后才允许调用其方法，否则渲染进程抛错）
  const [readyTabs, setReadyTabs] = useState<Set<string>>(() => new Set())
  // v2.1.0：当前应挂载 webview 的标签（活动标签 + 未休眠的后台标签）
  const [awakeIds, setAwakeIds] = useState<Set<string>>(() => new Set(tabs.map((t) => t.id)))

  // 休眠 tick（60s）：把超时后台标签移出挂载集合（React 卸载 webview = 渲染进程销毁）
  // 切回（setActive）后 tab 不在此集合 → 重新挂载 → src 取 initialUrls 当前 URL 加载
  useEffect(() => {
    if (sleepMinutes <= 0) {
      setAwakeIds(new Set(useBrowserStore.getState().tabs.map((t) => t.id)))
      return
    }
    const tick = (): void => {
      const s = useBrowserStore.getState()
      const next = new Set<string>()
      for (const t of s.tabs) {
        if (!shouldSleepTab(t, s.activeId, sleepMinutes)) next.add(t.id)
      }
      setAwakeIds(next)
    }
    tick()
    const timer = window.setInterval(tick, 60_000)
    return () => window.clearInterval(timer)
  }, [sleepMinutes])

  // webview 卸载清理：休眠标签的 ready 状态与 initialUrls 记录一并清掉，
  // 唤醒重挂时 src 需取该标签【当前】URL（而非首次挂载时的旧值）
  useEffect(() => {
    const missing = tabs.filter((t) => !awakeIds.has(t.id))
    if (missing.length === 0) return
    const ids = new Set(missing.map((t) => t.id))
    setReadyTabs((prev) => {
      const next = new Set([...prev].filter((x) => !ids.has(x)))
      return next.size === prev.size ? prev : next
    })
    for (const t of missing) {
      initialUrls.current.set(t.id, t.url)
      webviewRefs.current.delete(t.id)
    }
  }, [awakeIds, tabs])

  // webview 事件绑定（ref 回调内幂等挂一次；处理器经 ref 读最新活动标签）
  const bindWebview = useCallback(
    (id: string) => (el: PBoxWebview | null): void => {
      if (!el) {
        webviewRefs.current.delete(id)
        return
      }
      webviewRefs.current.set(id, el)
      if (!initialUrls.current.has(id)) {
        const url = useBrowserStore.getState().tabs.find((t) => t.id === id)?.url
        initialUrls.current.set(id, url ?? DEFAULT_START_URL)
      }
      const wv = el as PBoxWebview & { __pboxBound?: boolean }
      if (wv.__pboxBound) return
      wv.__pboxBound = true
      const onNavigate = (e: WebviewNavigateEvent): void => {
        lastUrls.current.set(id, e.url)
        useBrowserStore.getState().updateTab(id, { url: e.url })
        if (activeIdRef.current === id) {
          setAddress(e.url)
          setError(null)
        }
      }
      const onStart = (): void => {
        if (activeIdRef.current === id) setLoading(true)
      }
      const onStop = (): void => {
        if (activeIdRef.current !== id) return
        setLoading(false)
        setCanBack(wv.canGoBack())
        setCanForward(wv.canGoForward())
      }
      const onFail = (e: WebviewFailLoadEvent): void => {
        if (activeIdRef.current === id && e.errorCode !== -3) {
          setError(`页面加载失败（${e.errorCode}）`)
        }
      }
      const onTitle = (e: { title: string }): void => {
        useBrowserStore.getState().updateTab(id, { title: e.title.trim() || '新标签页' })
      }
      const onReady = (): void => {
        setReadyTabs((prev) => new Set(prev).add(id))
        if (activeIdRef.current === id) {
          setCanBack(wv.canGoBack())
          setCanForward(wv.canGoForward())
        }
      }
      wv.addEventListener('dom-ready', onReady)
      wv.addEventListener('did-navigate', onNavigate)
      wv.addEventListener('did-navigate-in-page', onNavigate)
      wv.addEventListener('did-start-loading', onStart)
      wv.addEventListener('did-stop-loading', onStop)
      wv.addEventListener('did-fail-load', onFail)
      wv.addEventListener('page-title-updated', onTitle as never)
    },
    []
  )

  // 切换标签：地址栏与导航态跟随活动标签（仅在 webview 就绪后读取导航态）
  useEffect(() => {
    setAddress(activeTab?.url ?? DEFAULT_START_URL)
    setError(null)
    const wv = webviewRefs.current.get(activeId)
    if (wv && readyTabs.has(activeId)) {
      setCanBack(wv.canGoBack())
      setCanForward(wv.canGoForward())
    } else {
      setCanBack(false)
      setCanForward(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, readyTabs])

  // 外部跳转（领取）或程序化导航：活动标签 URL 变化时加载。
  // 未就绪的 webview 不调用 loadURL——挂载时 src 已指向新 URL，天然完成首次加载。
  useEffect(() => {
    const wv = webviewRefs.current.get(activeId)
    if (!wv || !activeTab || !readyTabs.has(activeId)) return
    const last = lastUrls.current.get(activeId)
    if (activeTab.url && activeTab.url !== last) {
      lastUrls.current.set(activeId, activeTab.url)
      void wv.loadURL(activeTab.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.url, activeId, readyTabs])

  const go = (raw: string): void => {
    const url = normalizeAddressInput(raw)
    if (!activeTab) return
    lastUrls.current.set(activeTab.id, url)
    setAddress(url)
    updateTab(activeTab.id, { url })
    void webviewRefs.current.get(activeTab.id)?.loadURL(url)
  }

  const doReset = async (): Promise<void> => {
    setConfirmReset(false)
    setResetting(true)
    try {
      await backend.resetBrowserSession()
      webviewRefs.current.forEach((wv) => {
        try {
          wv.clearHistory()
        } catch {
          // 未就绪的 webview 无法清理，忽略
        }
      })
      lastUrls.current.clear()
      resetAllTabs()
    } finally {
      setResetting(false)
    }
  }

  return (
    <Box h="full" display="flex" flexDirection="column">
      {/* 标签条（v2.0.0：新建/关闭/拖拽排序） */}
      <Flex align="center" gap={1} px={2} pt={2} pb={1} overflowX="auto" sx={{ scrollbarWidth: 'none' }}>
        {tabs.map((t, i) => (
          <Flex
            key={t.id}
            draggable
            onDragStart={() => {
              dragIdx.current = i
            }}
            onDragOver={(e: DragEvent) => e.preventDefault()}
            onDrop={() => reorderTabs(dragIdx.current, i)}
            align="center"
            gap={2}
            px={3}
            py={1.5}
            minW="120px"
            maxW="190px"
            borderRadius="md"
            fontSize="xs"
            borderWidth="1px"
            bg={t.id === activeId ? 'panelstrong' : 'transparent'}
            color={t.id === activeId ? 'ptext' : 'ptextmuted'}
            borderColor={t.id === activeId ? 'pborder' : 'transparent'}
            cursor="pointer"
            onClick={() => setActive(t.id)}
            role="tab"
            aria-selected={t.id === activeId}
          >
            <Text noOfLines={1} flex="1" title={t.url}>
              {t.title}
            </Text>
            <Box
              as="button"
              aria-label={`关闭标签页：${t.title}`}
              p={0.5}
              borderRadius="sm"
              color="ptextmuted"
              _hover={{ bg: 'hoverbg', color: 'red.400' }}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                closeTab(t.id)
              }}
            >
              <FiX size={11} />
            </Box>
          </Flex>
        ))}
        <IconButton
          aria-label="新建标签页"
          icon={<FiPlus />}
          size="xs"
          variant="ghost"
          color="ptext"
          flexShrink={0}
          onClick={() => newTab()}
        />
      </Flex>

      {/* 导航控制栏（PRD 4.2：← → ⟳ 🏠 + 地址栏） */}
      <Flex
        as="form"
        gap={2}
        px={2}
        pb={2}
        bg="panel"
        borderBottomWidth="1px"
        borderColor="pborder"
        className="pbox-blur-bar"
        position="relative"
        zIndex={1}
        onSubmit={(e) => {
          e.preventDefault()
          go(address)
        }}
      >
        <HStack spacing={1}>
          <IconButton
            aria-label="后退"
            icon={<FiArrowLeft />}
            size="sm"
            variant="ghost"
            color="ptext"
            isDisabled={!canBack}
            onClick={() => webviewRefs.current.get(activeId)?.goBack()}
          />
          <IconButton
            aria-label="前进"
            icon={<FiArrowRight />}
            size="sm"
            variant="ghost"
            color="ptext"
            isDisabled={!canForward}
            onClick={() => webviewRefs.current.get(activeId)?.goForward()}
          />
          <IconButton
            aria-label="刷新"
            icon={<FiRefreshCw />}
            size="sm"
            variant="ghost"
            color="ptext"
            onClick={() => {
              setLoading(true)
              webviewRefs.current.get(activeId)?.reload()
            }}
          />
          <IconButton
            aria-label="重置（清除登录状态）"
            icon={<FiHome />}
            size="sm"
            variant="ghost"
            color="ptext"
            onClick={() => setConfirmReset(true)}
          />
        </HStack>
        <InputGroup size="sm" flex="1">
          <InputLeftElement pointerEvents="none">
            <FiSearch color="var(--pbox-accent)" />
          </InputLeftElement>
          <Input
            bg="pinput"
            borderColor="pborder"
            color="ptext"
            _placeholder={{ color: 'ptextmuted' }}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="输入网址，回车访问"
            spellCheck={false}
          />
        </InputGroup>
        <Button size="sm" colorScheme="brand" type="submit" isLoading={loading}>
          前往
        </Button>
      </Flex>

      {/* 加载进度指示 */}
      <Box h="2px" bg="pborder">
        <Box h="100%" w={loading ? '35%' : '0%'} bg="brand.500" transition="width .6s ease" />
      </Box>

      {/* WebView 多标签（活动标签 + 未休眠后台标签挂载；v2.1.0 休眠标签卸载释放内存） */}
      <Box flex="1" minH={0} position="relative" bg="white">
        {error ? (
          <EmptyState
            icon={<FiGlobe />}
            title="页面无法访问"
            description={error}
            action={
              <Button size="sm" variant="outline" onClick={() => go(address)}>
                重试
              </Button>
            }
          />
        ) : null}
        {tabs.map((t) =>
          awakeIds.has(t.id) ? (
            <webview
              key={t.id}
              ref={bindWebview(t.id)}
              src={initialUrls.current.get(t.id) ?? t.url}
              partition="pbox-mem"
              allowpopups={true}
              style={{
                display: t.id === activeId ? 'flex' : 'none',
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0
              }}
            />
          ) : null
        )}
      </Box>

      {/* 重置确认框（PRD 4.2：点 🏠 → 确认后清除登录状态） */}
      <AlertDialog
        isOpen={confirmReset}
        leastDestructiveRef={cancelRef}
        onClose={() => setConfirmReset(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg">重置浏览器会话</AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="start" spacing={1}>
                <Text>将清除浏览器的 Cookie、缓存与登录状态，所有标签回到起始页。</Text>
                <Text fontSize="sm" color="gray.500">
                  此操作不可撤销，确定继续吗？
                </Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} size="sm" onClick={() => setConfirmReset(false)}>
                取消
              </Button>
              <Button
                size="sm"
                colorScheme="red"
                ml={3}
                isLoading={resetting}
                onClick={() => void doReset()}
              >
                确认重置
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
