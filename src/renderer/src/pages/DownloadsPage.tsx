import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Progress,
  Stack,
  Text,
  useToast,
  VStack
} from '@chakra-ui/react'
import { FiDownload, FiFolder, FiEdit } from 'react-icons/fi'
import { useEffect } from 'react'
import type { DownloadTask } from '../../../shared/types'
import { useDownloadStore } from '../store/downloadStore'
import { backend } from '../platform'
import { formatBytes, percentOf } from '../utils/format'

function TaskRow({ task }: { task: DownloadTask }) {
  const percent = percentOf(task.received, task.total)
  const known = task.total > 0
  return (
    <Box bg="white" borderWidth="1px" borderColor="gray.100" rounded="lg" p={3}>
      <HStack justify="space-between" mb={2}>
        <HStack minW={0} spacing={2}>
          {task.source === 'update' && (
            <Text fontSize="xs" color="brand.500" flexShrink={0}>
              [更新包]
            </Text>
          )}
          <Text fontSize="sm" noOfLines={1} title={task.filename}>
            {task.filename}
          </Text>
        </HStack>
        <Text fontSize="xs" color="gray.400" flexShrink={0}>
          {known ? `${formatBytes(task.received)} / ${formatBytes(task.total)}` : formatBytes(task.received)}
          {task.bytesPerSecond > 0 ? ` · ${formatBytes(task.bytesPerSecond)}/s` : ''}
        </Text>
      </HStack>
      <HStack spacing={3}>
        <Progress flex="1" size="sm" colorScheme="brand" value={percent} hasStripe isAnimated />
        <Text fontSize="xs" color="gray.500" w="48px" textAlign="right">
          {percent.toFixed(0)}%
        </Text>
      </HStack>
    </Box>
  )
}

// 下载管理（PRD 4.3）：路径显示/更改/锁定 + 进行中任务 + 打开文件夹
export default function DownloadsPage() {
  const tasks = useDownloadStore((s) => s.tasks)
  const config = useDownloadStore((s) => s.config)
  const loadConfig = useDownloadStore((s) => s.loadConfig)
  const applyEvent = useDownloadStore((s) => s.applyEvent)
  const chooseDir = useDownloadStore((s) => s.chooseDir)
  const openFolder = useDownloadStore((s) => s.openFolder)
  const toast = useToast()

  useEffect(() => {
    void loadConfig()
    const off = backend.onDownloadEvent(applyEvent)
    return () => off()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasActive = tasks.length > 0

  const onChangeDir = async (): Promise<void> => {
    if (hasActive) {
      toast({ title: '下载进行中，无法更改下载路径', status: 'warning', duration: 3000, position: 'top' })
      return
    }
    const dir = await chooseDir()
    if (dir) toast({ title: '下载目录已更新', status: 'success', duration: 2000, position: 'top' })
  }

  return (
    <Box p={6}>
      <Heading size="md" mb={4}>
        下载管理
      </Heading>

      {/* 下载路径（PRD 4.3：显示当前路径 + 更改 + 下载中锁定 + 打开文件夹） */}
      <Box bg="white" borderWidth="1px" borderColor="gray.100" rounded="lg" p={4} mb={6}>
        <Flex align="center" justify="space-between" gap={3} wrap="wrap">
          <HStack minW={0}>
            <Icon as={FiFolder} color="brand.500" />
            <Text fontSize="sm" fontWeight="semibold" flexShrink={0}>
              当前下载目录
            </Text>
            <Text fontSize="sm" color="gray.500" isTruncated title={config?.downloadDir ?? ''}>
              {config?.downloadDir ?? '加载中…'}
            </Text>
          </HStack>
          <HStack>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FiEdit />}
              isDisabled={hasActive}
              onClick={() => void onChangeDir()}
            >
              更改
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FiFolder />}
              onClick={() => void openFolder()}
            >
              打开文件夹
            </Button>
          </HStack>
        </Flex>
        {hasActive && (
          <Text fontSize="xs" color="orange.400" mt={2}>
            有任务正在下载，路径更改已锁定
          </Text>
        )}
      </Box>

      {/* 进行中任务（完成后自动从列表消失） */}
      <Stack spacing={3}>
        {tasks.length > 0 ? (
          tasks.map((t) => <TaskRow key={t.id} task={t} />)
        ) : (
          <VStack py={16} spacing={2} color="gray.400">
            <FiDownload size={40} />
            <Text fontSize="lg" fontWeight="semibold" color="gray.500">
              暂无进行中的下载
            </Text>
            <Text fontSize="sm">在浏览器中触发下载后，任务将显示在这里</Text>
          </VStack>
        )}
      </Stack>
    </Box>
  )
}
