import {
  Badge,
  Box,
  Divider,
  Flex,
  HStack,
  IconButton,
  Text,
  VStack
} from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { FiExternalLink, FiX } from 'react-icons/fi'
import type { Resource } from '../../../shared/types'
import { getResourceShares } from '../../../shared/validate'
import { openClaim } from '../platform'
import GlassButton from './GlassButton'

interface Props {
  resource: Resource | null
  isOpen: boolean
  onClose: () => void
}

/**
 * 资源详情弹窗（v2.0.0）：
 * 居中液态玻璃弹窗——0.8x 缩放弹性弹出（到位过冲 1.02x 再回弹归位）+ 高光从中心向四周扩散；
 * 点击遮罩 0.28s 弹性收束消失，高光向中心聚拢；内容滚动时弹窗外框不动、高光随滚动微偏移。
 * 内容：资源序号/名称/介绍/分类/日期 + 每一个分享项的名称与链接。
 */
export default function ResourceDetailModal({ resource, isOpen, onClose }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const [portalEl] = useState(() => (typeof document !== 'undefined' ? document.body : null))

  // Escape 关闭（标准弹窗行为）
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // 内容滚动 → 玻璃高光微偏移（液态折射随视角变化，rAF 节流）
  const handleScroll = (): void => {
    const body = bodyRef.current
    const shine = shineRef.current
    if (!body || !shine) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const max = body.scrollHeight - body.clientHeight
      const ratio = max > 0 ? body.scrollTop / max : 0
      shine.style.transform = `translateY(${(ratio - 0.5) * 18}px)`
    })
  }

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
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 1.02, 1], opacity: [0, 1, 1] }}
            exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.28, ease: 'easeIn' } }}
            transition={{ duration: 0.42, times: [0, 0.65, 1], ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 玻璃高光层（跟随滚动微偏移） */}
            <div className="pbox-modal-shine" ref={shineRef}>
              <div className="pbox-modal-shine-inner" />
            </div>

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
                    bg="var(--pbox-accent-soft, rgba(159,122,234,0.35))"
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
              ref={bodyRef}
              onScroll={handleScroll}
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
                    className="pbox-glass-flow"
                  >
                    <Box minW={0} flex="1">
                      <HStack spacing={2} mb={1}>
                        <Badge borderRadius="full" fontSize="2xs" px={2} colorScheme="purple" variant="subtle">
                          {i + 1}
                        </Badge>
                        <Text fontSize="sm" fontWeight="semibold" color="ptext" noOfLines={1}>
                          {share.name}
                        </Text>
                      </HStack>
                      <Text fontSize="xs" color="ptextmuted" noOfLines={1} title={share.url}>
                        {share.url}
                      </Text>
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
            </Box>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
