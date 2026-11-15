// v2.6.0 草稿第 3+7 条：启动约 5 秒自动检测更新（开关开启时）→ 发现新版本弹出更新弹窗。
// 全局挂载（任何页面都生效）；设置页手动检查也通过 updatePromptStore 复用同一弹窗。
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import { backend } from '../platform'
import { versionDistance } from '../../../shared/semver'
import { useDownloadStore } from '../store/downloadStore'
import { useUpdatePromptStore } from '../store/updatePromptStore'
import UpdateModal from './UpdateModal'
import DevActivationModal from './DevActivationModal'

const AUTO_CHECK_DELAY_MS = 5_000

export default function UpdatePrompt(): React.JSX.Element {
  const result = useUpdatePromptStore((s) => s.result)
  const close = useUpdatePromptStore((s) => s.close)
  const config = useDownloadStore((s) => s.config)
  const loadConfig = useDownloadStore((s) => s.loadConfig)
  const [devTestOpen, setDevTestOpen] = useState(false)
  const started = useRef(false)
  const toast = useToast()

  // 自动检测：开关开启时启动约 5 秒后静默检测一次；失败/无更新不打扰用户
  useEffect(() => {
    if (!config) {
      void loadConfig()
      return
    }
    if (started.current || !config.autoCheckUpdate) return
    started.current = true
    const timer = window.setTimeout(() => {
      void backend
        .checkUpdate()
        .then((res) => {
          if (res.hasUpdate && res.latest) {
            const forced = versionDistance(res.latest, res.current) >= 2
            useUpdatePromptStore.getState().open({ ...res, forced })
          }
        })
        .catch(() => {})
    }, AUTO_CHECK_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [config, loadConfig])

  const onUpdate = async (action: 'apply' | 'skip' | 'devtest'): Promise<void> => {
    if (action === 'skip') {
      close()
      return
    }
    if (action === 'devtest') {
      setDevTestOpen(true)
      return
    }
    // 立即更新：GitHub 检测渠道 → 应用内下载（Android/鸿蒙走发布页）；网盘为独立手动下载按钮
    try {
      close()
      await backend.downloadUpdate()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : '打开下载渠道失败',
        status: 'error',
        duration: 5000,
        position: 'top'
      })
    }
  }

  return (
    <>
      <UpdateModal result={result} onUpdate={(a) => void onUpdate(a)} />
      <DevActivationModal
        open={devTestOpen}
        onClose={() => setDevTestOpen(false)}
        onVerified={() => {
          setDevTestOpen(false)
          close()
          toast({ title: '开发者测试已通过，本次跳过更新', status: 'success', duration: 3000, position: 'top' })
        }}
      />
    </>
  )
}
