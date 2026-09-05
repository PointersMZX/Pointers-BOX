import {
  Badge,
  Box,
  Button,
  Collapse,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  NumberInput,
  NumberInputField,
  Progress,
  Radio,
  RadioGroup,
  SimpleGrid,
  Stack,
  Text,
  useDisclosure,
  useToast,
  VStack
} from '@chakra-ui/react'
import {
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiFolder,
  FiRefreshCw,
  FiUploadCloud
} from 'react-icons/fi'
import { useEffect, useState } from 'react'
import type { UpdateCheckResult } from '../../../shared/types'
import {
  ACCENT_PRESETS,
  canCustomizeAccent,
  DEFAULT_ACCENT,
  hexToRgb,
  rgbToHex,
  THEME_KEYS
} from '../../../shared/theme'
import type { ThemeKey } from '../../../shared/theme'
import { useDataStore } from '../store/dataStore'
import { useDownloadStore } from '../store/downloadStore'
import { useThemeStore } from '../store/themeStore'
import { useUiStore } from '../store/uiStore'
import { backend } from '../platform'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      bg="panel"
      borderWidth="1px"
      borderColor="pborder"
      rounded="lg"
      p={5}
      mb={4}
      className="pbox-blur-panel"
    >
      <Heading size="sm" mb={3} color="ptext">
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
      <Text w="88px" flexShrink={0} color="ptextmuted">
        {label}
      </Text>
      <Text color="ptext" wordBreak="break-all">
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
        <Text fontSize="sm" color="ptextmuted" whiteSpace="pre-wrap" wordBreak="break-all">
          {text || empty}
        </Text>
      </Collapse>
      <Button
        size="xs"
        variant="ghost"
        leftIcon={isOpen ? <FiChevronUp /> : <FiChevronDown />}
        onClick={onToggle}
      >
        {isOpen ? '收起' : '展开阅读'}
      </Button>
    </Box>
  )
}

// ── 主题外观（纯外观功能，不影响任何业务逻辑） ──────────────────

const THEME_LABELS: Record<ThemeKey, string> = {
  glass: '液态玻璃',
  black: '纯黑',
  white: '纯白'
}

function ThemePreview({ themeKey }: { themeKey: ThemeKey }) {
  if (themeKey === 'glass') {
    return (
      <Box
        h="64px"
        rounded="md"
        mb={2}
        bg="linear-gradient(135deg, #16305a 0%, #274b82 55%, #0d9488 130%)"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute"
          left="8%"
          top="18%"
          w="28%"
          h="64%"
          rounded="md"
          bg="rgba(255,255,255,0.16)"
          style={{ backdropFilter: 'blur(4px)' }}
        />
        <Box
          position="absolute"
          left="42%"
          top="30%"
          w="46%"
          h="40%"
          rounded="md"
          bg="rgba(255,255,255,0.10)"
        />
        <Box position="absolute" right="8%" bottom="12%" w="14%" h="14%" rounded="full" bg="var(--pbox-accent)" />
      </Box>
    )
  }
  const dark = themeKey === 'black'
  return (
    <Box h="64px" rounded="md" mb={2} bg={dark ? '#000000' : '#ffffff'} borderWidth="1px" borderColor={dark ? '#232323' : '#e6e6e6'} position="relative" overflow="hidden">
      <Box position="absolute" left="0" top="0" w="26%" h="100%" bg={dark ? '#0a0a0a' : '#f5f5f5'} />
      <Box position="absolute" left="32%" top="18%" w="56%" h="22%" rounded="sm" bg={dark ? '#161616' : '#ececec'} />
      <Box position="absolute" left="32%" top="50%" w="38%" h="22%" rounded="sm" bg={dark ? '#161616' : '#ececec'} />
      <Box position="absolute" right="8%" bottom="12%" w="14%" h="14%" rounded="full" bg="#3182ce" />
    </Box>
  )
}

