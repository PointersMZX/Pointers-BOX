# .mcx 加密容器算法规格（v1）

> 本文为三语言实现（C#/Kotlin/ArkTS）的统一规格。参考实现：`src/shared/mcx.ts`（TypeScript）。
> 测试向量：`docs/mcx/test-vectors.json`（5 组，含中文/emoji/大对象；实现必须全部通过）。

## 文件格式

```
.mcx 文件内容 = 单行 base64 文本（宽容解码：忽略所有非 [A-Za-z0-9+/=] 字符）
解码后 body：
  偏移 0..2   0x4D 0x43 0x58   魔数 "MCX"
  偏移 3      0x01             版本号
  偏移 4..19  16 字节随机盐（每次加密不同）
  偏移 20+    密文 = 明文 UTF-8 字节 XOR 密钥流
明文 = JSON 文本（UTF-8）
```

## 密钥

32 字节 = `KEY_A[i] XOR KEY_B[i]`（两半拆分存于各实现源码，逐字节常量表）。
换密钥必须同步四处：TS 参考、share.html、Pointers-Tools、服务器全部 .mcx 文件，**及本规格三语言实现**。

## 密钥流生成

```
seed = FNV1a_32( key(32B) || salt(16B) )
密钥流 = mulberry32(seed) 输出的 32 位字序列，每字按【大端】取 4 字节
       （w>>>24, w>>>16, w>>>8, w），截取到密文长度为止
```

### FNV-1a 32 位

```
h = 0x811c9dc5
对每个字节 b：h = (h XOR b) * 0x01000193   （32 位环绕，无符号）
返回 h（无符号 32 位）
```

### mulberry32 PRNG（必须逐行对应，位运算语义敏感）

```
a = seed（无符号 32 位）
每次调用：
  a = (a + 0x6D2B79F5) mod 2^32
  t = imul(a XOR (a >>> 15), 1 OR a)        // imul = 32 位乘法取低 32 位
  t = (t + imul(t XOR (t >>> 7), 61 OR t)) XOR t
  返回 (t XOR (t >>> 14))   （无符号 32 位）
```

> 语言注意：
> - C#：用 `uint` 天然环绕即可，`imul` = `uint * uint` 直接乘。
> - Kotlin：JS 位运算是 32 位；用 `Long` 模拟（乘后 `and 0xFFFFFFFFL`，加法后 `and 0xFFFFFFFFL`）。
> - ArkTS：支持 `Math.imul` 与 `>>>`，可与 TS 实现逐行一致。

## 加密

```
salt = 16 字节随机（实现可用系统 CSPRNG；测试用注入的确定性 rng）
pt = UTF-8(plainText)
ks = keystream(FNV1a(key || salt), pt.length)
ct[i] = pt[i] XOR ks[i]
输出 base64("MCX" 0x01 salt ct)
```

## 解密（宽容失败：任何一步不满足返回 null，调用方回落，不抛错）

1. 宽容 base64 解码（去非 base64 字符；清理后长度为 0 或非 4 倍数 → null）
2. body 长度 ≥ 3+1+16+1 → 否则 null
3. 魔数 == "MCX" 且版本 == 0x01 → 否则 null
4. salt = body[4..19]，ct = body[20..]
5. ct.length == 0 → null
6. pt[i] = ct[i] XOR keystream(FNV1a(key||salt), ct.length)[i]
7. UTF-8 解码返回

## 测试向量

`test-vectors.json`：`vectors[] = { name, plain, cipher }`。
验收标准：**decryptMuxed(cipher) === plain 逐字节相等，5/5 通过**。
（加密方向因随机盐不做互验；各实现可用 roundtrip：加密后必须能被本实现解回原文。）
