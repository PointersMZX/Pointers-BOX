// v2.6.0 第 7 条：新版本弹窗状态（全局唯一）——启动自动检测与设置页手动检查共用同一个弹窗，
// 避免两处各渲染一份导致重叠；forced = 版本跨度 ≥2（强制更新）。
import { create } from 'zustand'
import type { UpdateCheckResult } from '../../../shared/types'

export interface UpdatePromptResult extends UpdateCheckResult {
  forced: boolean
}

interface UpdatePromptState {
  result: UpdatePromptResult | null
  open: (result: UpdatePromptResult) => void
  close: () => void
}

export const useUpdatePromptStore = create<UpdatePromptState>((set) => ({
  result: null,
  open: (result) => set({ result }),
  close: () => set({ result: null })
}))
