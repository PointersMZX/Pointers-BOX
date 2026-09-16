import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  ResponsiveValue,
  Skeleton,
  SimpleGrid,
  Text,
  VStack
} from '@chakra-ui/react'
import {
  FiBell,
  FiCheck,
  FiClock,
  FiColumns,
  FiDownload,
  FiExternalLink,
  FiGlobe,
  FiHome,
  FiLayers,
  FiLink,
  FiList,
  FiMaximize2,
  FiRefreshCw,
  FiStar
} from 'react-icons/fi'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
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
import { DUR, EASE } from '../theme/motion'
import type { Page } from '../../../shared/routes'

const LAYOUTS: HomeLayout[] = ['stacked', 'compact', 'wide']

// 布局语义（v2.2.0 修正）：
// - 堆叠：卡片重叠成 deck（同规格卡片叠放，顶部偏移露出层）
// - 紧凑：响应式密集网格，随窗口宽窄自动排布 2~3 列
// - 宽展：每张占满整行，间距放宽
const LAYOUT_META: Record<
  HomeLayout,
  {
    label: string
    icon: React.ComponentType<{ size?: number }>
    columns: number | ResponsiveValue
    spacing: number
  }
> = {
  stacked: {
    label: '堆叠',
    icon: FiLayers,
    columns: 1,
    spacing: 4
  },
  compact: {
    label: '紧凑',
    icon: FiColumns,
    // 响应式：窄屏 1 列、中屏 2 列、宽屏 3 列（随窗口自行调整）
    columns: { base: 1, sm: 2, xl: 3 },
    spacing: 3
  },
  wide: {
    label: '宽展',
    icon: FiMaximize2,
    columns: 1,
    spacing: 6
  }
}

// 密集布局（紧凑）的资源卡每行列数：随窗口宽窄自动 2~3 列
function resourceGridColumns(layout: HomeLayout): ResponsiveValue | number {
  if (layout === 'wide') return 1
  if (layout === 'compact') return { base: 1, sm: 2, xl: 3 }
  return 1
}

