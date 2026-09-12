// 首次启动更新渠道选择（v2.1.0）：必选弹窗，选完写入配置永不再弹
// Android 与桌面共用；无关闭按钮、无遮罩点击关闭、Esc 无效（必选其一）
import {
  Box,
  Button,
  Flex,
  Modal,
  ModalContent,
  ModalOverlay,
  Text,
  useColorModeValue
} from '@chakra-ui/react'
import { useState } from 'react'
import { FiGlobe, FiNavigation } from 'react-icons/fi'
import type { UpdateChannel } from '../../../shared/types'
import { useDownloadStore } from '../store/downloadStore'

interface Props {
  onChosen: (channel: UpdateChannel) => void
}

export default function UpdateChannelModal({ onChosen }: Props) {
  const [channel, setChannel] = useState<UpdateChannel>('gitee')
  const saveConfig = useDownloadStore((s) => s.saveConfig)
  const cardBg = useColorModeValue('rgba(255,255,255,0.72)', 'rgba(16,24,40,0.72)')
  const cardBorder = useColorModeValue('rgba(15,23,42,0.10)', 'rgba(255,255,255,0.14)')

  const confirm = (): void => {
    void saveConfig({ updateChannel: channel }).then(() => onChosen(channel))
  }

  const option = (
    key: UpdateChannel,
    icon: React.ReactNode,
    title: string,
    desc: string
  ): JSX.Element => (
    <Flex
      as="button"
      type="button"
      key={key}
      align="flex-start"
      gap={3}
      p={4}
      borderRadius="14px"
      borderWidth="1px"
      borderColor={channel === key ? 'var(--pbox-accent)' : cardBorder}
      bg={channel === key ? 'var(--pbox-accent-soft)' : cardBg}
      cursor="pointer"
      onClick={() => setChannel(key)}
      transition="border-color .18s ease, background-color .18s ease"
      _active={{ transform: 'scale(0.985)' }}
      textAlign="left"
      w="full"
    >
      <Box mt={1} color={channel === key ? 'var(--pbox-accent)' : 'ptextmuted'}>
        {icon}
      </Box>
      <Box>
        <Text fontSize="sm" fontWeight="600">
          {title}
        </Text>
        <Text fontSize="xs" color="ptextmuted" mt={1} lineHeight={1.5}>
          {desc}
        </Text>
      </Box>
    </Flex>
  )

  return (
    <Modal
      isOpen
      onClose={(): void => {}}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
      size="md"
    >
      <ModalOverlay bg="rgba(2,6,18,0.55)" />
      <ModalContent
        bg="panelstrong"
        borderRadius="18px"
        border="1px solid"
        borderColor="pborder"
        boxShadow="0 24px 64px rgba(2,6,18,0.4)"
        p={6}
        userSelect="none"
      >
        <Text fontSize="lg" fontWeight="700">
          选择更新渠道
        </Text>
        <Text fontSize="xs" color="ptextmuted" mt={2} lineHeight={1.6}>
          用于检查与应用内更新；之后可随时在「设置 → 更新检查」中更改。
        </Text>
        <Flex direction="column" gap={3} mt={5}>
          {option(
            'gitee',
            <FiNavigation size={18} />,
            '国内镜像（Gitee）',
            '国内访问速度快、不受 GitHub 限流影响；更新包与官方一致。'
          )}
          {option(
            'github',
            <FiGlobe size={18} />,
            '全球官方（GitHub）',
            '版本发布的源头；适合海外网络或希望第一时间获取更新。'
          )}
        </Flex>
        <Button mt={6} w="full" size="md" colorScheme="brand" onClick={confirm}>
          确定
        </Button>
      </ModalContent>
    </Modal>
  )
}
