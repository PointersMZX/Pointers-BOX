import {
  Box,
  Button,
  Collapse,
  Flex,
  Heading,
  HStack,
  Icon,
  Progress,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useDisclosure,
  useToast,
  VStack
} from '@chakra-ui/react'
import {
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiFolder,
  FiRefreshCw,
  FiUploadCloud
} from 'react-icons/fi'
import { useEffect, useState } from 'react'
import type { UpdateCheckResult } from '../../../shared/types'
import { useDataStore } from '../store/dataStore'
import { useDownloadStore } from '../store/downloadStore'
import { useUiStore } from '../store/uiStore'
import { backend } from '../platform'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box bg="white" borderWidth="1px" borderColor="gray.100" rounded="lg" p={5} mb={4}>
      <Heading size="sm" mb={3} color="gray.700">
        {title}
      </Heading>
      <VStack align="stretch" spacing={2}>
        {children}
      </VStack>
    </Box>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <Flex gap={4} fontSize="sm">
      <Text w="88px" flexShrink={0} color="gray.400">
        {label}
      </Text>
      <Text color="gray.700" wordBreak="break-all">
        {value}
      </Text>
    </Flex>
  )
}

function ExpandableText({ text, empty }: { text: string; empty: string }) {
  const { isOpen, onToggle } = useDisclosure()
  return (
    <Box>
      <Collapse startingHeight={44} in={isOpen}>
        <Text fontSize="sm" color="gray.600" whiteSpace="pre-wrap" wordBreak="break-all">
          {text || empty}
        </Text>
      </Collapse>
      <Button size="xs" variant="ghost" leftIcon={isOpen ? <FiChevronUp /> : <FiChevronDown />} onClick={onToggle}>
        {isOpen ? '收起' : '展开阅读'}
      </Button>
    </Box>
  )
}

