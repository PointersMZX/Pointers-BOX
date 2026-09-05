import { Badge, Box, Flex, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { useThemeStore } from '../store/themeStore'
import { useUiStore } from '../store/uiStore'

// 状态栏（PRD 2.1）：版本信息 / 网络状态 / 离线模式标识
export default function StatusBar() {
  const platform = useUiStore((s) => s.platform)
  const offline = useDataStore((s) => s.offline)
  const boxVersion = useDataStore((s) => s.box?.app_version)
  const isGlass = useThemeStore((s) => s.themeKey) === 'glass'
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
      className={isGlass ? 'pbox-blur-bar' : undefined}
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
        Pointers-BOX {boxVersion ?? 'Version 2.0.0 Beta'}
        {platform === 'android' ? ' · Android' : ''}
      </Text>
    </Flex>
  )
}