function ThemeSection() {
  const themeKey = useThemeStore((s) => s.themeKey)
  const accent = useThemeStore((s) => s.accent)
  const setAppearance = useThemeStore((s) => s.setAppearance)
  const canCustom = canCustomizeAccent(themeKey)
  const rgb = hexToRgb(accent) ?? hexToRgb(DEFAULT_ACCENT)!

  const setChannel = (ch: 'r' | 'g' | 'b', v: number): void => {
    if (!Number.isFinite(v)) return
    const next = { ...rgb, [ch]: Math.min(255, Math.max(0, Math.round(v))) }
    setAppearance('glass', rgbToHex(next.r, next.g, next.b))
  }

  return (
    <Section title="主题外观">
      <Text fontSize="xs" color="ptextmuted">
        主题仅改变外观，不影响任何功能；默认启用「液态玻璃」
      </Text>
      <SimpleGrid columns={3} spacing={3}>
        {THEME_KEYS.map((k) => {
          const active = themeKey === k
          return (
            <Box
              key={k}
              as="button"
              onClick={() => setAppearance(k)}
              rounded="xl"
              borderWidth="2px"
              borderColor={active ? 'brand.500' : 'pborder'}
              p={3}
              textAlign="left"
              className="pbox-morph"
              position="relative"
              _hover={{ borderColor: active ? 'brand.400' : 'ptextmuted' }}
            >
              <ThemePreview themeKey={k} />
              <Flex align="center" justify="space-between">
                <Text fontSize="sm" fontWeight={active ? 'bold' : 'normal'} color="ptext">
                  {THEME_LABELS[k]}
                </Text>
                {active && (
                  <Icon as={FiCheck} color="brand.400" />
                )}
              </Flex>
              {k === 'glass' && (
                <Badge position="absolute" right={2} top={2} colorScheme="brand" fontSize="9px">
                  可自定义颜色
                </Badge>
              )}
            </Box>
          )
        })}
      </SimpleGrid>

      {canCustom ? (
        <Box pt={2} borderTopWidth="1px" borderTopColor="pborder">
          <Text fontSize="sm" fontWeight="semibold" color="ptext" mb={2}>
            主题颜色
          </Text>
          <HStack spacing={2} mb={3} wrap="wrap">
            {ACCENT_PRESETS.map((c) => (
              <Box
                key={c}
                as="button"
                aria-label={`选择颜色 ${c}`}
                w="26px"
                h="26px"
                rounded="full"
                bg={c}
                borderWidth="2px"
                borderColor={accent === c ? 'ptext' : 'transparent'}
                className="pbox-morph"
                onClick={() => setAppearance('glass', c)}
              />
            ))}
          </HStack>
          <HStack align="center" spacing={3} wrap="wrap">
            <Box w="72px" h="32px" rounded="md" bg={accent} borderWidth="1px" borderColor="pborder" className="pbox-pulse" />
            {(['r', 'g', 'b'] as const).map((ch) => (
              <HStack key={ch} spacing={1}>
                <Text fontSize="xs" color="ptextmuted" textTransform="uppercase">
                  {ch}
                </Text>
                <NumberInput
                  size="sm"
                  min={0}
                  max={255}
                  w="72px"
                  value={rgb[ch]}
                  onChange={(_, v) => setChannel(ch, v)}
                >
                  <NumberInputField bg="pinput" borderColor="pborder" color="ptext" />
                </NumberInput>
              </HStack>
            ))}
            <Input
              size="sm"
              w="104px"
              value={accent}
              bg="pinput"
              borderColor="pborder"
              color="ptext"
              spellCheck={false}
              onChange={(e) => {
                const v = e.target.value.trim()
                if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) {
                  setAppearance('glass', v)
                }
              }}
            />
          </HStack>
        </Box>
      ) : (
        <Text fontSize="xs" color="ptextmuted">
          仅「液态玻璃」主题支持自定义颜色；切换到液态玻璃后可挑选预设色或用 RGB 自定义
        </Text>
      )}
    </Section>
  )
}

