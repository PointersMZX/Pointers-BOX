import { Badge, Box, HStack, Text } from '@chakra-ui/react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useState } from 'react'
import { FiEye } from 'react-icons/fi'
import type { Resource } from '../../../shared/types'
import { getResourceShares } from '../../../shared/validate'
import ResourceDetailModal from './ResourceDetailModal'
import GlassButton from './GlassButton'

interface Props {
  resource: Resource
  /** 提供时由父级打开详情弹窗；未提供时卡片内部自持弹窗 */
  onOpen?: (resource: Resource) => void
}

/**
 * 资源卡片（v2.0.0）：
 * 名称、简介、日期、分享项数量 + 「详情」按钮（不再直接领取）；
 * 滑动时面板轻微形变弯曲，松手带 2 次衰减晃动归位；悬浮高光流动。
 */
export default function ResourceCard({ resource, onOpen }: Props) {
  const [localOpen, setLocalOpen] = useState(false)
  const x = useMotionValue(0)
  // 滑动形变：跟随滑动方向轻微弯曲
  const rotate = useTransform(x, [-140, 140], [-5, 5])
  const skewX = useTransform(x, [-140, 140], [4, -4])

  const openDetail = (): void => {
    if (onOpen) onOpen(resource)
    else setLocalOpen(true)
  }

  return (
    <>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragTransition={{ bounceStiffness: 380, bounceDamping: 16 }}
        style={{ x, rotate, skewX, cursor: 'pointer' }}
        onClick={openDetail}
        role="button"
        tabIndex={0}
        onKeyDown={(e: { key: string; preventDefault: () => void }) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openDetail()
          }
        }}
        aria-label={`查看资源详情：${resource.name}`}
      >
        <Box
          bg="panel"
          shadow="sm"
          borderWidth="1px"
          borderColor="pborder"
          borderRadius="lg"
          p={4}
          display="flex"
          flexDirection="column"
          gap={2}
          minH="170px"
          className="pbox-morph pbox-glass-flow"
          _hover={{ shadow: 'md', borderColor: 'brand.400', bg: 'panelstrong' }}
        >
          <HStack justify="space-between" align="flex-start">
            <Text fontWeight="bold" noOfLines={1} title={resource.name} color="ptext" flex="1">
              {resource.name}
            </Text>
            <Badge
              borderRadius="full"
              fontSize="2xs"
              px={2}
              flexShrink={0}
              colorScheme="purple"
              variant="subtle"
            >
              {getResourceShares(resource).length} 项
            </Badge>
          </HStack>
          <Text fontSize="sm" color="ptextmuted" noOfLines={3} flex="1">
            {resource.introduction || '暂无简介'}
          </Text>
          <HStack justify="space-between">
            <Text fontSize="xs" color="ptextmuted">
              {resource.release_date ?? ''}
            </Text>
            <GlassButton
              size="sm"
              variant="ghost"
              ariaLabel={`查看详情：${resource.name}`}
              onClick={openDetail}
            >
              <FiEye />
              详情
            </GlassButton>
          </HStack>
        </Box>
      </motion.div>

      {/* 未提供 onOpen 时卡片自持详情弹窗 */}
      {!onOpen && (
        <ResourceDetailModal resource={resource} isOpen={localOpen} onClose={() => setLocalOpen(false)} />
      )}
    </>
  )
}
