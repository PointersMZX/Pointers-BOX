import { Box, Button, HStack, Text } from '@chakra-ui/react'
import type { Resource } from '../../../shared/types'
import { openClaim } from '../platform'

interface Props {
  resource: Resource
  onOpen?: (resource: Resource) => void
}

// 资源卡片（PRD 3.1/4.1）：名称、简介、日期、领取按钮；首页/资源库共用
export default function ResourceCard({ resource, onOpen }: Props) {
  const link = resource.links[0] ?? ''
  const handleClick = (): void => {
    if (onOpen) onOpen(resource)
    else if (link) openClaim(link)
  }
  return (
    <Box
      bg="white"
      shadow="sm"
      borderWidth="1px"
      borderColor="gray.100"
      borderRadius="lg"
      p={4}
      display="flex"
      flexDirection="column"
      gap={2}
      minH="170px"
      cursor="pointer"
      _hover={{ shadow: 'md', borderColor: 'brand.200' }}
      transition="all .15s"
      onClick={handleClick}
    >
      <Text fontWeight="bold" noOfLines={1} title={resource.name}>
        {resource.name}
      </Text>
      <Text fontSize="sm" color="gray.500" noOfLines={3} flex="1">
        {resource.introduction || '暂无简介'}
      </Text>
      <HStack justify="space-between">
        <Text fontSize="xs" color="gray.400">
          {resource.release_date ?? ''}
        </Text>
        <Button
          size="sm"
          colorScheme="brand"
          onClick={(e) => {
            e.stopPropagation()
            if (link) openClaim(link)
          }}
        >
          领取
        </Button>
      </HStack>
    </Box>
  )
}