// 设置（PRD 4.4）：主题外观 / 关于应用 / 检查更新 / 下载设置 / 浏览器设置 / 数据恢复
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
      <Heading size="md" mb={4} color="ptext">
        设置
      </Heading>

      {/* 主题外观（新增：液态玻璃/纯黑/纯白，仅玻璃可自定义颜色） */}
      <ThemeSection />

      {/* 关于应用（合并区块，PRD 4.4） */}
      <Section title="关于应用">
        <Row label="应用名称" value={box?.app_name ?? 'Pointers-BOX'} />
        <Row label="应用版本" value={box?.app_version ?? 'Version 2.0.0 Beta'} />
        <Row label="开发者" value={box?.developer} />
        <Row label="社区 QQ 群" value={box?.community_qq} />
        <Row label="联合出品" value={box?.general_key} />
        <Box>
          <Text fontSize="sm" color="ptextmuted" mb={1}>
            应用简介
          </Text>
          <ExpandableText text={box?.app_introduction ?? ''} empty="暂未获取到应用简介" />
        </Box>
        <Box>
          <Text fontSize="sm" color="ptextmuted" mb={1}>
            作者有话说
          </Text>
          <ExpandableText text={authorWords?.content ?? ''} empty="暂未获取到作者有话说" />
        </Box>
        <Row label="版权声明" value={box?.copyright} />
      </Section>

      {/* 检查更新（PRD 4.4：GitHub Release 对比） */}
      <Section title="更新检查">
        <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
          <Text fontSize="sm" color="ptextmuted">
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
            <Text fontSize="sm" color="ptext">
              最新版本：
              <Text as="span" fontWeight="bold">
                {result.latest ?? '未知'}
              </Text>
              {result.hasUpdate ? (
                <Text as="span" color="green.400" ml={2}>
                  （发现新版本）
                </Text>
              ) : (
                <Text as="span" color="ptextmuted" ml={2}>
                  （已是最新）
                </Text>
              )}
            </Text>
            {result.releaseNotes && (
              <Text fontSize="xs" color="ptextmuted" whiteSpace="pre-wrap" noOfLines={4}>
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
          <Text fontSize="sm" color="orange.300">
            检查更新失败：{result.error}
          </Text>
        )}
      </Section>

      {/* 下载设置（PRD 4.4：默认下载路径 + 持久化） */}
      <Section title="下载设置">
        <Flex align="center" justify="space-between" gap={3} wrap="wrap">
          <HStack minW={0}>
            <Icon as={FiFolder} color="brand.400" />
            <Text fontSize="sm" color="ptext" isTruncated title={config?.downloadDir ?? ''}>
              {config?.downloadDir ?? '加载中…'}
            </Text>
          </HStack>
          <Button
            size="sm"
            variant="outline"
            borderColor="pborder"
            color="ptext"
            _hover={{ bg: 'hoverbg' }}
            onClick={async () => {
              const dir = await chooseDir()
              if (dir) toast({ title: '下载目录已保存', status: 'success', duration: 2000, position: 'top' })
            }}
          >
            更改路径
          </Button>
        </Flex>
        <Text fontSize="xs" color="ptextmuted">
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
            borderColor="pborder"
            color="ptext"
            _hover={{ bg: 'hoverbg' }}
            onClick={() => void onRestore('resources')}
          >
            恢复资源数据
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FiUploadCloud />}
            borderColor="pborder"
            color="ptext"
            _hover={{ bg: 'hoverbg' }}
            onClick={() => void onRestore('box')}
          >
            恢复应用信息
          </Button>
        </HStack>
        <Text fontSize="xs" color="ptextmuted">
          恢复前会自动备份当前数据（backups/ 目录，最多保留 10 份）
        </Text>
      </Section>

      {/* 浏览器设置（PRD 4.4：仅 Android 端生效） */}
      <Section title="浏览器设置">
        <RadioGroup
          value={config?.androidBrowser ?? 'builtin'}
          isDisabled={platform !== 'android'}
          onChange={(v) =>
            void useDownloadStore.getState().saveConfig({ androidBrowser: v as 'builtin' | 'system' })
          }
        >
          <Stack direction="row" spacing={6}>
            <Radio value="builtin">内置浏览器</Radio>
            <Radio value="system">系统浏览器</Radio>
          </Stack>
        </RadioGroup>
        <Text fontSize="xs" color="ptextmuted">
          {platform === 'android'
            ? '选择资源链接的打开方式'
            : '此选项仅 Android 端生效，桌面端使用内置浏览器'}
        </Text>
      </Section>
    </Box>
  )
}
