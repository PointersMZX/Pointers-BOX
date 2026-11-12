import { Box, Button, Flex, HStack, Input, Radio, RadioGroup, Stack, Switch, Text, VStack } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { ACCENT_PRESETS, normalizeTheme } from '../../../shared/theme'
import type { HomeLayout } from '../../../shared/types'
import { backend } from '../platform'
import { useDownloadStore } from '../store/downloadStore'
import { useThemeStore } from '../store/themeStore'
import GlassButton from './GlassButton'
import { ThemePreview } from '../pages/SettingsPage'

/**
 * 首启引导（v2.6.0，对齐甘露解析的克制风格）：
 * 一个标题开场，之后把每一项设置分成独立一步——每步只调一项、点「下一步」推进，
 * 右上角随时可跳过；所有改动即时写入配置（与设置页同源）。
 */
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const isAndroid = backend.platform === 'android'
  // 步骤表按平台组装：欢迎 → 外观 → 强调色 → 下载路径(桌面) → 浏览器偏好(Android) → 下载历史 → 更新渠道 → 完成
  const steps = ['welcome', 'appearance', 'accent', ...(isAndroid ? [] : ['downloadDir']), ...(isAndroid ? ['browser'] : []), 'history', 'channel', 'done'] as string[]
  const [index, setIndex] = useState(0)
  const step = steps[index]!
  const total = steps.length

  const finish = (): void => {
    void backend.setConfig({ onboarded: true })
    onDone()
  }
  const next = (): void => (index + 1 >= total ? finish() : setIndex(index + 1))
  const prev = (): void => setIndex(Math.max(0, index - 1))

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={1600}
      bg="var(--pbox-overlay, rgba(0,0,0,0.32))"
      backdropFilter="blur(28px) saturate(140%)"
      style={{ WebkitBackdropFilter: 'blur(28px) saturate(140%)' } as React.CSSProperties}
      display="flex"
      alignItems="center"
      justifyContent="center"
      padding="1rem"
    >
      <motion.div
        className="pbox-modal-panel"
        style={{ width: '100%', maxWidth: '480px', padding: '28px 26px 22px', position: 'relative' }}
        initial={{ scale: 0.94, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } }}
      >
        {/* 进度点 + 跳过 */}
        <Flex position="absolute" top="18px" left="26px" gap={1.5}>
          {steps.map((_, i) => (
            <Box
              key={i}
              w="6px"
              h="6px"
              borderRadius="full"
              bg={i === index ? 'var(--pbox-accent)' : 'var(--pbox-nav-active, rgba(255,255,255,0.10))'}
              transition="background-color .2s ease, width .2s ease"
              width={i === index ? '18px' : '6px'}
            />
          ))}
        </Flex>
        <Button
          position="absolute"
          top="10px"
          right="14px"
          size="xs"
          variant="ghost"
          color="ptextmuted"
          onClick={finish}
        >
          跳过引导
        </Button>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.24, ease: 'easeOut' } }}
        >
          {step === 'welcome' && (
            <VStack align="start" spacing={2} pt={4}>
              <Text fontSize="2xl" fontWeight="bold" color="ptext">
                欢迎使用 Pointers-BOX
              </Text>
              <Text fontSize="sm" color="ptextmuted" lineHeight="1.8">
                用 1 分钟把常用的几项设置调好，之后随时可以在「设置」里改。
              </Text>
            </VStack>
          )}
          {step === 'appearance' && <StepAppearance />}
          {step === 'accent' && <StepAccent />}
          {step === 'downloadDir' && <StepDownloadDir />}
          {step === 'browser' && <StepBrowser />}
          {step === 'history' && <StepHistory />}
          {step === 'channel' && <StepChannel />}
          {step === 'done' && (
            <VStack align="start" spacing={2} pt={4}>
              <Text fontSize="2xl" fontWeight="bold" color="ptext">
                一切就绪
              </Text>
              <Text fontSize="sm" color="ptextmuted" lineHeight="1.8">
                所有设置都可以在「设置」页随时调整。
              </Text>
            </VStack>
          )}
        </motion.div>

        <Flex justify="space-between" align="center" mt={7}>
          <Button size="sm" variant="ghost" color="ptextmuted" onClick={prev} isDisabled={index === 0}>
            上一步
          </Button>
          <GlassButton onClick={next} ariaLabel={index + 1 >= total ? '完成首启引导' : '下一步'}>
            {index + 1 >= total ? '开始使用' : '下一步'}
          </GlassButton>
        </Flex>
      </motion.div>
    </Box>
  )
}

/* ── 各步骤 ────────────────────────────────────────────── */

function StepTitle({ title, hint }: { title: string; hint: string }): React.JSX.Element {
  return (
    <VStack align="start" spacing={1} pt={4} mb={4}>
      <Text fontSize="lg" fontWeight="bold" color="ptext">
        {title}
      </Text>
      <Text fontSize="xs" color="ptextmuted">
        {hint}
      </Text>
    </VStack>
  )
}

