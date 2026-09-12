import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  SimpleGrid,
  Text,
  useDisclosure,
  VStack
} from '@chakra-ui/react'
import { FiBookOpen, FiCheck, FiChevronDown, FiChevronUp, FiFilter, FiSearch } from 'react-icons/fi'
import { useEffect, useMemo, useState } from 'react'
import type { Resource } from '../../../shared/types'
import EmptyState from '../components/EmptyState'
import ResourceCard from '../components/ResourceCard'
import ResourceDetailModal from '../components/ResourceDetailModal'
import GlassPullRefresh from '../components/GlassPullRefresh'
import { useDataStore } from '../store/dataStore'
import { useFavoritesStore } from '../store/favoritesStore'
import {
  ALL_CATEGORY,
  FAV_CATEGORY,
  SORT_MODES,
  buildCategoryTree,
  filterResources,
  normalizeSort,
  sortResources,
  type SortMode
} from '../utils/library'

const SORT_LS_KEY = 'pbox-lib-sort'

function readSort(): SortMode {
  if (typeof localStorage === 'undefined') return normalizeSort(undefined)
  try {
    return normalizeSort(JSON.parse(localStorage.getItem(SORT_LS_KEY) ?? 'null'))
  } catch {
    return normalizeSort(undefined)
  }
}

