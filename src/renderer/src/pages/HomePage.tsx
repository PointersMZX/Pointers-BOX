import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack
} from '@chakra-ui/react'
import { FiBell, FiHome, FiRefreshCw } from 'react-icons/fi'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Resource } from '../../../shared/types'
import EmptyState from '../components/EmptyState'
import ResourceCard from '../components/ResourceCard'
import ResourceDetailModal from '../components/ResourceDetailModal'
import { useDataStore } from '../store/dataStore'
import { useFavoritesStore } from '../store/favoritesStore'
import { sampleUnique, sampleUniqueExcluding } from '../utils/recommend'

// 首页（PRD §3）：今日推荐（随机 3 张，可刷新）+ 全局公告
export default function HomePage() {
  const resources = useDataStore((s) => s.resources)
  const announcement = useDataStore((s) => s.announcement)
  const loaded = useDataStore((s) => s.loaded)
  const loading = useDataStore((s) => s.loading)
  const refreshData = useDataStore((s) => s.refresh)
  const [picks, setPicks] = useState<Resource[]>([])
  const [selected, setSelected] = useState<Resource | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const shownIds = useRef<Set<string | number>>(new Set())
  const favIds = useFavoritesStore((s) => s.ids)
  const favResources = useMemo(
    () => resources.filter((r) => favIds.has(String(r.id))),
    [resources, favIds]
  )
  const [favDetail, setFavDetail] = useState<Resource | null>(null)

  // 数据首次到达（或离线恢复）时抽取一次
  useEffect(() => {
    setPicks((prev) => {
      if (prev.length > 0) return prev
      const next = sampleUnique(resources, 3)
      shownIds.current = new Set(next.map((r) => r.id))
      return next
    })
  }, [resources])

  // PRD 3.2：点「刷新」重新抽取 —— 排除当前已展示的三张，保证每次必定切换
  const reshuffle = (): void => {
    const next = sampleUniqueExcluding(resources, 3, shownIds.current)
    if (next.length === 0) return
    shownIds.current = new Set(next.map((r) => r.id))
    setPicks(next)
  }

  if (!loaded && loading) {
    return <EmptyState icon={<FiHome />} title="正在加载数据…" description="正在从平台获取资源列表" />
  }

  return (
    <Box p={6}>
      {picks.length > 0 ? (
        <>
          <Flex align="center" justify="space-between" mb={4}>
            <Heading size="md" color="ptext">
              今日推荐
            </Heading>
            <Button
              size="sm"
              leftIcon={<FiRefreshCw />}
              variant="outline"
              onClick={reshuffle}
              isDisabled={resources.length === 0}
              borderColor="pborder"
              color="ptext"
              _hover={{ bg: 'hoverbg' }}
            >
              刷新
            </Button>
          </Flex>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
            {picks.map((r) => (
              <ResourceCard
                key={String(r.id)}
                resource={r}
                onOpen={(res) => {
                  setSelected(res)
                  setDetailOpen(true)
                }}
              />
            ))}
          </SimpleGrid>
        </>
      ) : (
        <EmptyState
          icon={<FiHome />}
          title="暂无推荐资源"
          description="平台还没有发布资源，或当前处于离线模式"
          action={
            <Button size="sm" variant="outline" onClick={() => void refreshData(true)}>
              重新加载
            </Button>
          }
        />
      )}

      {/* 我的收藏（v2.0.0）：本地收藏的常用资源，横滑展示 */}
      {favResources.length > 0 && (
        <>
          <Flex align="center" justify="space-between" mb={3} mt={2}>
            <Heading size="md" color="ptext">
              我的收藏
            </Heading>
            <Text fontSize="xs" color="ptextmuted">
              {favResources.length} 个
            </Text>
          </Flex>
          <Flex gap={3} overflowX="auto" pb={2} mb={4} sx={{ scrollbarWidth: 'none' }}>
            {favResources.map((r) => (
              <Box
                key={String(r.id)}
                flexShrink={0}
                w="200px"
                bg="panel"
                borderWidth="1px"
                borderColor="pborder"
                borderRadius="lg"
                p={3}
                cursor="pointer"
                className="pbox-morph"
                _hover={{ borderColor: 'brand.400', bg: 'panelstrong' }}
                onClick={() => setFavDetail(r)}
              >
                <Text fontWeight="semibold" noOfLines={1} color="ptext" mb={1}>
                  {r.name}
                </Text>
                <Text fontSize="xs" color="ptextmuted" noOfLines={2}>
                  {r.introduction || r.category}
                </Text>
              </Box>
            ))}
          </Flex>
        </>
      )}

      {announcement && (
        <>
          <Flex align="center" gap={2} my={5}>
            <Box flex="1" h="1px" bg="pborder" />
            <Text fontSize="sm" color="ptextmuted">
              — —
            </Text>
            <Box flex="1" h="1px" bg="pborder" />
          </Flex>
          <Box
            bg="panel"
            borderWidth="1px"
            borderColor="pborder"
            borderLeftWidth="4px"
            borderLeftColor="brand.500"
            borderRadius="lg"
            p={4}
            className="pbox-blur-panel"
          >
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <HStack>
                  <FiBell color="var(--pbox-accent)" />
                  <Text fontWeight="bold" color="ptext">
                    公告
                  </Text>
                </HStack>
                <Text fontSize="xs" color="ptextmuted">
                  公告日期：{announcement.date}
                </Text>
              </HStack>
              <Text fontSize="sm" color="ptextmuted" whiteSpace="pre-wrap">
                {announcement.content}
              </Text>
            </VStack>
          </Box>
        </>
      )}

      {/* 居中液态玻璃详情弹窗（v2.0.0） */}
      <ResourceDetailModal
        resource={selected}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
      <ResourceDetailModal
        resource={favDetail}
        isOpen={favDetail !== null}
        onClose={() => setFavDetail(null)}
      />
    </Box>
  )
}
