import { Box, Text, VStack } from '@chakra-ui/react'
import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

// 全局空状态提示（PRD 7.1/7.2 空状态验收项）
export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <VStack spacing={3} py={24} color="gray.400">
      {icon && <Box fontSize="5xl">{icon}</Box>}
      <Text fontSize="lg" fontWeight="semibold" color="gray.500">
        {title}
      </Text>
      {description && (
        <Text fontSize="sm" color="gray.400" maxW="md" textAlign="center">
          {description}
        </Text>
      )}
      {action}
    </VStack>
  )
}
