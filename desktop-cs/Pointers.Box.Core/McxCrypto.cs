// Pointers-BOX .mcx 加密容器（v1）——C# 实现
// 规格见 docs/mcx/mcx-algorithm.md；参考实现 src/shared/mcx.ts。
// 测试向量：docs/mcx/test-vectors.json（解密必须与 plain 逐字节一致）。

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Pointers.Box.Core
{
    public static class McxCrypto
    {
        private const int Version = 1;
        private const int SaltLen = 16;
        private static readonly byte[] Magic = { 0x4d, 0x43, 0x58 }; // "MCX"

        // 密钥材料（32 字节 = KEY_A[i] ^ KEY_B[i]，2026-10-17 首版）
        private static readonly byte[] KeyA =
        {
            0x5d, 0x97, 0xfc, 0x2e, 0xe7, 0xfe, 0x17, 0x40, 0xba, 0xf2, 0x03, 0x0c, 0x8a, 0x60, 0x44, 0x63,
            0x54, 0xa9, 0x9f, 0x51, 0x11, 0xf6, 0x8c, 0xe7, 0x38, 0xec, 0x9e, 0x72, 0x2b, 0x54, 0x3e, 0x0d
        };
        private static readonly byte[] KeyB =
        {
            0x16, 0x25, 0x5d, 0xa7, 0xe1, 0x61, 0xcf, 0x01, 0x21, 0x1b, 0x2b, 0xcb, 0x71, 0x36, 0x63, 0xec,
            0x52, 0x01, 0x34, 0x3b, 0x9b, 0x79, 0xac, 0x31, 0x07, 0x69, 0xf6, 0xb6, 0x3e, 0xdb, 0x18, 0x31
        };

        private static byte[] KeyBytes()
        {
            var outs = new byte[KeyA.Length];
            for (var i = 0; i < KeyA.Length; i++) outs[i] = (byte)(KeyA[i] ^ KeyB[i]);
            return outs;
        }

        // FNV-1a 32 位（uint 天然环绕）
        private static uint Fnv1a(IReadOnlyList<byte> bytes)
        {
            uint h = 0x811c9dc5;
            for (var i = 0; i < bytes.Count; i++)
            {
                h ^= bytes[i];
                h *= 0x01000193u;
            }
            return h;
        }

        // mulberry32（uint 语义与 JS 实现逐行对应）
        private static IEnumerable<uint> Mulberry32Stream(uint seed, int count)
        {
            uint a = seed;
            for (var n = 0; n < count; n++)
            {
                a += 0x6d2b79f5u;
                var t = Imul(a ^ (a >> 15), 1u | a);
                t = (Imul(t ^ (t >> 7), 61u | t) + t) ^ t;
                yield return t ^ (t >> 14);
            }
        }

        private static uint Imul(uint x, uint y) => x * y; // uint 乘法天然取低 32 位

        private static byte[] Keystream(uint seed, int length)
        {
            var outs = new byte[length];
            var idx = 0;
            foreach (var w in Mulberry32Stream(seed, (length + 3) / 4))
            {
                if (idx < length) outs[idx++] = (byte)((w >> 24) & 0xff);
                if (idx < length) outs[idx++] = (byte)((w >> 16) & 0xff);
                if (idx < length) outs[idx++] = (byte)((w >> 8) & 0xff);
                if (idx < length) outs[idx++] = (byte)(w & 0xff);
                if (idx >= length) break;
            }
            return outs;
        }

        // 宽容解码：忽略所有非 base64 字符；清理后为空或非 4 倍数返回 null
        private static byte[] B64Decode(string text)
        {
            var clean = new string(text.Where(c =>
                (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
                (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=').ToArray());
            if (clean.Length == 0 || clean.Length % 4 != 0) return null;
            try
            {
                return Convert.FromBase64String(clean);
            }
            catch (FormatException)
            {
                return null;
            }
        }

        private static byte[] Xor(byte[] data, byte[] key, uint seed)
        {
            var ks = Keystream(seed, data.Length);
            var outs = new byte[data.Length];
            for (var i = 0; i < data.Length; i++) outs[i] = (byte)(data[i] ^ ks[i]);
            return outs;
        }

        private static byte[] Body(byte[] salt, byte[] cipherText)
        {
            var outs = new byte[Magic.Length + 1 + salt.Length + cipherText.Length];
            Array.Copy(Magic, 0, outs, 0, Magic.Length);
            outs[Magic.Length] = Version;
            Array.Copy(salt, 0, outs, Magic.Length + 1, salt.Length);
            Array.Copy(cipherText, 0, outs, Magic.Length + 1 + salt.Length, cipherText.Length);
            return outs;
        }

        /// <summary>加密 JSON 文本 → .mcx 文件内容（单行 base64）。salt 由调用方给（测试注入固定值；生产用随机）。</summary>
        public static string EncryptMuxed(string plainText, byte[] salt)
        {
            if (salt == null || salt.Length != SaltLen)
                throw new ArgumentException($"salt 必须为 {SaltLen} 字节", nameof(salt));
            var pt = Encoding.UTF8.GetBytes(plainText);
            var keySalt = KeyBytes().Concat(salt).ToArray();
            var ct = Xor(pt, KeyBytes(), Fnv1a(keySalt));
            return Convert.ToBase64String(Body(salt, ct));
        }

        /// <summary>加密（随机盐，RandomNumberGenerator）。</summary>
        public static string EncryptMuxed(string plainText)
        {
            using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            var salt = new byte[SaltLen];
            rng.GetBytes(salt);
            return EncryptMuxed(plainText, salt);
        }

        /// <summary>解密 .mcx → 明文；非 mcx/损坏返回 null。</summary>
        public static string DecryptMuxed(string raw)
        {
            if (raw == null) return null;
            var bytes = B64Decode(raw);
            if (bytes == null || bytes.Length < Magic.Length + 1 + SaltLen + 1) return null;
            for (var i = 0; i < Magic.Length; i++)
                if (bytes[i] != Magic[i]) return null;
            if (bytes[Magic.Length] != Version) return null;
            var salt = new byte[SaltLen];
            Array.Copy(bytes, Magic.Length + 1, salt, 0, SaltLen);
            var ct = new byte[bytes.Length - Magic.Length - 1 - SaltLen];
            Array.Copy(bytes, Magic.Length + 1 + SaltLen, ct, 0, ct.Length);
            if (ct.Length == 0) return null;
            var keySalt = KeyBytes().Concat(salt).ToArray();
            var pt = Xor(ct, KeyBytes(), Fnv1a(keySalt));
            return Encoding.UTF8.GetString(pt);
        }

        /// <summary>是否为 mcx 加密文件。</summary>
        public static bool IsMuxed(string raw) => DecryptMuxed(raw) != null;

        /// <summary>统一读取入口：mcx 解密，非 mcx 原样直通。</summary>
        public static string OpenMuxed(string raw) => DecryptMuxed(raw) ?? raw;
    }
}
