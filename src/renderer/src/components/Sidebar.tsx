import { Box, Flex, Text } from '@chakra-ui/react'
import { FiBookOpen, FiDownload, FiGlobe, FiHome, FiSettings } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { visiblePages } from '../../../shared/platformPages'
import type { Page } from '../../../shared/routes'
import { useUiStore } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'

const NAV_ITEMS: Record<Page, { label: string; icon: IconType }> = {
  home: { label: '首页', icon: FiHome },
  library: { label: '资源', icon: FiBookOpen },
  browser: { label: '浏览器', icon: FiGlobe },
  downloads: { label: '下载', icon: FiDownload },
  settings: { label: '设置', icon: FiSettings }
}

// 侧边导航栏：固定 200px，图标 + 文字（PRD 2.2）；液态玻璃主题带最高层模糊
export default function Sidebar() {
  const page = useUiStore((s) => s.page)
  const platform = useUiStore((s) => s.platform)
  const setPage = useUiStore((s) => s.setPage)
  const isGlass = useThemeStore((s) => s.themeKey) === 'glass'

  return (
    <Box
      w="200px"
      flexShrink={0}
      bg="sidebarbg"
      color="ptextmuted"
      py={4}
      display="flex"
      flexDirection="column"
      gap={1}
      className={isGlass ? 'pbox-blur-sidebar' : undefined}
      borderRightWidth="1px"
      borderRightColor="pborder"
    >
      <Text px={5} pb={4} fontSize="md" fontWeight="bold" color="ptext" letterSpacing={1}>
        Pointers-BOX
      </Text>
      {visiblePages(platform).map((p) => {
        const item = NAV_ITEMS[p]
        const active = page === p
        return (
          <Flex
            key={p}
            as="button"
            align="center"
            gap={3}
            px={5}
            py={2.5}
            mx={2}
            rounded="md"
            fontSize="sm"
            fontWeight={active ? 'semibold' : 'normal'}
            bg={active ? 'brand.600' : 'transparent'}
            color={active ? 'white' : 'ptextmuted'}
            _hover={{ bg: active ? 'brand.600' : 'hoverbg', color: active ? 'white' : 'ptext' }}
            onClick={() => setPage(p)}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </Flex>
        )
      })}
    </Box>
  )
}
