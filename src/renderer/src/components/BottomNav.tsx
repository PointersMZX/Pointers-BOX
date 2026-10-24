import { Box, Flex, Text } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { FiBookOpen, FiDownload, FiGlobe, FiHome, FiLink, FiSettings } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import type { Page } from '../../../shared/routes'
import { visiblePages } from '../../../shared/platformPages'
import { useUiStore } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'

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
 * v2.4.0：玻璃开时底栏 = 悬浮胶囊板（stadium 两端半圆透镜，与 WebGL 胶囊 SDF 同形）；
 * 图标按压弹簧反馈。
 */
export default function BottomNav() {
  const page = useUiStore((s) => s.page)
  const platform = useUiStore((s) => s.platform)
  const setPage = useUiStore((s) => s.setPage)
  const isGlassOn = useThemeStore((s) => s.isGlassOn)

  return (
    <Box
      as="nav"
      id="pbox-bottomnav"
      position="fixed"
      bottom={isGlassOn ? 10 : 0}
      left={isGlassOn ? 14 : 0}
      right={isGlassOn ? 14 : 0}
      zIndex={1200}
      bg="var(--pbox-bg-bar)"
      borderTopWidth="1px"
      borderRadius={isGlassOn ? '9999px' : undefined}
      // v2.3.1：发丝边按主题（紫金黑 = 金发丝）
      borderTopColor="var(--pbox-edge, rgba(255,255,255,0.16))"
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
              {/* 顶部指示条（v2.3.1：按主题，紫金黑 = 紫金渐变） */}
              <Box
                position="absolute"
                top={0}
                w="32px"
                h="3px"
                borderBottomRadius="full"
                bg={active ? 'var(--pbox-indicator, var(--pbox-accent))' : 'transparent'}
                boxShadow={active ? '0 0 12px var(--pbox-accent-soft, rgba(124,92,255,0.35))' : 'none'}
                transition="all .25s cubic-bezier(.34,1.56,.64,1)"
              />
              {/* v2.4.0：图标按压弹簧反馈 */}
              <motion.span
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 600, damping: 26 }}
              >
                <Box as={item.icon} size={20} />
              </motion.span>
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
