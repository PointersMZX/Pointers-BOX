// 开发者模式激活/验证（v2.6.0 草稿第 9 条 + 第 7 条开发者测试，合并为同一能力）：
// 激活 = 8 字密码（罗曹甘李王胡周戴）+ 随机题目（八个字中选一个代表谁）校验，答对即激活；
// 开发者模式开启后，第 7 条强制更新弹窗的「开发者测试」可复用该激活直接跳过更新。
export const DEV_ACTIVATION_CODE = '罗曹甘李王胡周戴'

/** 八个字 → 对应的八位成员（随机题选项） */
export interface DevRole {
  char: string
  label: string
}
export const DEV_ROLES: DevRole[] = [
  { char: '罗', label: '罗以澄' },
  { char: '曹', label: '曹芷荧' },
  { char: '甘', label: '甘晞彤' },
  { char: '李', label: '李文馨' },
  { char: '王', label: '王雨欣' },
  { char: '胡', label: '胡清瑶' },
  { char: '周', label: '周紫蕊' },
  { char: '戴', label: '戴千珺' }
]

/** 随机抽一个字作为题目对象（含正确答案 label） */
export function devQuestion(): {
  question: string
  options: { value: string; label: string }[]
  expectedLabel: string
} {
  const r = DEV_ROLES[Math.floor(Math.random() * DEV_ROLES.length)]
  if (!r) return { question: '', options: [], expectedLabel: '' }
  return {
    question: `${r.char} 代表哪一位？`,
    options: DEV_ROLES.map((x) => ({ value: x.label, label: x.label })),
    expectedLabel: r.label
  }
}

/** 验证密码 + 答案：密码须为 8 字口令，答案须等于随机题的正确答案 */
export function verifyDevActivation(password: string, answer: string, expectedLabel: string): boolean {
  return password === DEV_ACTIVATION_CODE && answer === expectedLabel
}
