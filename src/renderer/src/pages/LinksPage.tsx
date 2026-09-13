import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  VStack,
  useDisclosure,
  useToast
} from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import {
  FiEdit2,
  FiExternalLink,
  FiPlus,
  FiSave,
  FiTrash2,
  FiUploadCloud,
  FiDownload
} from 'react-icons/fi'
import type { UserLink } from '../../../shared/types'
import EmptyState from '../components/EmptyState'
import GlassButton from '../components/GlassButton'
import { useLinksStore } from '../store/linksStore'
import { useUiStore } from '../store/uiStore'

interface LinkForm {
  name: string
  url: string
  remark: string
}

const EMPTY_FORM: LinkForm = { name: '', url: '', remark: '' }

// 链接管理（v2.2.0）：用户自建分享链接，仅存本地
export default function LinksPage() {
  const platform = useUiStore((s) => s.platform)
  const links = useLinksStore((s) => s.links)
  const load = useLinksStore((s) => s.load)
  const save = useLinksStore((s) => s.save)
  const importLinks = useLinksStore((s) => s.importLinks)
  const exportLinks = useLinksStore((s) => s.exportLinks)
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<LinkForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserLink | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    void load()
  }, [load])

  const openForm = (link?: UserLink): void => {
    setEditingId(link?.id ?? null)
    setForm(link ? { name: link.name, url: link.url, remark: link.remark } : EMPTY_FORM)
    setFormOpen(true)
  }

  const saveForm = async (): Promise<void> => {
    const name = form.name.trim()
    const url = form.url.trim()
    if (name === '') {
      toast({ title: '请填写链接名称', status: 'warning', duration: 2500, position: 'top' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({
        title: '链接需以 http:// 或 https:// 开头',
        status: 'warning',
        duration: 2500,
        position: 'top'
      })
      return
    }
    const next: UserLink = editingId
      ? {
          ...(links.find((l) => l.id === editingId) as UserLink),
          name,
          url,
          remark: form.remark.trim()
        }
      : {
          id: `ul-${Date.now()}`,
          name,
          url,
          remark: form.remark.trim(),
          createdAt: Date.now()
        }
    const rest = links.filter((l) => l.id !== next.id)
    await save([...rest, next].sort((a, b) => b.createdAt - a.createdAt))
    setFormOpen(false)
    toast({
      title: editingId ? '链接已更新' : '链接已添加',
      status: 'success',
      duration: 2000,
      position: 'top'
    })
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    await save(links.filter((l) => l.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast({ title: '链接已删除', status: 'info', duration: 2000, position: 'top' })
  }

  const onImport = async (): Promise<void> => {
    const result = await importLinks()
    if (result === null) {
      toast({ title: '已取消导入或文件无效', status: 'info', duration: 3000, position: 'top' })
      return
    }
    toast({
      title: `导入完成：新增 ${result.added} 条${result.skipped > 0 ? `（跳过 ${result.skipped} 条重复）` : ''}`,
      status: 'success',
      duration: 3500,
      position: 'top'
    })
  }

  const onExport = async (): Promise<void> => {
    if (links.length === 0) {
      toast({ title: '还没有可导出的链接', status: 'info', duration: 2500, position: 'top' })
      return
    }
    const path = await exportLinks()
    toast({
      title: path ? `已导出：${path}` : '已取消导出',
      status: path ? 'success' : 'info',
      duration: 4000,
      position: 'top'
    })
  }

  const openLink = (url: string): void => {
    void import('../platform').then(({ openClaim }) => openClaim(url))
  }

  return (
    <Box p={6}>
      <Flex align="center" justify="space-between" mb={4} wrap="wrap" gap={3}>
        <Heading color="ptext" size="md">
          我的链接
        </Heading>
        <HStack spacing={2}>
          {platform === 'desktop' && (
            <>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<FiUploadCloud />}
                borderColor="pborder"
                color="ptext"
                _hover={{ bg: 'hoverbg' }}
                onClick={() => void onImport()}
              >
                导入
              </Button>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<FiDownload />}
                borderColor="pborder"
                color="ptext"
                _hover={{ bg: 'hoverbg' }}
                onClick={() => void onExport()}
              >
                导出
              </Button>
            </>
          )}
          <GlassButton size="sm" onClick={() => openForm()}>
            <FiPlus />
            新建链接
          </GlassButton>
        </HStack>
      </Flex>
      <Text fontSize="xs" color="ptextmuted" mb={4}>
        管理从其他渠道（分享站、网盘等）获得的资源链接，仅保存在本机
        {platform === 'android' ? '；导入/导出暂不支持移动端' : ''}
      </Text>

      {links.length === 0 ? (
        <EmptyState
          icon={<FiExternalLink />}
          title="还没有自建链接"
          description="点击右上角「新建链接」保存你从其他渠道获得的资源链接"
        />
      ) : (
        <VStack align="stretch" spacing={3}>
          {links.map((link) => (
            <Box
              key={link.id}
              bg="panel"
              borderWidth="1px"
              borderColor="pborder"
              borderRadius="lg"
              p={4}
              display="flex"
              flexDirection="column"
              gap={2}
            >
              <Flex align="flex-start" justify="space-between" gap={3}>
                <Box minW={0} flex="1">
                  <Text fontWeight="bold" color="ptext" noOfLines={1} title={link.name}>
                    {link.name}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="ptextmuted"
                    noOfLines={1}
                    title={link.url}
                    mt={1}
                    cursor="pointer"
                    _hover={{ color: 'var(--pbox-accent)' }}
                    onClick={() => openLink(link.url)}
                  >
                    {link.url}
                  </Text>
                  {link.remark !== '' && (
                    <Text fontSize="xs" color="ptextmuted" mt={1} noOfLines={2}>
                      {link.remark}
                    </Text>
                  )}
                </Box>
                <HStack spacing={1} flexShrink={0}>
                  <IconButton
                    aria-label={`打开链接：${link.name}`}
                    title="打开链接"
                    icon={<FiExternalLink />}
                    size="sm"
                    variant="ghost"
                    color="ptextmuted"
                    onClick={() => openLink(link.url)}
                  />
                  <IconButton
                    aria-label={`编辑链接：${link.name}`}
                    title="编辑"
                    icon={<FiEdit2 />}
                    size="sm"
                    variant="ghost"
                    color="ptextmuted"
                    onClick={() => openForm(link)}
                  />
                  <IconButton
                    aria-label={`删除链接：${link.name}`}
                    title="删除"
                    icon={<FiTrash2 />}
                    size="sm"
                    variant="ghost"
                    color="ptextmuted"
                    onClick={() => setDeleteTarget(link)}
                  />
                </HStack>
              </Flex>
            </Box>
          ))}
        </VStack>
      )}

      {/* 新建/编辑弹窗 */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        size="md"
        isCentered
        closeOnEsc={!formOpen}
      >
        <ModalOverlay />
        <ModalContent bg="panelstrong" borderRadius="lg" mx={4}>
          <ModalHeader color="ptext" fontSize="md">
            {editingId ? '编辑链接' : '新建链接'}
          </ModalHeader>
          <ModalBody>
            <VStack align="stretch" spacing={3}>
              <Box>
                <Text fontSize="xs" color="ptextmuted" mb={1}>
                  名称（必填）
                </Text>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例如：某某网盘下载"
                  maxLength={100}
                  bg="pinput"
                  borderColor="pborder"
                  color="ptext"
                />
              </Box>
              <Box>
                <Text fontSize="xs" color="ptextmuted" mb={1}>
                  链接（必填，http/https）
                </Text>
                <Input
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://…"
                  maxLength={2048}
                  bg="pinput"
                  borderColor="pborder"
                  color="ptext"
                />
              </Box>
              <Box>
                <Text fontSize="xs" color="ptextmuted" mb={1}>
                  备注（可选）
                </Text>
                <Textarea
                  value={form.remark}
                  onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                  placeholder="提取码、有效期、注意事项等"
                  maxLength={500}
                  rows={3}
                  bg="pinput"
                  borderColor="pborder"
                  color="ptext"
                  resize="none"
                />
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" color="ptextmuted" mr={2} onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <GlassButton size="sm" onClick={() => void saveForm()}>
              <FiSave />
              保存
            </GlassButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认 */}
      <AlertDialog
        isOpen={deleteTarget !== null}
        leastDestructiveRef={cancelRef}
        onClose={() => setDeleteTarget(null)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="panelstrong" mx={4}>
            <AlertDialogHeader fontSize="md" color="ptext">
              删除链接
            </AlertDialogHeader>
            <AlertDialogBody color="ptextmuted" fontSize="sm">
              确定删除「{deleteTarget?.name}」？此操作不可恢复。
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" color="ptextmuted" onClick={() => setDeleteTarget(null)}>
                取消
              </Button>
              <Button colorScheme="red" ml={2} onClick={() => void confirmDelete()}>
                删除
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