// 设置（PRD 4.4）：关于应用 / 检查更新 / 下载设置 / 浏览器设置 / 数据恢复
export default function SettingsPage() {
  const box = useDataStore((s) => s.box)
  const authorWords = useDataStore((s) => s.authorWords)
  const restore = useDataStore((s) => s.restore)
  const platform = useUiStore((s) => s.platform)
  const toast = useToast()

  const config = useDownloadStore((s) => s.config)
  const loadConfig = useDownloadStore((s) => s.loadConfig)
  const chooseDir = useDownloadStore((s) => s.chooseDir)
  const applyEvent = useDownloadStore((s) => s.applyEvent)

  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [updatePercent, setUpdatePercent] = useState(0)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  // 更新事件：进度同时汇入下载管理（PRD 7.4：更新包下载也显示在下载管理）
  useEffect(() => {
    const off = backend.onUpdateEvent((e) => {
      if (e.type === 'progress') {
        setDownloading(true)
        setUpdatePercent(e.percent)
        applyEvent({
          type: 'progress',
          task: {
            id: 'app-update',
            filename: 'Pointers-BOX 更新包',
            path: '',
            received: Math.round(e.percent),
            total: 100,
            percent: e.percent,
            bytesPerSecond: 0,
            source: 'update'
          }
        })
      } else if (e.type === 'downloaded') {
        setDownloading(false)
        setDownloaded(true)
        applyEvent({ type: 'done', id: 'app-update', state: 'completed' })
      } else if (e.type === 'error') {
        setDownloading(false)
        toast({ title: `更新失败：${e.message}`, status: 'error', duration: 5000, position: 'top' })
      }
    })
    return () => off()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCheck = async (): Promise<void> => {
    setChecking(true)
    try {
      setResult(await backend.checkUpdate())
    } finally {
      setChecking(false)
    }
  }

  const onDownload = async (): Promise<void> => {
    setDownloading(true)
    try {
      await backend.downloadUpdate()
    } catch (e) {
      setDownloading(false)
      toast({
        title: e instanceof Error ? e.message : '下载更新失败',
        status: 'error',
        duration: 5000,
        position: 'top'
      })
    }
  }

  const onRestore = async (target: 'resources' | 'box'): Promise<void> => {
    const ok = await restore(target)
    toast({
      title: ok ? '数据恢复成功' : '已取消或恢复失败',
      status: ok ? 'success' : 'warning',
      duration: 3000,
      position: 'top'
    })
  }

  return (
    <Box p={6} maxW="820px">
      <Heading size="md" mb={4}>
        设置
      </Heading>

      {/* 关于应用（合并区块，PRD 4.4） */}
      <Section title="关于应用">
        <Row label="应用名称" value={box?.app_name ?? 'Pointers-BOX'} />
        <Row label="应用版本" value={box?.app_version ?? 'Version 2.0.0 Beta'} />
        <Row label="开发者" value={box?.developer} />
        <Row label="社区 QQ 群" value={box?.community_qq} />
        <Row label="联合出品" value={box?.general_key} />
        <Box>
          <Text fontSize="sm" color="gray.400" mb={1}>
            应用简介
          </Text>
          <ExpandableText text={box?.app_introduction ?? ''} empty="暂未获取到应用简介" />
        </Box>
        <Box>
          <Text fontSize="sm" color="gray.400" mb={1}>
            作者有话说
          </Text>
          <ExpandableText text={authorWords?.content ?? ''} empty="暂未获取到作者有话说" />
        </Box>
        <Row label="版权声明" value={box?.copyright} />
      </Section>

      {/* 检查更新（PRD 4.4：GitHub Release 对比） */}
      <Section title="更新检查">
        <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
          <Text fontSize="sm" color="gray.600">
            当前版本：{result?.current ?? box?.app_version ?? 'Version 2.0.0 Beta'}
          </Text>
          <Button
            size="sm"
            leftIcon={<FiRefreshCw />}
            isLoading={checking}
            onClick={() => void onCheck()}
          >
            检查更新
          </Button>
        </Flex>
        {result && !result.error && (
          <Stack spacing={2} mt={1}>
            <Text fontSize="sm">
              最新版本：
              <Text as="span" fontWeight="bold" color="gray.700">
                {result.latest ?? '未知'}
              </Text>
              {result.hasUpdate ? (
                <Text as="span" color="green.500" ml={2}>
                  （发现新版本）
                </Text>
              ) : (
                <Text as="span" color="gray.400" ml={2}>
                  （已是最新）
                </Text>
              )}
            </Text>
            {result.releaseNotes && (
              <Text fontSize="xs" color="gray.500" whiteSpace="pre-wrap" noOfLines={4}>
                {result.releaseNotes}
              </Text>
            )}
            {result.hasUpdate && !downloaded && (
              <Button
                size="sm"
                leftIcon={<FiDownload />}
                colorScheme="brand"
                isLoading={downloading}
                onClick={() => void onDownload()}
                w="fit-content"
              >
                下载更新
              </Button>
            )}
            {downloading && (
              <Progress size="sm" colorScheme="brand" value={updatePercent} hasStripe isAnimated />
            )}
            {downloaded && (
              <Button
                size="sm"
                colorScheme="green"
                onClick={() => void backend.installUpdate()}
                w="fit-content"
              >
                重启并安装更新
              </Button>
            )}
          </Stack>
        )}
        {result?.error && (
          <Text fontSize="sm" color="orange.400">
            检查更新失败：{result.error}
          </Text>
        )}
      </Section>

      {/* 下载设置（PRD 4.4：默认下载路径 + 持久化） */}
      <Section title="下载设置">
        <Flex align="center" justify="space-between" gap={3} wrap="wrap">
          <HStack minW={0}>
            <Icon as={FiFolder} color="brand.500" />
            <Text fontSize="sm" isTruncated title={config?.downloadDir ?? ''}>
              {config?.downloadDir ?? '加载中…'}
            </Text>
          </HStack>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const dir = await chooseDir()
              if (dir) toast({ title: '下载目录已保存', status: 'success', duration: 2000, position: 'top' })
            }}
          >
            更改路径
          </Button>
        </Flex>
        <Text fontSize="xs" color="gray.400">
          路径保存至本地配置，下次启动自动读取
        </Text>
      </Section>

      {/* 数据恢复（PRD 6.3：手动恢复 resources.json / box.json） */}
      <Section title="数据恢复">
        <HStack>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FiUploadCloud />}
            onClick={() => void onRestore('resources')}
          >
            恢复资源数据
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FiUploadCloud />}
            onClick={() => void onRestore('box')}
          >
            恢复应用信息
          </Button>
        </HStack>
        <Text fontSize="xs" color="gray.400">
          恢复前会自动备份当前数据（backups/ 目录，最多保留 10 份）
        </Text>
      </Section>

      {/* 浏览器设置（PRD 4.4：仅 Android 端生效） */}
      <Section title="浏览器设置">
        <RadioGroup
          value={config?.androidBrowser ?? 'builtin'}
          isDisabled={platform !== 'android'}
          onChange={(v) => void useDownloadStore.getState().saveConfig({ androidBrowser: v as 'builtin' | 'system' })}
        >
          <Stack direction="row" spacing={6}>
            <Radio value="builtin">内置浏览器</Radio>
            <Radio value="system">系统浏览器</Radio>
          </Stack>
        </RadioGroup>
        <Text fontSize="xs" color="gray.400">
          {platform === 'android'
            ? '选择资源链接的打开方式'
            : '此选项仅 Android 端生效，桌面端使用内置浏览器'}
        </Text>
      </Section>
    </Box>
  )
}
