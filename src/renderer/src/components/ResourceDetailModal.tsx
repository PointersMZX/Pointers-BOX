import {
  Badge,
  Box,
  Divider,
  Flex,
  HStack,
  IconButton,
  Text,
  useToast,
  VStack
} from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { FiExternalLink, FiShare2, FiX } from 'react-icons/fi'
import type { Resource } from '../../../shared/types'
import { getResourceShares } from '../../../shared/validate'
import { openClaim, shareResource } from '../platform'
import GlassButton from './GlassButton'
import { SPRING } from '../theme/motion'

interface Props {
  resource: Resource | null
  isOpen: boolean
  onClose: () => void
}

/**
 * 资源详情弹窗（v2.1.0 克制版）：
 * 居中液态玻璃弹窗——0.96x 缩放 0.2s 平滑浮现（无过冲、无高光扩散）；
 * 点击遮罩 0.18s 平滑收束消失；内容滚动时弹窗外框不动。
 * 内容：资源序号/名称/介绍/分类/日期 + 每一个分享项的名称与「领取」跳转入口。
 * v2.4.0：分享项不再明文展示链接（只有领取跳转入口）；新增「分享此资源」——
 * 平台绑定分享（复制/拉起平台分享页链接，接收方回平台领取，拿不到资源真实链接）。
 */
export default function ResourceDetailModal({ resource, isOpen, onClose }: Props) {
  const [portalEl] = useState(() => (typeof document !== 'undefined' ? document.body : null))
  const toast = useToast()

  // Escape 关闭（标准弹窗行为）
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!portalEl) return null

  return (
    <AnimatePresence>
      {isOpen && resource && (
        <motion.div
          key="pbox-detail-overlay"
          className="pbox-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.28, ease: 'easeIn' } }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`资源详情：${resource.name}`}
        >
          <motion.div
            className="pbox-modal-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '84vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0, transition: { ...SPRING.settle } }}
            exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <Flex
              position="relative"
              zIndex={1}
              align="flex-start"
              justify="space-between"
              gap={3}
              px={6}
              pt={6}
              pb={4}
            >
              <VStack align="start" spacing={2} minW={0}>
                <HStack spacing={2} flexWrap="wrap">
                  <Badge
                    borderRadius="full"
                    px={2.5}
                    py={0.5}
                    fontSize="xs"
                    bg="var(--pbox-accent-soft, rgba(124,92,255,0.35))"
                    color="ptext"
                  >
                    #{String(resource.id)}
                  </Badge>
                  <Badge
                    borderRadius="full"
                    px={2.5}
                    py={0.5}
                    fontSize="xs"
                    colorScheme="purple"
                    variant="subtle"
                  >
                    {resource.category}
                  </Badge>
                </HStack>
                <Text fontWeight="bold" fontSize="lg" color="ptext" noOfLines={2}>
                  {resource.name}
                </Text>
                <HStack spacing={3} fontSize="xs" color="ptextmuted" flexWrap="wrap">
                  {resource.release_date && <Text as="span">发布：{resource.release_date}</Text>}
                  {resource.last_modified && <Text as="span">更新：{resource.last_modified}</Text>}
                </HStack>
              </VStack>
              <IconButton
                aria-label="关闭详情"
                icon={<FiX />}
                size="sm"
                variant="ghost"
                color="ptextmuted"
                onClick={onClose}
                flexShrink={0}
              />
            </Flex>

            {/* 内容区（可滚动，弹窗外框保持不动） */}
            <Box
              flex="1"
              minH={0}
              overflowY="auto"
              px={6}
              pb={6}
              position="relative"
              zIndex={1}
            >
              <Text fontSize="sm" color="ptextmuted" lineHeight="1.85" whiteSpace="pre-wrap" mb={4}>
                {resource.introduction || '暂无简介'}
              </Text>

              <Divider borderColor="pborder" mb={4} />

              <Text fontSize="sm" fontWeight="bold" mb={3} color="ptext">
                分享项（{getResourceShares(resource).length}）
              </Text>
              <VStack align="stretch" spacing={3}>
                {getResourceShares(resource).map((share, i) => (
                  <Flex
                    key={`${share.url}-${i}`}
                    align="center"
                    justify="space-between"
                    gap={3}
                    bg="pinput"
                    borderWidth="1px"
                    borderColor="pborder"
                    borderRadius="xl"
                    px={4}
                    py={3}
                    className="pbox-morph"
                  >
                    <Box minW={0} flex="1">
                      {/* v2.4.0：分享项不再明文展示链接，仅保留「领取」跳转入口 */}
                      <HStack spacing={2} mb={1}>
                        <Badge borderRadius="full" fontSize="2xs" px={2} colorScheme="purple" variant="subtle">
                          {i + 1}
                        </Badge>
                        <Text fontSize="sm" fontWeight="semibold" color="ptext" noOfLines={1}>
                          {share.name}
                        </Text>
                      </HStack>
                    </Box>
                    <GlassButton
                      size="sm"
                      ariaLabel={`领取分享项：${share.name}`}
                      onClick={() => {
                        openClaim(share.url)
                        onClose()
                      }}
                    >
                      <FiExternalLink />
                      领取
                    </GlassButton>
                  </Flex>
                ))}
              </VStack>

              {/* v2.4.0 平台绑定分享：对方拿到的是平台分享页链接，回平台领取，拿不到资源真实链接 */}
              <Divider borderColor="pborder" my={4} />
              <Box>
                <GlassButton
                  variant="ghost"
                  ariaLabel="分享此资源"
                  title="复制平台分享链接发给朋友，对方打开后在平台上领取"
                  onClick={() => {
                    void shareResource(resource)
                      .then((mode) => {
                        if (mode === 'copied') {
                          toast({
                            title: '已复制，发给朋友后对方在平台上领取',
                            status: 'success',
                            duration: 3000,
                            position: 'top'
                          })
                        }
                      })
                      .catch(() => {
                        toast({
                          title: '分享失败，请稍后再试',
                          status: 'error',
                          duration: 3000,
                          position: 'top'
                        })
                      })
                  }}
                >
                  <FiShare2 />
                  分享此资源
                </GlassButton>
              </Box>
            </Box>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
