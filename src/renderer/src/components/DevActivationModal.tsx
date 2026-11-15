// 开发者激活/测试弹窗（v2.6.0 第 9 条激活 + 第 7 条开发者测试，共用同一能力）：
// 两步验证（对齐首启引导的分步形态）：
//   第 1 步：输入 8 字激活密码；第 2 步：随机姓氏填空题（不做选择题，避免直接送答案）。
// 验证通过后回调 onVerified——激活模式则激活开发者模式，开发者测试则跳过更新。
import { Box, Button, Flex, Input, Text, useColorModeValue } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiArrowLeft, FiLock, FiX } from 'react-icons/fi'
import { DEV_ACTIVATION_CODE, devQuestion, verifyDevActivation } from '../../../shared/devActivation'
import { SPRING } from '../theme/motion'

interface DevQuestion {
  question: string
  expectedLabel: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** 验证通过（已激活/已通过测试） */
  onVerified: () => void
}

export default function DevActivationModal({ open, onClose, onVerified }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [password, setPassword] = useState('')
  const [question, setQuestion] = useState<DevQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const cardBg = useColorModeValue('rgba(255,255,255,0.72)', 'rgba(16,24,40,0.72)')
  const cardBorder = useColorModeValue('rgba(15,23,42,0.10)', 'rgba(255,255,255,0.14)')

  // 每次打开都回到第 1 步并重新出题（随机题）
  useEffect(() => {
    if (!open) return
    setStep(1)
    setPassword('')
    setAnswer('')
    setError('')
    setSubmitting(false)
    setQuestion(devQuestion())
  }, [open])

  const toStep2 = (): void => {
    setError('')
    if (!password) {
      setError('请输入激活密码')
      return
    }
    if (password !== DEV_ACTIVATION_CODE) {
      setError('激活密码不正确')
      return
    }
    // 进入第 2 步时重新抽题，避免停留在页面上被反复盯
    setQuestion(devQuestion())
    setAnswer('')
    setStep(2)
  }

  const onSubmit = (): void => {
    if (!question || submitting) return
    setError('')
    const trimmed = answer.trim()
    if (!trimmed) {
      setError('请填写答案')
      return
    }
    if (!verifyDevActivation(password, trimmed, question.expectedLabel)) {
      setError('答案不正确，请重试')
      return
    }
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      onVerified()
    }, 300)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dev-activation"
          className="pbox-modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 1300, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.24, ease: 'easeIn' } }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="开发者激活"
        >
          <motion.div
            className="pbox-modal-panel"
            style={{
              width: '100%', maxWidth: '460px', maxHeight: '86vh', display: 'flex',
              flexDirection: 'column', overflowY: 'auto'
            }}
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0, transition: { ...SPRING.settle } }}
            exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
            onClick={(e) => e.stopPropagation()}
          >
            <Flex align="center" justify="space-between" p={5} px={6} mb={2}>
              <Text fontSize="lg" fontWeight="bold" color="ptext">
                开发者激活
              </Text>
              <Button size="xs" variant="ghost" color="ptextmuted" onClick={onClose} leftIcon={<FiX size={16} />}>
                取消
              </Button>
            </Flex>

            {/* 步骤指示：两步分开，密码通过后才出题 */}
            <Flex align="center" gap={2} px={6} mb={4}>
              {[1, 2].map((n) => (
                <Box
                  key={n}
                  flex="1"
                  h="4px"
                  borderRadius="full"
                  bg={step >= n ? 'var(--pbox-accent)' : 'pborder'}
                  transition="background .25s ease"
                />
              ))}
              <Text fontSize="xs" color="ptextmuted" ml={1}>
                第 {step} / 2 步
              </Text>
            </Flex>

            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <Box mx={6} p={4} borderRadius="14px" borderWidth="1px" borderColor={cardBorder} bg={cardBg}>
                    <Flex align="center" gap={2} mb={1.5}>
                      <FiLock size={14} color="var(--pbox-accent)" />
                      <Text fontSize="sm" color="pprimarymuted" fontWeight={500}>
                        激活密码
                      </Text>
                    </Flex>
                    <Input
                      size="sm"
                      value={password}
                      type="text"
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="请输入激活密码"
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') toStep2()
                      }}
                    />
                  </Box>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <Box mx={6} p={4} borderRadius="14px" borderWidth="1px" borderColor={cardBorder} bg={cardBg}>
                    <Text fontSize="sm" color="pprimarymuted" mb={1.5} fontWeight={500}>
                      验证问题
                    </Text>
                    <Text fontSize="md" color="ptext" fontWeight="bold" mb={2}>
                      {question ? question.question : '正在生成验证题…'}
                    </Text>
                    <Input
                      size="sm"
                      value={answer}
                      type="text"
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="请填写对应的姓名"
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSubmit()
                      }}
                    />
                    <Text fontSize="xs" color="ptextmuted" mt={2}>
                      填空作答（不作选择题），填写完整姓名。
                    </Text>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <Text mx={6} fontSize="xs" color="red.400" mt={3} p={2} borderRadius="6px" borderWidth="1px" borderColor="red.300">
                {error}
              </Text>
            )}

            <Flex gap={3} mt={4} px={6} justify="flex-end">
              {step === 2 && (
                <Button variant="ghost" color="ptextmuted" leftIcon={<FiArrowLeft size={14} />} onClick={() => { setStep(1); setError('') }}>
                  上一步
                </Button>
              )}
              {step === 1 ? (
                <Button size="sm" colorScheme="brand" onClick={toStep2}>
                  下一步
                </Button>
              ) : (
                <Button size="sm" colorScheme="brand" onClick={onSubmit} isLoading={submitting}>
                  验证并继续
                </Button>
              )}
            </Flex>
            <Text fontSize="xs" color="ptextmuted" mt={3} mb={4} textAlign="center">
              开发者功能仅供内部测试，请勿泄露激活密码。
            </Text>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
