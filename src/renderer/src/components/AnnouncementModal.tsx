import { Badge, Box, Flex, HStack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiBell, FiX } from 'react-icons/fi'
import type { Announcement } from '../../../shared/types'
import GlassButton from './GlassButton'

interface Props {
  announcement: Announcement | null
  /** 启动时自动弹；同一会话内关闭后不再弹（数据刷新不重弹） */
  open: boolean
  onClose: () => void
}

/**
 * 平台公告启动弹窗（v2.3.0）：
 * 启动拉到公告（announcement.json）即弹一次，液态玻璃样式；
 * 遮罩/Esc/按钮均可关闭，主页公告卡保留常驻展示。
 */
export default function AnnouncementModal({ announcement, open, onClose }: Props) {
  const [portalEl] = useState(() => (typeof document !== 'undefined' ? document.body : null))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!portalEl) return null

  return (
    <AnimatePresence>
      {open && announcement && (
        <motion.div
          key="pbox-announcement-overlay"
          className="pbox-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
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
          aria-label="平台公告"
        >
          <motion.div
            className="pbox-modal-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '84vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
            onClick={(e) => e.stopPropagation()}
          >
            <Flex align="center" justify="space-between" p={5} px={6}>
              <HStack spacing={2.5}>
                <FiBell color="var(--pbox-accent)" size={18} />
                <Text fontSize="lg" fontWeight="bold" color="ptext">
                  平台公告
                </Text>
                {announcement.date && (
                  <Badge colorScheme="brand" variant="subtle" borderRadius="full">
                    {announcement.date}
                  </Badge>
                )}
              </HStack>
              <Box
                as="button"
                type="button"
                aria-label="关闭公告"
                color="ptextmuted"
                _hover={{ color: 'ptext' }}
                bg="transparent"
                border="none"
                cursor="pointer"
                p={1}
                rounded="md"
                onClick={onClose}
              >
                <FiX size={16} />
              </Box>
            </Flex>
            <Box px={6} pb={5} overflowY="auto" flex="1" minH={0}>
              <Text fontSize="sm" color="ptext" lineHeight={1.7} whiteSpace="pre-wrap">
                {announcement.content}
              </Text>
            </Box>
            <Flex justify="center" p={5} px={6}>
              <GlassButton size="sm" ariaLabel="知道了" onClick={onClose}>
                知道了
              </GlassButton>
            </Flex>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
