import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Text,
  useDisclosure,
  VStack
} from '@chakra-ui/react'
import { FiBookOpen, FiChevronDown, FiChevronUp, FiExternalLink, FiSearch } from 'react-icons/fi'
import { useMemo, useState } from 'react'
import type { Resource } from '../../../shared/types'
import EmptyState from '../components/EmptyState'
import ResourceCard from '../components/ResourceCard'
import { useDataStore } from '../store/dataStore'
import { openClaim } from '../platform'
import { ALL_CATEGORY, buildCategoryTree, filterResources } from '../utils/library'

// 资源库（PRD 4.1）：分类树 + 3 列资源网格 + 实时搜索 + 详情抽屉
export default function LibraryPage() {
  const resources = useDataStore((s) => s.resources)
  const loaded = useDataStore((s) => s.loaded)
  const [category, setCategory] = useState<string>(ALL_CATEGORY)
  const [keyword, setKeyword] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [selected, setSelected] = useState<Resource | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const tree = useMemo(() => buildCategoryTree(resources), [resources])
  const filtered = useMemo(
    () => filterResources(resources, category, keyword),
    [resources, category, keyword]
  )

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

  return (
    <Flex h="full" minH={0}>
      {/* 左侧分类树 */}
      <Box
        w="180px"
        flexShrink={0}
        borderRightWidth="1px"
        borderColor="pborder"
        p={3}
        overflowY="auto"
        className="pbox-blur-panel"
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
                _hover={{ bg: category === node.name ? 'brand.500' : 'hoverbg', color: category === node.name ? 'white' : 'ptext' }}
                onClick={() => setCategory(node.name)}
              >
                <Text noOfLines={1}>{node.name}</Text>
                <Badge
                  colorScheme={category === node.name ? 'whiteAlpha' : 'gray'}
                  borderRadius="full"
                  px={2}
                >
                  {node.count}
                </Badge>
              </Flex>
            ))}
          </VStack>
        )}
      </Box>

      {/* 右侧资源网格 */}
      <Box flex="1" minW={0} p={4} overflowY="auto">
        <InputGroup size="sm" mb={4} maxW="420px">
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

        {filtered.length > 0 ? (
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
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

      {/* 详情抽屉（PRD 4.1：展示完整信息和所有平台链接） */}
      <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            <VStack align="start" spacing={2}>
              <Text>{selected?.name}</Text>
              <HStack spacing={2}>
                {selected && <Badge colorScheme="blue">{selected.category}</Badge>}
                {selected?.release_date && (
                  <Text fontSize="xs" color="gray.400">
                    发布：{selected.release_date}
                  </Text>
                )}
                {selected?.last_modified && (
                  <Text fontSize="xs" color="gray.400">
                    修改：{selected.last_modified}
                  </Text>
                )}
              </HStack>
            </VStack>
          </DrawerHeader>
          <DrawerBody>
            <Text fontSize="sm" color="ptextmuted" whiteSpace="pre-wrap">
              {selected?.introduction || '暂无简介'}
            </Text>
            <Divider my={4} />
            <Text fontSize="sm" fontWeight="bold" mb={2} color="ptext">
              平台链接
            </Text>
            <VStack align="stretch" spacing={2}>
              {selected?.links.map((link, i) => (
                <Button
                  key={`${link}-${i}`}
                  size="sm"
                  leftIcon={<FiExternalLink />}
                  variant="outline"
                  justifyContent="flex-start"
                  onClick={() => openClaim(link)}
                >
                  <Text isTruncated maxW="100%">
                    {link}
                  </Text>
                </Button>
              ))}
            </VStack>
          </DrawerBody>
          <DrawerFooter>
            <Button size="sm" onClick={onClose}>
              关闭
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Flex>
  )
}
