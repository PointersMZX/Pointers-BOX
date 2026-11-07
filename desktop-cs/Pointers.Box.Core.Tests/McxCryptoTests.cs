// .mcx 三语言测试向量互验（C# 侧）
// 向量：docs/mcx/vectors/<name>/{plain.txt, cipher.txt}（复制进输出目录 vectors/）

using System.IO;
using Pointers.Box.Core;
using Xunit;

namespace Pointers.Box.Core.Tests;

public class McxCryptoTests
{
    private static string VectorsDir => Path.Combine(AppContext.BaseDirectory, "vectors");

    public static TheoryData<string> CaseNames()
    {
        var data = new TheoryData<string>();
        var index = Path.Combine(VectorsDir, "names.txt");
        if (File.Exists(index))
        {
            foreach (var line in File.ReadAllLines(index))
                if (line.Trim().Length > 0) data.Add(line.Trim());
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(CaseNames))]
    public void DecryptMatchesPlain(string name)
    {
        var plain = File.ReadAllText(Path.Combine(VectorsDir, name, "plain.txt"));
        var cipher = File.ReadAllText(Path.Combine(VectorsDir, name, "cipher.txt"));
        var outs = McxCrypto.DecryptMuxed(cipher);
        Assert.NotNull(outs);
        Assert.Equal(plain, outs);
    }

    [Fact]
    public void PlainPassthroughAndIsMuxed()
    {
        var plain = "{ \"plain\": true }";
        Assert.Equal(plain, McxCrypto.OpenMuxed(plain));
        Assert.False(McxCrypto.IsMuxed(plain));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-base64!!")]
    [InlineData("AAAA")]
    public void CorruptReturnsNull(string raw)
    {
        Assert.Null(McxCrypto.DecryptMuxed(raw));
    }

    [Fact]
    public void RoundtripWithFixedSalt()
    {
        // 固定盐 roundtrip：加密后必须能解回原文
        var salt = new byte[16];
        for (var i = 0; i < salt.Length; i++) salt[i] = (byte)(i * 17 + 3);
        var plain = """{"roundtrip":true,"中文":"测试🎵"}""";
        var cipher = McxCrypto.EncryptMuxed(plain, salt);
        Assert.Equal(plain, McxCrypto.DecryptMuxed(cipher));
    }
}
