import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  VStack
} from '@chakra-ui/react'
import { FiArrowLeft, FiArrowRight, FiGlobe, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { useState } from 'react'
import { DEFAULT_START_URL, normalizeAddressInput } from '../../../shared/browser'
import { androidOpenClaim, androidOpenExternal, androidResetSession } from '../platform/capacitor'
import { useBrowserStore } from '../store/browserStore'

// 安卓端内置浏览器启动器：打开原生 InAppBrowserActivity（WebView+工具栏+下载接管）
export default function AndroidBrowserPage() {
  const storeUrl = useBrowserStore((s) => s.url)
  const setStoreUrl = useBrowserStore((s) => s.navigateTo)
  const [address, setAddress] = useState(storeUrl)
  const [resetFirst, setResetFirst] = useState(false)
  const [opening, setOpening] = useState(false)

  const open = async (mode: 'builtin' | 'system'): Promise<void> => {
    const url = normalizeAddressInput(address)
    setAddress(url)
    setStoreUrl(url)
    setOpening(true)
    try {
      if (mode === 'builtin' && resetFirst) {
        await androidResetSession()
      }
      await androidOpenClaim(url, mode)
    } finally {
      setOpening(false)
    }
  }

  return (
    <Box p={6} display="flex" flexDirection="column" alignItems="center" justifyContent="center" h="full">
      <VStack spacing={4} w="full" maxW="560px">
        <Flex align="center" gap={2}>
          <FiGlobe color="var(--pbox-accent)" />
          <Text fontSize="lg" fontWeight="bold" color="ptext">
            内置浏览器
          </Text>
        </Flex>
        <Text fontSize="sm" color="ptextmuted" textAlign="center">
          在独立窗口中打开平台页面，支持导航工具栏与文件下载（由系统下载管理器接管）
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
          <Button
            colorScheme="brand"
            leftIcon={<FiGlobe />}
            isLoading={opening}
            onClick={() => void open('builtin')}
          >
            打开内置浏览器
          </Button>
          <Button
            variant="outline"
            borderColor="pborder"
            color="ptext"
            leftIcon={<FiRefreshCw />}
            onClick={() => void open('system')}
          >
            用系统浏览器打开
          </Button>
        </HStack>

        <HStack spacing={2}>
          <Button size="xs" variant="ghost" leftIcon={<FiArrowLeft />} onClick={() => void open('builtin')}>
            回到起始页
          </Button>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<FiArrowRight />}
            colorScheme="red"
            onClick={() => void androidResetSession()}
          >
            重置会话
          </Button>
        </HStack>

        <Text fontSize="xs" color="ptextmuted" textAlign="center">
          起始页：{DEFAULT_START_URL}
        </Text>
      </VStack>
    </Box>
  )
}
