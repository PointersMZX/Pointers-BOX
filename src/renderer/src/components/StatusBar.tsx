import { Badge, Box, Flex, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { backend } from '../platform'
import { useThemeStore } from '../store/themeStore'
import { useUiStore } from '../store/uiStore'

// 状态栏（PRD 2.1）：版本信息 / 网络状态 / 离线模式标识
export default function StatusBar() {
  const platform = useUiStore((s) => s.platform)
  const offline = useDataStore((s) => s.offline)
  const [appVersion, setAppVersion] = useState('')

  // v2.0.0：显示本地应用版本（package.json），远程 box.json 的 app_version 不再上状态栏
  useEffect(() => {
    backend.getAppVersion().then(setAppVersion).catch(() => {})
  }, [])
  const isGlassOn = useThemeStore((s) => s.isGlassOn)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const goOnline = (): void => setOnline(true)
    const goOffline = (): void => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <Flex
      h="28px"
      flexShrink={0}
      align="center"
      justify="space-between"
      px={3}
      bg="barbg"
      borderTop="1px solid"
      borderColor="pborder"
      fontSize="xs"
      color="ptextmuted"
      className={isGlassOn ? 'pbox-blur-bar' : undefined}
      position="relative"
      zIndex={1}
    >
      <Flex align="center" gap={2}>
        <Box as="span" color={online ? 'green.400' : 'red.400'} fontSize="10px">
          ●
        </Box>
        <Text>{online ? '网络正常' : '网络离线'}</Text>
        {offline && (
          <Badge colorScheme="orange" fontSize="10px">
            离线模式
          </Badge>
        )}
      </Flex>
      <Text>
        Pointers-BOX {appVersion ? `v${appVersion}` : 'v2.3.0'}
        {platform === 'android' ? ' · Android' : ''}
      </Text>
    </Flex>
  )
}
