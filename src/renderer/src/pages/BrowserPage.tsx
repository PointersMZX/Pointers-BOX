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
  FiRefreshCw,
  FiSearch
} from 'react-icons/fi'
import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_START_URL,
  normalizeAddressInput
} from '../../../shared/browser'
import type {
  PBoxWebview,
  WebviewFailLoadEvent,
  WebviewNavigateEvent
} from '../types/webview'
import { useBrowserStore } from '../store/browserStore'
import { backend } from '../platform'
import EmptyState from '../components/EmptyState'

// 内置浏览器（PRD 4.2）：WebView + 导航控制栏 + 地址栏 + 会话重置
export default function BrowserPage() {
  const storeUrl = useBrowserStore((s) => s.url)
  const setStoreUrl = useBrowserStore((s) => s.navigateTo)
  const webviewRef = useRef<PBoxWebview | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  const [initialSrc] = useState(storeUrl)
  const [address, setAddress] = useState(storeUrl)
  const [loading, setLoading] = useState(false)
  const [canBack, setCanBack] = useState(false)
  const [canForward, setCanForward] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  // webview 事件绑定
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const onNavigate = (e: WebviewNavigateEvent): void => {
      setAddress(e.url)
      setStoreUrl(e.url)
      setError(null)
    }
    const onStart = (): void => setLoading(true)
    const onStop = (): void => {
      setLoading(false)
      setCanBack(wv.canGoBack())
      setCanForward(wv.canGoForward())
    }
    const onFail = (e: WebviewFailLoadEvent): void => {
      if (e.errorCode !== -3) setError(`页面加载失败（${e.errorCode}）`)
    }
    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onNavigate)
    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)
    wv.addEventListener('did-fail-load', onFail)
    return () => {
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onNavigate)
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
      wv.removeEventListener('did-fail-load', onFail)
    }
  }, [])

  // 外部"领取"跳转：加载目标链接
  useEffect(() => {
    const wv = webviewRef.current
    if (wv && storeUrl && storeUrl !== address) {
      void wv.loadURL(storeUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeUrl])

  const go = (raw: string): void => {
    const url = normalizeAddressInput(raw)
    setAddress(url)
    setStoreUrl(url)
    void webviewRef.current?.loadURL(url)
  }

  const doReset = async (): Promise<void> => {
    setConfirmReset(false)
    setResetting(true)
    try {
      await backend.resetBrowserSession()
      webviewRef.current?.clearHistory()
      setAddress(DEFAULT_START_URL)
      setStoreUrl(DEFAULT_START_URL)
      void webviewRef.current?.loadURL(DEFAULT_START_URL)
    } finally {
      setResetting(false)
    }
  }

  return (
    <Box h="full" display="flex" flexDirection="column">
      {/* 导航控制栏（PRD 4.2：← → ⟳ 🏠 + 地址栏） */}
      <Flex
        as="form"
        gap={2}
        p={2}
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
            onClick={() => webviewRef.current?.goBack()}
          />
          <IconButton
            aria-label="前进"
            icon={<FiArrowRight />}
            size="sm"
            variant="ghost"
            color="ptext"
            isDisabled={!canForward}
            onClick={() => webviewRef.current?.goForward()}
          />
          <IconButton
            aria-label="刷新"
            icon={<FiRefreshCw />}
            size="sm"
            variant="ghost"
            color="ptext"
            onClick={() => {
              setLoading(true)
              webviewRef.current?.reload()
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

      {/* WebView（内存分区：进程退出自动清除登录状态） */}
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
        <webview
          ref={webviewRef}
          src={initialSrc}
          partition="pbox-mem"
          allowpopups={false}
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
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
                <Text>将清除浏览器的 Cookie、缓存与登录状态，并回到起始页。</Text>
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
