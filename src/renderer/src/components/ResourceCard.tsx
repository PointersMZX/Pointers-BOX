import { Badge, Box, HStack, Icon, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { FiEye, FiStar } from 'react-icons/fi'
import type { Resource } from '../../../shared/types'
import { getResourceShares } from '../../../shared/validate'
import { useFavoritesStore } from '../store/favoritesStore'
import ResourceDetailModal from './ResourceDetailModal'
import GlassButton from './GlassButton'

interface Props {
  resource: Resource
  /** 提供时由父级打开详情弹窗；未提供时卡片内部自持弹窗 */
  onOpen?: (resource: Resource) => void
  /** 卡片最小高度（堆叠布局下卡片规格统一，由父级传入；默认 170px 通用） */
  minH?: string
}

/**
 * 资源卡片（v2.1.0 克制版）：
 * 名称、简介、日期、分享项数量 + 「详情」按钮（不再直接领取）。
 * v2.1.0：去掉拖拽形变（与下拉刷新抢指针、误触详情页的元凶）与悬浮流光。
 * data-no-ptr：卡片区域不作为下拉刷新手势起点（只在列表空白处下拉刷新）。
 */
export default function ResourceCard({ resource, onOpen, minH = '170px' }: Props) {
  const [localOpen, setLocalOpen] = useState(false)
  const fav = useFavoritesStore((st) => st.ids.has(String(resource.id)))
  const toggleFav = useFavoritesStore((st) => st.toggle)

  const openDetail = (): void => {
    if (onOpen) onOpen(resource)
    else setLocalOpen(true)
  }

  return (
    <>
      <Box
        data-no-ptr
        cursor="pointer"
        onClick={openDetail}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
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
          minH={minH}
          className="pbox-morph"
          _hover={{ shadow: 'md', borderColor: 'brand.400', bg: 'panelstrong' }}
        >
          <HStack justify="space-between" align="flex-start">
            <Text fontWeight="bold" noOfLines={1} title={resource.name} color="ptext" flex="1">
              {resource.name}
            </Text>
            <HStack spacing={1} flexShrink={0}>
              <Badge
                borderRadius="full"
                fontSize="2xs"
                px={2}
                colorScheme="purple"
                variant="subtle"
              >
                {getResourceShares(resource).length} 项
              </Badge>
              {/* 收藏星标（v2.0.0）：本地 config.favorites */}
              <Box
                as="button"
                aria-label={fav ? '取消收藏' : '收藏'}
                title={fav ? '取消收藏' : '收藏'}
                p={1}
                borderRadius="md"
                color={fav ? 'var(--pbox-accent)' : 'ptextmuted'}
                _hover={{ bg: 'hoverbg' }}
                onClick={(e: { stopPropagation: () => void }) => {
                  e.stopPropagation()
                  void toggleFav(resource.id)
                }}
              >
                <Icon as={FiStar} boxSize={3.5} fill={fav ? 'var(--pbox-accent)' : 'none'} />
              </Box>
            </HStack>
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
      </Box>

      {/* 未提供 onOpen 时卡片自持详情弹窗 */}
      {!onOpen && (
        <ResourceDetailModal resource={resource} isOpen={localOpen} onClose={() => setLocalOpen(false)} />
      )}
    </>
  )
}
