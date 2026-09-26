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
import { FiArrowLeft, FiExternalLink, FiGlobe, FiSearch } from 'react-icons/fi'
import { useState } from 'react'
import { DEFAULT_START_URL, normalizeAddressInput } from '../../../shared/browser'
import { androidOpenExternal } from '../platform/capacitor'
import { useBrowserStore, getActiveTab } from '../store/browserStore'

// 安卓端浏览器（v2.3.0）：内嵌浏览器已删除——自动跳转系统浏览器，无下载功能
export default function AndroidBrowserPage() {
  const storeUrl = useBrowserStore((s) => getActiveTab(s).url)
  const setStoreUrl = useBrowserStore((s) => s.navigateTo)
  const [address, setAddress] = useState(storeUrl)
  const [opening, setOpening] = useState(false)

  const open = (mode: 'current' | 'start'): Promise<void> => {
    const url = normalizeAddressInput(mode === 'start' ? DEFAULT_START_URL : address)
    if (mode === 'current') setAddress(url)
    setStoreUrl(url)
    setOpening(true)
    return androidOpenExternal(url).finally(() => setOpening(false))
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
          资源与页面均通过系统浏览器打开（v2.3.0 起不再内置浏览器）；下载请在系统浏览器内进行
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
            leftIcon={<FiExternalLink />}
            isLoading={opening}
            onClick={() => void open('current')}
          >
            用系统浏览器打开
          </Button>
          <Button
            variant="outline"
            borderColor="pborder"
            color="ptext"
            leftIcon={<FiArrowLeft />}
            onClick={() => void open('start')}
          >
            回到起始页
          </Button>
        </HStack>

        <Text fontSize="xs" color="ptextmuted" textAlign="center">
          起始页：{DEFAULT_START_URL}
        </Text>
      </VStack>
    </Box>
  )
}
