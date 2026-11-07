// Pointers-BOX .mcx 加密容器（v1）——ArkTS 实现
// 规格见 docs/mcx/mcx-algorithm.md；参考实现 src/shared/mcx.ts。
// ArkTS 语法与 TS 逐行对应（Math.imul / >>> 可用）；base64 用 @kit.ArkTS util。

import { util } from '@kit.ArkTS';

const VERSION: number = 1;
const SALT_LEN: number = 16;
const MAGIC: number[] = [0x4d, 0x43, 0x58]; // "MCX"

// 密钥材料（32 字节 = KEY_A[i] ^ KEY_B[i]，2026-10-17 首版；与 TS 实现逐字节一致）
const KEY_A: number[] = [
  0x5d, 0x97, 0xfc, 0x2e, 0xe7, 0xfe, 0x17, 0x40, 0xba, 0xf2, 0x03, 0x0c, 0x8a, 0x60, 0x44, 0x63,
  0x54, 0xa9, 0x9f, 0x51, 0x11, 0xf6, 0x8c, 0xe7, 0x38, 0xec, 0x9e, 0x72, 0x2b, 0x54, 0x3e, 0x0d
];
const KEY_B: number[] = [
  0x16, 0x25, 0x5d, 0xa7, 0xe1, 0x61, 0xcf, 0x01, 0x21, 0x1b, 0x2b, 0xcb, 0x71, 0x36, 0x63, 0xec,
  0x52, 0x01, 0x34, 0x3b, 0x9b, 0x79, 0xac, 0x31, 0x07, 0x69, 0xf6, 0xb6, 0x3e, 0xdb, 0x18, 0x31
];

function keyBytes(): number[] {
  const outs: number[] = new Array<number>(KEY_A.length);
  for (let i = 0; i < KEY_A.length; i++) {
    outs[i] = (KEY_A[i] ^ KEY_B[i]) & 0xff;
  }
  return outs;
}

// FNV-1a 32 位（>>> 0 转无符号）
function fnv1a(bytes: number[]): number {
  let h: number = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h = h ^ (bytes[i] & 0xff);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// mulberry32（与 TS 实现逐行一致）
class Mulberry32 {
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  next(): number {
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t: number = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = ((Math.imul(t ^ (t >>> 7), 61 | t) + t) | 0) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }
}

function keystream(seed: number, length: number): number[] {
  const rng: Mulberry32 = new Mulberry32(seed);
  const outs: number[] = new Array<number>(length);
  let i: number = 0;
  while (i < length) {
    const w: number = rng.next();
    if (i < length) outs[i++] = (w >>> 24) & 0xff;
    if (i < length) outs[i++] = (w >>> 16) & 0xff;
    if (i < length) outs[i++] = (w >>> 8) & 0xff;
    if (i < length) outs[i++] = w & 0xff;
  }
  return outs;
}

// 宽容解码：忽略所有非 base64 字符；清理后为空或非 4 倍数返回 null
function b64Decode(text: string): number[] | null {
  let clean: string = '';
  for (let i = 0; i < text.length; i++) {
    const c: string = text.charAt(i);
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '+' || c === '/' || c === '=') {
      clean += c;
    }
  }
  if (clean.length === 0 || clean.length % 4 !== 0) {
    return null;
  }
  try {
    // util.Base64Helper：标准 base64 解码（输入已清理）
    const helper: util.Base64Helper = new util.Base64Helper();
    const arr: Uint8Array = helper.decodeSync(clean);
    const outs: number[] = new Array<number>(arr.length);
    for (let i = 0; i < arr.length; i++) {
      outs[i] = arr[i];
    }
    return outs;
  } catch (err) {
    return null;
  }
}

function xorWith(data: number[], seed: number): number[] {
  const ks: number[] = keystream(seed, data.length);
  const outs: number[] = new Array<number>(data.length);
  for (let i = 0; i < data.length; i++) {
    outs[i] = (data[i] ^ ks[i]) & 0xff;
  }
  return outs;
}

/** 解密 .mcx → 明文；非 mcx/损坏返回 null。 */
export function decryptMuxed(raw: string): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const bytes: number[] | null = b64Decode(raw);
  if (bytes === null || bytes.length < MAGIC.length + 1 + SALT_LEN + 1) {
    return null;
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      return null;
    }
  }
  if (bytes[MAGIC.length] !== VERSION) {
    return null;
  }
  const salt: number[] = bytes.slice(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN);
  const ct: number[] = bytes.slice(MAGIC.length + 1 + SALT_LEN);
  if (ct.length === 0) {
    return null;
  }
  const keySalt: number[] = keyBytes().concat(salt);
  const pt: number[] = xorWith(ct, fnv1a(keySalt));
  // Uint8Array → UTF-8 解码
  return util.TextDecoder.create('utf-8').decodeToString(new Uint8Array(pt));
}

/** 是否为 mcx 加密文件。 */
export function isMuxed(raw: string): boolean {
  return decryptMuxed(raw) !== null;
}

/** 统一读取入口：mcx 解密，非 mcx 原样直通。 */
export function openMuxed(raw: string): string {
  const decrypted: string | null = decryptMuxed(raw);
  return decrypted ?? raw;
}