// 资源库（v2.0.0）：分类树/分类条 + 4 种排序 + 液态玻璃下拉刷新 + 居中详情弹窗
export default function LibraryPage() {
  const resources = useDataStore((s) => s.resources)
  const loaded = useDataStore((s) => s.loaded)
  const loading = useDataStore((s) => s.loading)
  const refreshData = useDataStore((s) => s.refresh)
  const [category, setCategory] = useState<string>(ALL_CATEGORY)
  const [keyword, setKeyword] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [sort, setSort] = useState<SortMode>(readSort)
  const [selected, setSelected] = useState<Resource | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()

  useEffect(() => {
    try {
      localStorage.setItem(SORT_LS_KEY, JSON.stringify(sort))
    } catch {
      // 持久化失败不影响功能
    }
  }, [sort])

  const favIds = useFavoritesStore((s) => s.ids)
  const tree = useMemo(() => {
    const base = buildCategoryTree(resources)
    // 收藏虚拟分类（有收藏时显示在「全部」之后）
    if (favIds.size > 0) {
      base.splice(1, 0, { name: FAV_CATEGORY, count: favIds.size })
    }
    return base
  }, [resources, favIds])
  const filtered = useMemo(() => {
    const base =
      category === FAV_CATEGORY
        ? resources.filter((r) => favIds.has(String(r.id)))
        : filterResources(resources, category, keyword)
    return sortResources(base, sort)
  }, [resources, category, keyword, sort, favIds])
  const sortLabel = SORT_MODES.find((m) => m.value === sort)?.label ?? '排序'

  const openDetail = (r: Resource): void => {
    setSelected(r)
    onOpen()
  }

  if (loaded && resources.length === 0) {
    return (
      <EmptyState
        icon={<FiBookOpen />}
        title="资源库为空"
        description="平台还没有发布资源，或当前处于离线模式"
      />
    )
  }

  // 窄屏（Android 竖屏等）：分类树隐藏，改用横向滚动分类条
  const categoryChips = (
    <Flex gap={2} overflowX="auto" pb={2} mb={2} sx={{ scrollbarWidth: 'none' }}>
      {tree.map((node) => (
        <Flex
          key={node.name}
          as="button"
          flexShrink={0}
          align="center"
          gap={1.5}
          px={3}
          py={1.5}
          rounded="full"
          fontSize="xs"
          borderWidth="1px"
          borderColor={category === node.name ? 'transparent' : 'pborder'}
          bg={category === node.name ? 'brand.500' : 'pinput'}
          color={category === node.name ? 'white' : 'ptextmuted'}
          onClick={() => setCategory(node.name)}
        >
          <Text noOfLines={1}>{node.name}</Text>
          <Text as="span" fontSize="2xs" opacity={0.7}>
            {node.count}
          </Text>
        </Flex>
      ))}
    </Flex>
  )

  return (
    <Flex h="full" minH={0}>
      {/* 左侧分类树（桌面/宽屏） */}
      <Box
        w="180px"
        flexShrink={0}
        borderRightWidth="1px"
        borderColor="pborder"
        p={3}
        overflowY="auto"
        className="pbox-blur-panel"
        display={{ base: 'none', md: 'block' }}
      >
        <Flex
          as="button"
          w="full"
          align="center"
          justify="space-between"
          px={2}
          py={1}
          rounded="md"
          color="ptextmuted"
          onClick={() => setCollapsed((c) => !c)}
          _hover={{ bg: 'hoverbg' }}
        >
          <Text fontSize="sm" fontWeight="bold">
            分类
          </Text>
          <Icon as={collapsed ? FiChevronDown : FiChevronUp} />
        </Flex>
        {!collapsed && (
          <VStack align="stretch" spacing={1} mt={2}>
            {tree.map((node) => (
              <Flex
                key={node.name}
                as="button"
                align="center"
                justify="space-between"
                px={3}
                py={2}
                rounded="md"
                fontSize="sm"
                bg={category === node.name ? 'brand.500' : 'transparent'}
                color={category === node.name ? 'white' : 'ptextmuted'}
                _hover={{
                  bg: category === node.name ? 'brand.500' : 'hoverbg',
                  color: category === node.name ? 'white' : 'ptext'
                }}
                onClick={() => setCategory(node.name)}
              >
                <Text noOfLines={1}>{node.name}</Text>
                <Badge colorScheme={category === node.name ? 'whiteAlpha' : 'gray'} borderRadius="full" px={2}>
                  {node.count}
                </Badge>
              </Flex>
            ))}
          </VStack>
        )}
      </Box>

      {/* 右侧：液态玻璃下拉刷新 + 搜索/排序 + 资源网格 */}
      <Box flex="1" minW={0} h="full">
        <GlassPullRefresh onRefresh={() => refreshData(true)}>
          <Box p={4} minH="100%">
            {/* 窄屏分类条 */}
            <Box display={{ base: 'block', md: 'none' }}>{categoryChips}</Box>

            <Flex gap={2} mb={4} align="center" flexWrap="wrap">
              <InputGroup size="sm" maxW="380px" flex={{ base: '1', md: 'initial' }} minW="180px">
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="var(--pbox-accent)" />
                </InputLeftElement>
                <Input
                  placeholder="搜索名称或简介…"
                  bg="pinput"
                  borderColor="pborder"
                  color="ptext"
                  _placeholder={{ color: 'ptextmuted' }}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </InputGroup>

                {/* 排序（v2.0.0：时间新旧 / 字母 AZ）
                    v2.1.0：菜单加实底 + 背景模糊——玻璃主题下原先 8% 透明白会透出下层文字 */}
                <Menu>
                  <MenuButton
                    as={Button}
                    size="sm"
                    variant="outline"
                    leftIcon={<FiFilter />}
                    rightIcon={<FiChevronDown />}
                    borderColor="pborder"
                    color="ptext"
                    _hover={{ bg: 'hoverbg' }}
                    flexShrink={0}
                    ml={{ base: 0, md: 'auto' }}
                  >
                    {sortLabel}
                  </MenuButton>
                  <MenuList
                    className="pbox-blur-panel"
                    bg="panelstrong"
                    borderColor="pborder"
                    boxShadow="0 12px 40px rgba(2,6,18,0.45)"
                  >
                    {SORT_MODES.map((m) => (
                      <MenuItem
                        key={m.value}
                        bg="transparent"
                        color={sort === m.value ? 'var(--pbox-accent)' : 'ptext'}
                        _hover={{ bg: 'hoverbg' }}
                        icon={sort === m.value ? <FiCheck /> : <Box w="14px" />}
                        onClick={() => setSort(m.value)}
                        fontSize="sm"
                      >
                        {m.label}
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>
            </Flex>

            {filtered.length > 0 ? (
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
                {filtered.map((r) => (
                  <ResourceCard key={String(r.id)} resource={r} onOpen={openDetail} />
                ))}
              </SimpleGrid>
            ) : (
              <EmptyState
                icon={<FiSearch />}
                title="没有匹配的资源"
                description="换个关键词或切换分类试试"
              />
            )}
          </Box>
        </GlassPullRefresh>
      </Box>

      {/* 居中液态玻璃详情弹窗（v2.0.0：分享项列表 + 完整介绍） */}
      <ResourceDetailModal resource={selected} isOpen={isOpen} onClose={onClose} />
    </Flex>
  )
}
