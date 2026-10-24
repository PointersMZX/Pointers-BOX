import { Box, Flex, Text } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { FiBookOpen, FiDownload, FiGlobe, FiHome, FiLink, FiSettings } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { visiblePages } from '../../../shared/platformPages'
import type { Page } from '../../../shared/routes'
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

// 侧边导航栏：固定 200px，图标 + 文字（PRD 2.2）；液态玻璃主题带最高层模糊
// 侧边导航栏：固定 200px，图标 + 文字（PRD 2.2）；液态玻璃开启时最高层模糊
// v2.3.0：激活态改为滑动高亮胶囊（framer-motion layoutId，切换时平滑滑动）
export default function Sidebar() {
  const page = useUiStore((s) => s.page)
  const platform = useUiStore((s) => s.platform)
  const setPage = useUiStore((s) => s.setPage)
  const isGlassOn = useThemeStore((s) => s.isGlassOn)

  return (
    <Box
      id="pbox-sidebar"
      w="200px"
      flexShrink={0}
      bg="var(--pbox-bg-sidebar)"
      color="ptextmuted"
      // v2.4.0：玻璃开时侧栏 = 悬浮胶囊板（stadium 两端半圆透镜；SDF 半径钳到短边一半与之同形）
      // —— 上浮留出空隙 + 顶部加内边距让 Logo 落进胶囊曲线之内
      py={isGlassOn ? 0 : 4}
      pt={isGlassOn ? 11 : 4}
      pb={isGlassOn ? 2 : 4}
      margin={isGlassOn ? '10px 12px 10px 10px' : 0}
      borderRadius={isGlassOn ? '9999px' : undefined}
      display="flex"
      flexDirection="column"
      gap={1}
      className={isGlassOn ? 'pbox-blur-sidebar' : undefined}
      borderRightWidth="1px"
      // v2.3.1：发丝边按主题（紫金黑 = 金发丝）
      borderRightColor="var(--pbox-edge, rgba(255,255,255,0.16))"
    >
      <Text px={5} pb={4} fontSize="md" fontWeight="bold" color="ptext" letterSpacing={1} className="pbox-logo">
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
            rounded="full"
            fontSize="sm"
            fontWeight={active ? 'semibold' : 'normal'}
            color={active ? 'white' : 'ptextmuted'}
            _hover={{ color: active ? 'white' : 'ptext' }}
            onClick={() => setPage(p)}
            position="relative"
            className={active ? 'pbox-nav-item pbox-nav-item-active' : 'pbox-nav-item'}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active-pill"
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '9999px',
                  // v2.3.1：胶囊背景按主题（紫金黑 = 紫金渐变）；v2.4.0：加同色辉光
                  background: 'var(--pbox-pill, var(--chakra-colors-brand-600))',
                  boxShadow: '0 0 18px var(--pbox-accent-soft, rgba(124,92,255,0.35))'
                }}
              />
            )}
            <item.icon
              size={16}
              style={{
                position: 'relative',
                zIndex: 1,
                // v2.4.0：激活项图标微放大（弹簧归位）
                transform: active ? 'scale(1.12)' : 'scale(1)',
                transition: 'transform .22s cubic-bezier(.34,1.56,.64,1)'
              }}
            />
            <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
          </Flex>
        )
      })}
    </Box>
  )
}
