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
import { useEffect, useState } from 'react'
import type { Resource } from '../../../shared/types'
import EmptyState from '../components/EmptyState'
import ResourceCard from '../components/ResourceCard'
import { useDataStore } from '../store/dataStore'
import { sampleUnique } from '../utils/recommend'

// 首页（PRD §3）：今日推荐（随机 3 张，可刷新）+ 全局公告
export default function HomePage() {
  const resources = useDataStore((s) => s.resources)
  const announcement = useDataStore((s) => s.announcement)
  const loaded = useDataStore((s) => s.loaded)
  const loading = useDataStore((s) => s.loading)
  const refreshData = useDataStore((s) => s.refresh)
  const [picks, setPicks] = useState<Resource[]>([])

  // 数据首次到达（或离线恢复）时抽取一次
  useEffect(() => {
    setPicks((prev) => (prev.length === 0 ? sampleUnique(resources, 3) : prev))
  }, [resources])

  // PRD 3.2：点「刷新」重新抽取
  const reshuffle = (): void => setPicks(sampleUnique(resources, 3))

  if (!loaded && loading) {
    return <EmptyState icon={<FiHome />} title="正在加载数据…" description="正在从平台获取资源列表" />
  }

  return (
    <Box p={6}>
      {picks.length > 0 ? (
        <>
          <Flex align="center" justify="space-between" mb={4}>
            <Heading size="md">今日推荐</Heading>
            <Button
              size="sm"
              leftIcon={<FiRefreshCw />}
              variant="outline"
              onClick={reshuffle}
              isDisabled={resources.length === 0}
            >
              刷新
            </Button>
          </Flex>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            {picks.map((r) => (
              <ResourceCard key={String(r.id)} resource={r} />
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

      {announcement && (
        <>
          <Flex align="center" gap={2} my={5}>
            <Box flex="1" h="1px" bg="gray.200" />
            <Text fontSize="sm" color="gray.400">
              — —
            </Text>
            <Box flex="1" h="1px" bg="gray.200" />
          </Flex>
          <Box
            bg="white"
            borderWidth="1px"
            borderColor="gray.100"
            borderLeftWidth="4px"
            borderLeftColor="brand.500"
            borderRadius="lg"
            p={4}
          >
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <HStack>
                  <FiBell color="#3182ce" />
                  <Text fontWeight="bold">公告</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400">
                  公告日期：{announcement.date}
                </Text>
              </HStack>
              <Text fontSize="sm" color="gray.600" whiteSpace="pre-wrap">
                {announcement.content}
              </Text>
            </VStack>
          </Box>
        </>
      )}
    </Box>
  )
}
