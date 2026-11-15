// 发现新版本弹窗（v2.6.0 草稿第 7 条）：展示最新版本号 + 版本更新日志，可选立即更新/暂不更新；
// 触发强制更新（版本差≥2）时显示强制更新标记，且「暂不更新」按钮改为「开发者测试」。
import { Box, Badge, Button, Flex, Text, useColorModeValue } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiDownload, FiPlus, FiRefreshCw } from 'react-icons/fi'
import type { UpdateCheckResult } from '../../../shared/types'
import GlassButton from './GlassButton'
import { SPRING } from '../theme/motion'

interface Props {
  result: UpdateCheckResult | null
  /** 是否因版本差≥2 触发强制更新（是则按钮「暂不更新」改为开发者测试） */
  forced: boolean
  /** 立即更新：apply=确认下载更新；skip=暂不更新 */
  onUpdate: (action: 'apply' | 'skip') => void
}

export default function UpdateModal({ result, forced, onUpdate }: Props) {
  const cardBg = useColorModeValue('rgba(255,255,255,0.72)', 'rgba(16,24,40,0.72)')
  const cardBorder = useColorModeValue('rgba(15,23,42,0.10)', 'rgba(255,255,255,0.14)')

  const show = !!result && result.hasUpdate
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="update-modal"
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
          onClick={() => onUpdate('skip')}
          role="dialog"
          aria-modal="true"
          aria-label="新版本提示"
        >
          <motion.div
            className="pbox-modal-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '86vh',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto'
            }}
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0, transition: { ...SPRING.settle } }}
            exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
            onClick={(e) => e.stopPropagation()}
          >
            <Flex align="center" justify="space-between" p={5} px={6}>
              <Flex align="center" gap={2.5}>
                <Text fontSize="lg" fontWeight="bold" color="ptext">
                  发现新版本
                </Text>
                {forced && (
                  <Badge colorScheme="orange" variant="subtle" borderRadius="full">
                    强制更新
                  </Badge>
                )}
              </Flex>
              <Button
                size="sm"
                variant="ghost"
                color="ptextmuted"
                onClick={() => onUpdate('skip')}
                isDisabled={!result || result.error !== undefined}
              >
                暂不更新
              </Button>
            </Flex>

            <Box mt={4} p={4} borderRadius="14px" borderWidth="1px" borderColor={cardBorder} bg={cardBg}>
              <Flex align="center" gap={2.5} mb={3}>
                <FiRefreshCw color="var(--pbox-accent)" size={16} />
                <Text fontSize="sm" fontWeight="bold" color="ptext">
                  最新版本：
                </Text>
                <Badge colorScheme="brand" variant="subtle" borderRadius="full">
                  {result.latest ?? '未知'}
                </Badge>
                {result.releaseNotes && (
                  <Text fontSize="xs" color="ptextmuted" ml={2}>
                    对比当前 v{result.current}
                  </Text>
                )}
              </Flex>
              {result.releaseNotes && (
                <Text fontSize="sm" color="ptext" whiteSpace="pre-wrap" lineHeight="1.8" noOfLines={6}>
                  {result.releaseNotes}
                </Text>
              )}
            </Box>

            <Flex align="stretch" mt={4} gap={3}>
              <Button
                size="sm"
                leftIcon={<FiDownload size={16} />}
                onClick={() => onUpdate('apply')}
              >
                立即更新
              </Button>
              <Button size="sm" variant="ghost" color="ptextmuted" onClick={() => onUpdate('skip')}>
                暂不更新
              </Button>
            </Flex>
            {forced && (
              <Text fontSize="xs" color="ptextmuted" mt={2}>
                版本相差 2 个及以上，系统将强制更新（开发者可点击「开发者测试」跳过）。
              </Text>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
