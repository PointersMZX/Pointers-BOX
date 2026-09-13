import { Box, SimpleGrid, Skeleton, SkeletonText, VStack } from '@chakra-ui/react'

// v2.3.0 骨架屏：加载态占位（液态玻璃卡片形制，脉冲动画由 Chakra Skeleton 提供）

/** 卡片网格骨架（首页推荐 / 资源库网格通用） */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          bg="panel"
          borderWidth="1px"
          borderColor="pborder"
          borderRadius="lg"
          p={4}
          minH="170px"
          display="flex"
          flexDirection="column"
          gap={3}
        >
          <Skeleton height="16px" width="60%" />
          <SkeletonText noOfLines={3} spacing={2} skeletonHeight="10px" />
          <Skeleton height="12px" width="40%" mt="auto" />
        </Box>
      ))}
    </SimpleGrid>
  )
}

/** 行骨架（链接列表通用） */
export function RowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <VStack align="stretch" spacing={3}>
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} bg="panel" borderWidth="1px" borderColor="pborder" borderRadius="lg" p={4}>
          <Skeleton height="14px" width="45%" mb={2} />
          <Skeleton height="10px" width="80%" />
        </Box>
      ))}
    </VStack>
  )
}
