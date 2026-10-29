import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  VStack,
  useToast
} from '@chakra-ui/react'
import { FiExternalLink, FiGlobe, FiSearch, FiShield } from 'react-icons/fi'
import { useState } from 'react'
import { DEFAULT_START_URL, normalizeAddressInput } from '../../../shared/browser'
import { backend } from '../platform'
import { androidOpenExternal } from '../platform/capacitor'
import { useBrowserStore, getActiveTab } from '../store/browserStore'
import { useDownloadStore } from '../store/downloadStore'

/**
 * 安卓端浏览器（v2.5.0 恢复双模式）：
 * 内置（默认）= 原生 InAppBrowserActivity（WebView+下载接管+上传/弹窗/新窗口适配）；
 * 系统 = ACTION_VIEW。设置页可切换；重置会话清空内嵌浏览器的 Cookie。
 */
export default function AndroidBrowserPage() {
  const storeUrl = useBrowserStore((s) => getActiveTab(s).url)
  const setStoreUrl = useBrowserStore((s) => s.navigateTo)
  const config = useDownloadStore((s) => s.config)
  const toast = useToast()
  const builtin = (config?.androidBrowser ?? 'builtin') !== 'system'
  const [address, setAddress] = useState(storeUrl)
  const [opening, setOpening] = useState(false)

  const targetUrl = (mode: 'current' | 'start'): string =>
    normalizeAddressInput(mode === 'start' ? DEFAULT_START_URL : address)

  const openBuiltin = async (mode: 'current' | 'start'): Promise<void> => {
    const url = targetUrl(mode)
    if (mode === 'current') setAddress(url)
    setStoreUrl(url)
    setOpening(true)
    try {
      await backend.openClaim(url)
    } finally {
      setOpening(false)
    }
  }

  const openSystem = async (mode: 'current' | 'start'): Promise<void> => {
    const url = targetUrl(mode)
    if (mode === 'current') setAddress(url)
    setStoreUrl(url)
    setOpening(true)
    await androidOpenExternal(url).finally(() => setOpening(false))
  }

  const resetSession = async (): Promise<void> => {
    await backend.resetBrowserSession()
    toast({ title: '会话已重置（登录状态已清空）', status: 'info', duration: 2000, position: 'top' })
  }

  return (
    <Box p={6} display="flex" flexDirection="column" alignItems="center" justifyContent="center" h="full">
      <VStack spacing={4} w="full" maxW="560px">
        <Flex align="center" gap={2}>
          <FiGlobe color="var(--pbox-accent)" />
          <Text fontSize="lg" fontWeight="bold" color="ptext">
            浏览器
          </Text>
        </Flex>
        <Text fontSize="sm" color="ptextmuted" textAlign="center">
          {builtin
            ? '内置浏览器可直接领取资源并下载文件（支持上传、网页弹窗与"在新窗口打开"）；下载进度在「下载」页实时显示'
            : '资源与页面通过系统浏览器打开；切换回内置浏览器可在「设置 → 浏览器设置」更改'}
        </Text>

        <InputGroup size="md">
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
            placeholder="输入网址"
            spellCheck={false}
          />
        </InputGroup>

        <HStack spacing={3} wrap="wrap" justify="center">
          {builtin ? (
            <Button
              colorScheme="brand"
              isLoading={opening}
              onClick={() => void openBuiltin('current')}
            >
              打开内置浏览器
            </Button>
          ) : (
            <Button
              colorScheme="brand"
              leftIcon={<FiExternalLink />}
              isLoading={opening}
              onClick={() => void openSystem('current')}
            >
              用系统浏览器打开
            </Button>
          )}
          {builtin && (
            <Button
              variant="outline"
              borderColor="pborder"
              color="ptext"
              leftIcon={<FiExternalLink />}
              isLoading={opening}
              onClick={() => void openSystem('current')}
            >
              系统浏览器
            </Button>
          )}
          <Button
            variant="outline"
            borderColor="pborder"
            color="ptext"
            onClick={() => void (builtin ? openBuiltin('start') : openSystem('start'))}
          >
            回到起始页
          </Button>
          {builtin && (
            <Button
              variant="ghost"
              color="ptextmuted"
              leftIcon={<FiShield />}
              onClick={() => void resetSession()}
            >
              重置会话
            </Button>
          )}
        </HStack>

        <Text fontSize="xs" color="ptextmuted" textAlign="center">
          起始页：{DEFAULT_START_URL}
        </Text>
      </VStack>
    </Box>
  )
}
