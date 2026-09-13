import { Box, Text, VStack } from '@chakra-ui/react'
import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

// 全局空状态提示（PRD 7.1/7.2 空状态验收项）；v2.3.0 图标升级为玻璃圆底 + 强调色
export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <VStack spacing={4} py={24}>
      {icon && (
        <Box
          as="span"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          w="64px"
          h="64px"
          borderRadius="full"
          bg="panel"
          borderWidth="1px"
          borderColor="pborder"
          color="var(--pbox-accent)"
          fontSize="24px"
          className="pbox-blur-panel"
        >
          {icon}
        </Box>
      )}
      <Text fontSize="lg" fontWeight="semibold" color="ptext">
        {title}
      </Text>
      {description && (
        <Text fontSize="sm" color="ptextmuted" maxW="md" textAlign="center" opacity={0.8}>
          {description}
        </Text>
      )}
      {action}
    </VStack>
  )
}
