import { Box, Flex, Text } from '@chakra-ui/react'
import { FiBookOpen, FiDownload, FiGlobe, FiHome, FiLink, FiSettings } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import type { Page } from '../../../shared/routes'
import { visiblePages } from '../../../shared/platformPages'
import { useUiStore } from '../store/uiStore'

const NAV_ITEMS: Record<Page, { label: string; icon: IconType }> = {
  home: { label: '首页', icon: FiHome },
  library: { label: '资源', icon: FiBookOpen },
  links: { label: '链接', icon: FiLink },
  browser: { label: '浏览器', icon: FiGlobe },
  downloads: { label: '下载', icon: FiDownload },
  settings: { label: '设置', icon: FiSettings }
}

/**
 * Android 底部导航栏（v2.0.0）：
 * 手机端以底栏替代桌面侧边栏，竖屏/横屏均可单手操作；
 * 液态玻璃质感 + 安全区适配。
 */
export default function BottomNav() {
  const page = useUiStore((s) => s.page)
  const platform = useUiStore((s) => s.platform)
  const setPage = useUiStore((s) => s.setPage)

  return (
    <Box
      as="nav"
      id="pbox-bottomnav"
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex={1200}
      bg="barbg"
      borderTopWidth="1px"
      borderTopColor="pborder"
      className="pbox-blur-bar"
      pb="env(safe-area-inset-bottom)"
      role="navigation"
      aria-label="底部导航"
    >
      <Flex justify="space-around" align="stretch" maxW="640px" mx="auto">
        {visiblePages(platform).map((p) => {
          const item = NAV_ITEMS[p]
          const active = page === p
          return (
            <Flex
              key={p}
              as="button"
              flex="1"
              direction="column"
              align="center"
              gap={1}
              py={2.5}
              position="relative"
              color={active ? 'var(--pbox-accent)' : 'ptextmuted'}
              onClick={() => setPage(p)}
              _hover={{ color: active ? 'var(--pbox-accent)' : 'ptext' }}
              aria-current={active ? 'page' : undefined}
            >
              {/* 顶部指示条 */}
              <Box
                position="absolute"
                top={0}
                w="32px"
                h="3px"
                borderBottomRadius="full"
                bg={active ? 'var(--pbox-accent)' : 'transparent'}
                transition="all .25s cubic-bezier(.34,1.56,.64,1)"
              />
              <Box as={item.icon} size={20} />
              <Text fontSize="10px" fontWeight={active ? 'semibold' : 'normal'} letterSpacing={1}>
                {item.label}
              </Text>
            </Flex>
          )
        })}
      </Flex>
    </Box>
  )
}
