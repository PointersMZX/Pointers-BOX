// 开发者激活/测试弹窗（v2.6.0 草稿第 9 条激活 + 第 7 条开发者测试，共用同一能力）：
// 输入 8 字密码（罗曹甘李王胡周戴）+ 随机题（八个字中选一个代表谁，附正确答案），
// 验证通过后回调 onVerified——激活模式则激活开发者模式，开发者测试则跳过更新。
import { Box, Button, Flex, Input, RadioGroup, Text, useColorModeValue } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { FiLock, FiX } from 'react-icons/fi'
import { devQuestion, verifyDevActivation } from '../../../shared/devActivation'
import { SPRING } from '../theme/motion'

interface Props {
  open: boolean
  onClose: () => void
  /** 验证通过（true=已激活/已通过测试）；失败不回调 */
  onVerified: (ok: boolean) => void
}

export default function DevActivationModal({ open, onClose, onVerified }: Props) {
  const [password, setPassword] = useState('')
  const [question, setQuestion] = useState<{ question: string; options: { value: string; label: string }[]; expectedLabel: string } | null>(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const cardBg = useColorModeValue('rgba(255,255,255,0.72)', 'rgba(16,24,40,0.72)')
  const cardBorder = useColorModeValue('rgba(15,23,42,0.10)', 'rgba(255,255,255,0.14)')

  const initQuestion = (): void => {
    const q = devQuestion()
    setQuestion(q)
    setAnswer('')
    setError('')
  }

  const onSubmit = (): void => {
    if (!question || submitting) return
    setError('')
    if (password !== '罗曹甘李王胡周戴' && !password) {
      setError('请输入激活密码')
      return
    }
    if (!answer) {
      setError('请选择正确答案')
      return
    }
    if (!verifyDevActivation(password, answer, question.expectedLabel)) {
      setError('密码或答案不正确，请重试')
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      onVerified(true)
    }, 300)
  }

  const Field = ({ icon, label }: { icon?: React.ReactNode; label: string }): React.JSX.Element => (
    <Box mb={3}>
      <Text fontSize="sm" color="pprimarymuted" mb={1.5} fontWeight={500}>
        {label}
      </Text>
      {icon && <FiLock color="pprimarymuted" />}
      <Input
        size="sm"
        value={password}
        type="password"
        autoFocus
        placeholder="激活密码"
        onChange={(e) => setPassword(e.target.value)}
      />
    </Box>
  )

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
            <Flex align="center" justify="space-between" p={5} px={6} mb={4}>
              <Text fontSize="lg" fontWeight="bold" color="ptext">
                开发者激活
              </Text>
              <Button size="xs" variant="ghost" color="ptextmuted" onClick={onClose}>
                <FiX size={16} />
                取消
              </Button>
            </Flex>

            <Box p={4} borderRadius="14px" borderWidth="1px" borderColor={cardBorder} bg={cardBg}>
              <Field label="激活密码" icon={<FiLock size={14} />} />
              <Text fontSize="sm" color="ptext" mb={2} fontWeight={500}>
                {question ? question.question : '验证开发者身份'}
              </Text>
              <RadioGroup
                value={answer}
                onChange={(v) => setAnswer(v)}
              >
                <Box mt={1}>
                  {question && question.options.map((o) => (
                    <Box key={o.value} as="button" type="button" w="100%" textAlign="left"
                      p={2.5} borderRadius="8px" borderWidth="1px" borderColor={answer === o.value ? 'var(--pbox-accent)' : cardBorder}
                      bg={answer === o.value ? 'var(--pbox-accent-soft)' : cardBg}
                      cursor="pointer" onClick={() => setAnswer(o.value)}
                      _active={{ transform: 'scale(0.985)' }}>
                      <Text fontSize="sm" color="ptext">
                        {o.label}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </RadioGroup>
            </Box>

            {error && (
              <Text fontSize="xs" color="red.400" mt={3} p={2} borderRadius="6px" borderWidth="1px" borderColor="red.300">
                {error}
              </Text>
            )}

            <Flex gap={3} mt={4} justify="flex-end">
              <Button variant="ghost" color="ptextmuted" onClick={onClose}>
                取消
              </Button>
              <Button size="sm" colorScheme="brand" onClick={onSubmit} isLoading={submitting}>
                验证并继续
              </Button>
            </Flex>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
