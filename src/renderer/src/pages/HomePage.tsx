import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Progress,
  Radio,
  RadioGroup,
  Skeleton,
  SimpleGrid,
  Stack,
  Text,
  VStack
} from '@chakra-ui/react'
import {
  FiBell,
  FiCheck,
  FiClock,
  FiDownload,
  FiExternalLink,
  FiGlobe,
  FiHome,
  FiLink,
  FiList,
  FiRefreshCw,
  FiStar,
  FiZap
} from 'react-icons/fi'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { HomeLayout, Resource, UpdateCheckResult } from '../../../shared/types'
import { backend, openClaim } from '../platform'
import EmptyState from '../components/EmptyState'
import GlassButton from '../components/GlassButton'
import GlassPullRefresh from '../components/GlassPullRefresh'
import { CardGridSkeleton } from '../components/Skeletons'
import ResourceCard from '../components/ResourceCard'
import ResourceDetailModal from '../components/ResourceDetailModal'
import { useDataStore } from '../store/dataStore'
import { useDownloadStore } from '../store/downloadStore'
import { useFavoritesStore } from '../store/favoritesStore'
import { useLinksStore } from '../store/linksStore'
import { useUiStore } from '../store/uiStore'
import { sampleUnique, sampleUniqueExcluding } from '../utils/recommend'
import type { Page } from '../../../shared/routes'

const LAYOUTS: HomeLayout[] = ['stacked', 'compact', 'wide']

const LAYOUT_LABELS: Record<HomeLayout, string> = {
  stacked: '堆叠',
  compact: '紧凑',
  wide: '宽展'
}

// 卡片网格列数：紧凑=每行 2 个；宽展=每行 1 个（堆叠不分格，纵向通栏）
function gridColumns(layout: HomeLayout) {
  if (layout === 'wide') return 1
  return { base: 1, sm: 2 }
}

// ── 局部小卡片容器（液态玻璃形制，可点击） ─────────────────────
function GlassCard({
  icon,
  title,
  right,
  children,
  onOpen,
  noPtr
}: {
  icon?: React.ReactNode
  title?: string
  right?: React.ReactNode
  children?: React.ReactNode
  onOpen?: () => void
  noPtr?: boolean
}) {
  const interactive = onOpen ? ({ cursor: 'pointer' } as const) : {}
  return (
    <Box
      data-no-ptr={noPtr ? true : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen()
              }
            }
          : undefined
      }
      onClick={onOpen ? () => onOpen() : undefined}
      bg="panel"
      borderWidth="1px"
      borderColor="pborder"
      borderRadius="lg"
      p={4}
      className="pbox-blur-panel"
      _hover={onOpen ? { borderColor: 'brand.400', bg: 'panelstrong' } : undefined}
      style={interactive}
    >
      {(title || right) && (
        <Flex align="center" justify="space-between" mb={2} gap={2}>
          <HStack spacing={2} flex="1" minW={0}>
            {icon}
            {title && (
              <Heading size="sm" color="ptext" noOfLines={1}>
                {title}
              </Heading>
            )}
          </HStack>
          {right}
        </Flex>
      )}
      {children}
    </Box>
  )
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