function StepAppearance(): React.JSX.Element {
  const themeKey = useThemeStore((s) => s.themeKey)
  const setAppearance = useThemeStore((s) => s.setAppearance)
  return (
    <Box>
      <StepTitle title="外观" hint="深浅双色；全局液态玻璃自动适配" />
      <HStack spacing={3}>
        {(['dark', 'light'] as const).map((k) => {
          const active = themeKey === k
          return (
            <Box
              key={k}
              as="button"
              onClick={() => setAppearance(k)}
              rounded="md"
              borderWidth="2px"
              borderColor={active ? 'var(--pbox-accent)' : 'pborder'}
              p={2}
              className="pbox-morph"
              textAlign="left"
              flex="1"
            >
              <ThemePreview themeKey={k} />
              <Text fontSize="sm" fontWeight={active ? 'bold' : 'normal'} color="ptext">
                {k === 'dark' ? '深色' : '浅色'}
              </Text>
            </Box>
          )
        })}
      </HStack>
    </Box>
  )
}

function StepAccent(): React.JSX.Element {
  const themeKey = useThemeStore((s) => s.themeKey)
  const accent = useThemeStore((s) => s.accent)
  const setAppearance = useThemeStore((s) => s.setAppearance)
  return (
    <Box>
      <StepTitle title="强调色" hint="用于主按钮/进度条/焦点环；可随时在设置里改" />
      <HStack spacing={3} wrap="wrap">
        {ACCENT_PRESETS.map((c) => (
          <Box
            key={c}
            as="button"
            aria-label={`选择颜色 ${c}`}
            w="34px"
            h="34px"
            rounded="full"
            bg={c}
            borderWidth="3px"
            borderColor={accent === c ? 'ptext' : 'transparent'}
            className="pbox-morph"
            onClick={() => setAppearance(themeKey, c)}
          />
        ))}
      </HStack>
    </Box>
  )
}

function StepDownloadDir(): React.JSX.Element {
  const config = useDownloadStore((s) => s.config)
  const chooseDir = useDownloadStore((s) => s.chooseDir)
  return (
    <Box>
      <StepTitle title="下载路径" hint="资源文件保存的位置；点「选择」改目录并立即保存" />
      <HStack spacing={2}>
        <Input
          size="sm"
          value={config?.downloadDir ?? ''}
          readOnly
          borderColor="pborder"
          color="ptext"
          bg="pinput"
          noOfLines={1}
        />
        <Button
          size="sm"
          variant="outline"
          borderColor="pborder"
          color="ptext"
          flexShrink={0}
          onClick={() => void chooseDir()}
        >
          选择
        </Button>
      </HStack>
    </Box>
  )
}

function StepBrowser(): React.JSX.Element {
  const config = useDownloadStore((s) => s.config)
  const saveConfig = useDownloadStore((s) => s.saveConfig)
  const value = config?.androidBrowser ?? 'builtin'
  return (
    <Box>
      <StepTitle title="浏览器偏好" hint="点开外部链接时用哪种浏览器打开" />
      <RadioGroup
        value={value}
        onChange={(v) => {
          void saveConfig({ androidBrowser: v as 'builtin' | 'system' })
        }}
      >
        <Stack spacing={3}>
          <Radio value="builtin" colorScheme="brand">
            <Text fontSize="sm" color="ptext">内置浏览器（应用内打开）</Text>
          </Radio>
          <Radio value="system" colorScheme="brand">
            <Text fontSize="sm" color="ptext">系统浏览器</Text>
          </Radio>
        </Stack>
      </RadioGroup>
    </Box>
  )
}

function StepHistory(): React.JSX.Element {
  const config = useDownloadStore((s) => s.config)
  const saveConfig = useDownloadStore((s) => s.saveConfig)
  const value = config?.keepDownloadHistory ?? false
  return (
    <Box>
      <StepTitle title="下载历史" hint="开启后记录已完成的下载任务（默认关闭）" />
      <Flex align="center" justify="space-between">
        <Text fontSize="sm" color="ptext">保留下载历史</Text>
        <Switch
          colorScheme="brand"
          isChecked={value}
          onChange={(e) => {
            void saveConfig({ keepDownloadHistory: e.target.checked })
          }}
          aria-label="保留下载历史"
        />
      </Flex>
    </Box>
  )
}

function StepChannel(): React.JSX.Element {
  const config = useDownloadStore((s) => s.config)
  const saveConfig = useDownloadStore((s) => s.saveConfig)
  const value = config?.updateChannel ?? 'gitee'
  return (
    <Box>
      <StepTitle title="更新渠道" hint="检查新版本时使用的下载源" />
      <RadioGroup
        value={value}
        onChange={(v) => {
          void saveConfig({ updateChannel: v as 'gitee' | 'github' })
        }}
      >
        <Stack spacing={3}>
          <Radio value="gitee" colorScheme="brand">
            <Text fontSize="sm" color="ptext">国内镜像（Gitee）</Text>
            <Text fontSize="xs" color="ptextmuted" ml={2}>国内网络推荐</Text>
          </Radio>
          <Radio value="github" colorScheme="brand">
            <Text fontSize="sm" color="ptext">全球官方（GitHub）</Text>
          </Radio>
        </Stack>
      </RadioGroup>
    </Box>
  )
}