// ── 液态玻璃卡片容器 ─────────────────────────────────────────────
function GlassCard({
  icon,
  title,
  right,
  children,
  noPtr
}: {
  icon?: React.ReactNode
  title?: string
  right?: React.ReactNode
  children?: React.ReactNode
  noPtr?: boolean
}) {
  return (
    <Box
      data-no-ptr={noPtr ? true : undefined}
      bg="panel"
      borderWidth="1px"
      borderColor="pborder"
      borderRadius="lg"
      p={4}
      className="pbox-blur-panel"
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

// ── 堆叠 deck：全部卡片同规格重叠，顶部偏移露出层（非完全重合）────
// 当前"顶卡"可交互；轮转 = 顶卡移到栈底。用 transform 驱动换位（GPU 合成，不重排）
function StackedDeck({ cards }: { cards: React.ReactNode[] }) {
  const [active, setActive] = useState(0)
  const n = cards.length
  const offset = 16 // 层间距（px）
  const deckHeight = Math.max(n * offset + 160, 200)

  // 每张卡当前处于的层位（0=最顶）
  const posOf = (idx: number) => (idx - active + n) % n

  const layer = (idx: number) => {
    const pos = posOf(idx)
    const topCard = pos === 0
    return (
      <Box
        key={`layer-${idx}`}
        position="absolute"
        left="0"
        right="0"
        top="0"
        zIndex={n - pos}
        opacity={pos === 0 ? 1 : Math.max(0.15, 1 - pos * 0.22)}
        style={{
          transform: `translateY(${pos * offset}px) scale(${topCard ? 1 : 1 - pos * 0.015})`,
          transition: `transform ${DUR.slow}s ${EASE.out}, opacity ${DUR.slow}s ${EASE.out}`,
          pointerEvents: topCard ? 'auto' : 'none'
        }}
      >
        {cards[idx]}
      </Box>
    )
  }

  return (
    <Box position="relative" height={`${deckHeight}px`}>
      {Array.from({ length: n }, (_, i) => i).map(layer)}
      {/* 轮转：当前顶卡移到栈底（循环） */}
      {n > 1 && (
        <Flex
          position="absolute"
          right={4}
          bottom={4}
          zIndex={50}
          gap={2}
          align="center"
          bg="panelstrong"
          borderWidth="1px"
          borderColor="pborder"
          borderRadius="full"
          px={3}
          py={1}
          className="pbox-blur-panel"
          _hover={{ borderColor: 'brand.400' }}
        >
          <Text fontSize="2xs" color="ptextmuted">
            {active + 1}/{n} 张
          </Text>
          <Box
            as="button"
            type="button"
            aria-label="下一张卡片"
            color="ptextmuted"
            cursor="pointer"
            bg="transparent"
            border="none"
            display="flex"
            alignItems="center"
            _hover={{ color: 'brand.400' }}
            onClick={() => setActive((a) => (a + 1) % n)}
          >
            <FiRefreshCw size={13} />
          </Box>
        </Flex>
      )}
    </Box>
  )
}

// ── 布局切换：玻璃分段控件（选中滑块跟随 + 图标）────────────
function LayoutSwitcher({
  layout,
  onChange
}: {
  layout: HomeLayout
  onChange: (l: HomeLayout) => void
}) {
  return (
    <Box
      position="relative"
      bg="panel"
      borderWidth="1px"
      borderColor="pborder"
      borderRadius="full"
      p={1}
      className="pbox-blur-panel"
      role="radiogroup"
      aria-label="主页布局"
      _hover={{ borderColor: 'brand.400' }}
    >
      <motion.div
        aria-hidden
        position="absolute"
        top={2}
        bottom={2}
        borderRadius="full"
        bg="brand.500"
        opacity={0.18}
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        animate={{
          left: `${(LAYOUTS.indexOf(layout) / LAYOUTS.length) * 100}%`,
          width: `${100 / LAYOUTS.length}%`
        }}
        style={{ borderRadius: 999 }}
      />
      <Flex gap={0} position="relative" zIndex={1}>
        {LAYOUTS.map((l) => {
          const m = LAYOUT_META[l]
          const Icon = m.icon
          const active = l === layout
          return (
            <Box
              as="button"
              type="button"
              role="radio"
              aria-checked={active}
              title={m.label}
              key={l}
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={1.5}
              px={3.5}
              py={1.5}
              borderRadius="full"
              color={active ? 'brand.400' : 'ptextmuted'}
              fontSize="xs"
              fontWeight={active ? 'semibold' : 'normal'}
              cursor="pointer"
              bg="transparent"
              border="none"
              transition={`color ${DUR.fast}s ${EASE.out}`}
              onClick={() => onChange(l)}
              onFocusVisible={{ outline: '2px solid', outlineColor: 'brand.400' }}
            >
              <Icon size={13} />
              {m.label}
            </Box>
          )
        })}
      </Flex>
    </Box>
  )
}

// 首页（v2.2.0）：三布局 + 优先级卡片序列（时间置顶）
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
  const meta = LAYOUT_META[layout]

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

  // 随机推荐：紧凑=4 张（密集排），其他=2 张（减少占面积）
  const picksCountFor = (l: HomeLayout) => (l === 'compact' ? 4 : 2)

  // 数据首次到达（或离线恢复）时抽取一次推荐
  useEffect(() => {
    setPicks((prev) => {
      if (prev.length > 0) return prev
      const next = sampleUnique(resources, picksCountFor(layout))
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
    const next = sampleUniqueExcluding(resources, picksCountFor(layout), shownIds.current)
    if (next.length === 0) return
    shownIds.current = new Set(next.map((r) => r.id))
    setPicks(next)
  }

  const onPullRefresh = async (): Promise<void> => {
    await refreshData(true)
    const latest = useDataStore.getState().resources
    const next = sampleUniqueExcluding(latest, picksCountFor(layout), shownIds.current)
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

  // ── 区块构建（按优先级，时间置顶）─────────────────────────
  // 整宽卡：通栏设计的区块
  const fullCards: React.ReactNode[] = []
  // 半宽/网格卡：可并排的信息卡
  const halfCards: React.ReactNode[] = []

  // 1. 今日日期及时间（置顶）
  halfCards.push(
    <GlassCard
      key="date"
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
  )

  // 2. 随机资源推荐（紧凑=密集网格；其余少量，减小占面积）
  if (picks.length > 0) {
    fullCards.push(
      <Box key="picks">
        <Heading size="sm" color="ptext" mb={3}>
          今日推荐
          <Text as="span" fontSize="xs" color="ptextmuted" fontWeight="normal" ml={3}>
            {picks.length} 张
          </Text>
        </Heading>
        <SimpleGrid columns={resourceGridColumns(layout)} spacing={meta.spacing}>
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
      </Box>
    )
  } else if (resources.length > 0) {
    halfCards.push(
      <GlassCard key="picks-empty">
        <Text fontSize="sm" color="ptextmuted">
          推荐抽取中，点右上角「换一批」试试
        </Text>
      </GlassCard>
    )
  }

  // 3. 公告（不必整行：半宽卡，可与他卡并排）
  if (announcement) {
    halfCards.push(
      <GlassCard
        key="announcement"
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
    )
  }

  // 4. 我的资源链接
  if (links.length > 0) {
    halfCards.push(
      <GlassCard
        key="links"
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
    )
  }

  // 5. 版本更新日志
  if (versionLogs.length > 0) {
    halfCards.push(
      <GlassCard key="versionlogs" icon={<FiList color="var(--pbox-accent)" />} title="版本日志">
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
    )
  }

  // 6. 我的收藏横滑条（整宽）
  if (favResources.length > 0) {
    fullCards.push(
      <GlassCard
        key="favorites"
        icon={<FiStar color="var(--pbox-accent)" />}
        title="我的收藏"
        right={
          <Text fontSize="xs" color="ptextmuted">
            {favResources.length} 个
          </Text>
        }
      >
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
    )
  }

  // 7. 快捷功能入口
  halfCards.push(
    <GlassCard key="quick" icon={<FiExternalLink color="var(--pbox-accent)" />} title="快捷入口">
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
  )

  // 8. 网络 / 更新渠道状态
  halfCards.push(
    <GlassCard
      key="status"
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
  )

  // 9. 更新检查
  halfCards.push(
    <GlassCard key="update" icon={<FiDownload color="var(--pbox-accent)" />} title="检查更新">
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
  )

  // 堆叠 deck 用：所有卡（整宽 + 半宽）按序排，重叠
  const allCards = [...fullCards, ...halfCards]

  return (
    <GlassPullRefresh onRefresh={onPullRefresh}>
      <Box p={6}>
        {/* 标题栏 + 布局切换（玻璃分段控件） */}
        <Flex align="center" justify="space-between" mb={4} gap={3} flexWrap="wrap">
          <HStack spacing={3} flex="1" minW={0}>
            <Heading size="md" color="ptext">
              主页
            </Heading>
            <LayoutSwitcher layout={layout} onChange={(l) => void saveConfig({ homeLayout: l })} />
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

        {/* 堆叠：deck 重叠卡 */}
        {layout === 'stacked' ? (
          <StackedDeck cards={allCards} />
        ) : (
          // 紧凑（响应式 2~3 列）/ 宽展（单列通栏放宽）
          <SimpleGrid columns={meta.columns} spacing={meta.spacing} width="full">
            {layout === 'compact' ? (
              <>
                {/* 整宽卡跨全列 */}
                {fullCards.map((c) => (
                  <Box key={(c as React.ReactElement).key} gridColumn="1 / -1">
                    {c}
                  </Box>
                ))}
                {halfCards.map((c) => c)}
              </>
            ) : (
              [...fullCards, ...halfCards].map((c) => c)
            )}
          </SimpleGrid>
        )}

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