// 首页（v2.2.0）：三布局 + 优先级卡片序列
export default function HomePage() {
  const resources = useDataStore((s) => s.resources)
  const announcement = useDataStore((s) => s.announcement)
  const versionLogs = useDataStore((s) => s.versionLogs)
  const offline = useDataStore((s) => s.offline)
  const loaded = useDataStore((s) => s.loaded)
  const loading = useDataStore((s) => s.loading)
  const refreshData = useDataStore((s) => s.refresh)

  const config = useDownloadStore((s) => s.config)
  const loadConfig = useDownloadStore((s) => s.loadConfig)
  const layout: HomeLayout = config?.homeLayout ?? 'compact'
  const saveConfig = useDownloadStore((s) => s.saveConfig)

  const links = useLinksStore((s) => s.links)
  const loadLinks = useLinksStore((s) => s.load)

  const [picks, setPicks] = useState<Resource[]>([])
  const [selected, setSelected] = useState<Resource | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [favDetail, setFavDetail] = useState<Resource | null>(null)
  const shownIds = useRef<Set<string | number>>(new Set())

  const favIds = useFavoritesStore((s) => s.ids)
  const favResources = useMemo(
    () => resources.filter((r) => favIds.has(String(r.id))),
    [resources, favIds]
  )

  // 更新检查卡片
  const [checking, setChecking] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)

  // 数据首次到达（或离线恢复）时抽取一次推荐
  useEffect(() => {
    setPicks((prev) => {
      if (prev.length > 0) return prev
      const next = sampleUnique(resources, layout === 'stacked' ? 4 : 3)
      shownIds.current = new Set(next.map((r) => r.id))
      return next
    })
  }, [resources, layout])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])
  useEffect(() => {
    void loadLinks()
  }, [loadLinks])

  const reshuffle = (): void => {
    const n = layout === 'stacked' ? 4 : 3
    const next = sampleUniqueExcluding(resources, n, shownIds.current)
    if (next.length === 0) return
    shownIds.current = new Set(next.map((r) => r.id))
    setPicks(next)
  }

  const onPullRefresh = async (): Promise<void> => {
    await refreshData(true)
    const latest = useDataStore.getState().resources
    const n = layout === 'stacked' ? 4 : 3
    const next = sampleUniqueExcluding(latest, n, shownIds.current)
    if (next.length > 0) {
      shownIds.current = new Set(next.map((r) => r.id))
      setPicks(next)
    }
  }

  const runCheckUpdate = async (): Promise<void> => {
    setChecking(true)
    try {
      setUpdateResult(await backend.checkUpdate())
    } finally {
      setChecking(false)
    }
  }

  const now = useNow()
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(
    now.getDate()
  ).padStart(2, '0')}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const weekday = '日一二三四五六'[now.getDay()]

  const setPage = useUiStore((s) => s.setPage)

  if (!loaded && loading) {
    return (
      <Box p={6}>
        <Skeleton height="24px" width="120px" mb={4} />
        <CardGridSkeleton />
      </Box>
    )
  }

  const picksCount = layout === 'stacked' ? 4 : 3

  // 资源卡网格（推荐 + 收藏共用，按布局定列数；堆叠=通栏单列纵向堆叠）
  const renderPicks = () => (
    <SimpleGrid columns={gridColumns(layout)} spacing={4}>
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
  )

  return (
    <GlassPullRefresh onRefresh={onPullRefresh}>
      <Box p={6}>
        {/* 标题栏 + 布局切换 */}
        <Flex align="center" justify="space-between" mb={4} gap={3} flexWrap="wrap">
          <HStack spacing={3} flex="1" minW={0}>
            <Heading size="md" color="ptext">
              主页
            </Heading>
            <RadioGroup
              value={layout}
              size="sm"
              colorScheme="brand"
              onChange={(v) => void saveConfig({ homeLayout: v as HomeLayout })}
            >
              <Stack direction="row" spacing={2}>
                {LAYOUTS.map((l) => (
                  <Radio
                    key={l}
                    value={l}
                    fontSize="xs"
                    color={layout === l ? 'brand.400' : 'ptextmuted'}
                  >
                    {LAYOUT_LABELS[l]}
                  </Radio>
                ))}
              </Stack>
            </RadioGroup>
          </HStack>
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
            换一批
          </Button>
        </Flex>

        {/* 卡片按优先级序列渲染（堆叠=纵向堆叠不分格，其余=按布局网格） */}
        <VStack spacing={4} align="stretch" width="full">
          {/* 1. 公告 */}
          {announcement && (
            <GlassCard
              icon={<FiBell color="var(--pbox-accent)" />}
              title="公告"
              right={
                <Text fontSize="xs" color="ptextmuted" noOfLines={1}>
                  {announcement.date}
                </Text>
              }
            >
              <Text fontSize="sm" color="ptextmuted" whiteSpace="pre-wrap">
                {announcement.content}
              </Text>
            </GlassCard>
          )}

          {/* 2. 随机资源推荐 */}
          {picks.length > 0 ? (
            <Box>
              <Heading size="sm" color="ptext" mb={3}>
                今日推荐
                <Text as="span" fontSize="xs" color="ptextmuted" fontWeight="normal" ml={3}>
                  {picksCount} 张
                </Text>
              </Heading>
              {renderPicks()}
            </Box>
          ) : resources.length > 0 ? (
            <GlassCard>
              <Text fontSize="sm" color="ptextmuted">
                推荐抽取中，点右上角「换一批」试试
              </Text>
            </GlassCard>
          ) : null}

          {/* 3. 我的资源链接 */}
          {links.length > 0 && (
            <GlassCard
              icon={<FiLink color="var(--pbox-accent)" />}
              title="我的资源链接"
              right={
                <HStack spacing={2}>
                  <Text fontSize="xs" color="ptextmuted">
                    {links.length} 条
                  </Text>
                  <GlassButton size="sm" variant="ghost" ariaLabel="管理链接" onClick={() => setPage('links')}>
                    管理
                  </GlassButton>
                </HStack>
              }
            >
              <VStack align="stretch" spacing={1.5}>
                {links.slice(0, 3).map((l) => (
                  <Flex
                    key={l.id}
                    align="center"
                    justify="space-between"
                    gap={3}
                    as="button"
                    fontSize="sm"
                    color="ptext"
                    bg="transparent"
                    _hover={{ bg: 'hoverbg' }}
                    px={2}
                    py={1}
                    rounded="md"
                    onClick={(e) => {
                      e.stopPropagation()
                      void openClaim(l.url)
                    }}
                  >
                    <Text noOfLines={1} flex="1">
                      {l.name}
                    </Text>
                    <Text fontSize="2xs" color="ptextmuted" noOfLines={1} maxW="40%">
                      {l.url}
                    </Text>
                  </Flex>
                ))}
                {links.length > 3 && (
                  <Text fontSize="xs" color="ptextmuted">
                    等 {links.length} 条，点「管理」查看全部
                  </Text>
                )}
              </VStack>
            </GlassCard>
          )}

          {/* 4. 今日日期及时间（精确到分） */}
          <GlassCard
            icon={<FiClock color="var(--pbox-accent)" />}
            title="今日"
            right={
              <Text fontSize="xs" color="ptextmuted">
                {weekday}
              </Text>
            }
          >
            <HStack spacing={4}>
              <Text fontSize="lg" color="ptext" fontWeight="bold" letterSpacing={1}>
                {dateStr}
              </Text>
              <Text fontSize="lg" color="var(--pbox-accent)" fontWeight="bold">
                {timeStr}
              </Text>
            </HStack>
          </GlassCard>

          {/* 5. 版本更新日志（boxbbgxrz.json 独立文件） */}
          {versionLogs.length > 0 && (
            <GlassCard icon={<FiList color="var(--pbox-accent)" />} title="版本日志">
              <VStack align="stretch" spacing={2}>
                {versionLogs.slice(0, 2).map((v) => (
                  <Flex key={v.version} align="flex-start" gap={2}>
                    <Badge colorScheme="brand" variant="subtle" borderRadius="full" flexShrink={0}>
                      {v.version}
                    </Badge>
                    <Text fontSize="sm" color="ptextmuted" whiteSpace="pre-wrap" noOfLines={4}>
                      {v.log}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            </GlassCard>
          )}

          {/* 6. 我的收藏横滑条 */}
          {favResources.length > 0 && (
            <GlassCard icon={<FiStar color="var(--pbox-accent)" />} title="我的收藏" right={<Text fontSize="xs" color="ptextmuted">{favResources.length} 个</Text>}>
              <Flex gap={3} overflowX="auto" sx={{ scrollbarWidth: 'none' }}>
                {favResources.slice(0, 8).map((r) => (
                  <Box
                    key={String(r.id)}
                    flexShrink={0}
                    w="190px"
                    bg="panelstrong"
                    borderWidth="1px"
                    borderColor="pborder"
                    borderRadius="md"
                    p={3}
                    cursor="pointer"
                    className="pbox-morph"
                    _hover={{ borderColor: 'brand.400' }}
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
            </GlassCard>
          )}

          {/* 7. 快捷功能入口 */}
          <GlassCard icon={<FiZap color="var(--pbox-accent)" />} title="快捷入口">
            <Flex gap={3} flexWrap="wrap">
              {[
                { label: '资源库', page: 'library' as Page, Icon: FiGlobe },
                { label: '链接', page: 'links' as Page, Icon: FiLink },
                { label: '浏览器', page: 'browser' as Page, Icon: FiExternalLink },
                { label: '下载', page: 'downloads' as Page, Icon: FiDownload }
              ].map((q) => (
                <GlassButton
                  key={q.page}
                  size="sm"
                  variant="ghost"
                  ariaLabel={q.label}
                  onClick={() => setPage(q.page)}
                >
                  <q.Icon /> {q.label}
                </GlassButton>
              ))}
            </Flex>
          </GlassCard>

          {/* 8. 网络 / 更新渠道状态 */}
          <GlassCard
            icon={<FiGlobe color={offline ? 'orange.300' : 'var(--pbox-accent)'} />}
            title="数据状态"
            right={
              <Badge
                colorScheme={offline ? 'orange' : 'green'}
                variant="subtle"
                borderRadius="full"
                fontSize="2xs"
              >
                {offline ? '离线' : '在线'}
              </Badge>
            }
          >
            <Text fontSize="sm" color="ptextmuted">
              更新渠道：
              <Text as="span" color="ptext">
                {config?.updateChannel === 'github' ? '全球官方（GitHub）' : '国内镜像（Gitee）'}
              </Text>
              {offline && '（远程暂不可达，展示本地缓存）'}
            </Text>
          </GlassCard>

          {/* 9. 更新检查卡片 */}
          <GlassCard icon={<FiDownload color="var(--pbox-accent)" />} title="检查更新">
            <Flex align="center" justify="space-between" gap={3} wrap="wrap">
              <Text fontSize="sm" color="ptextmuted">
                {updateResult
                  ? updateResult.hasUpdate
                    ? `发现新版本 v${updateResult.latest}`
                    : '已是最新版本'
                  : '点右侧按钮检查是否有新版本'}
              </Text>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<FiCheck />}
                isLoading={checking}
                borderColor="pborder"
                color="ptext"
                _hover={{ bg: 'hoverbg' }}
                onClick={() => void runCheckUpdate()}
              >
                检查
              </Button>
            </Flex>
          </GlassCard>
        </VStack>

        {/* 无资源且离线时的空态 */}
        {picks.length === 0 && resources.length === 0 && (
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
    </GlassPullRefresh>
  )
}

