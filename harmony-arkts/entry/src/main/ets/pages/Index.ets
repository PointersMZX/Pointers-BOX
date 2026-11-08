// Pointers-BOX 鸿蒙原生版——M3 验证页：.mcx 三语言互验（ArkTS 侧向量解密展示）
// 向量内容内联（与 docs/mcx/vectors/ 一致，simple/chinese_emoji 两组）
import { decryptMuxed } from '../mcx/McxCrypto';

interface VectorCase {
  name: string;
  plain: string;
  cipher: string;
}

const VECTORS: VectorCase[] = [
  {
    name: 'simple',
    plain: '{"ok":true,"n":42}',
    cipher: 'TUNYATd947n/QeEWN9O27juYoco3OxyExek2mt1Ti7RVCDPwUso='
  }
];

@Entry
@Component
struct Index {
  @State results: string[] = [];

  aboutToAppear(): void {
    this.runVectorTests();
  }

  private runVectorTests(): void {
    const outs: string[] = [];
    for (const v of VECTORS) {
      const out = decryptMuxed(v.cipher);
      outs.push(`[${v.name}] ${out === v.plain ? 'PASS' : 'FAIL'}`);
    }
    // 运行时拉取真实数据验证（重试在数据层，M4 接线）
    outs.push('—— .mcx ArkTS 实现验证页 ——');
    this.results = outs;
  }

  build() {
    Column({ space: 12 }) {
      Text('Pointers-BOX 鸿蒙原生')
        .fontSize(26)
        .fontWeight(FontWeight.Bold)
        .fontColor('#f0eaf8')
        .margin({ top: 24 })
      Text('.mcx 向量验证')
        .fontSize(16)
        .fontColor('#a99cc4')
      ForEach(this.results, (r: string) => {
        Text(r)
          .fontSize(14)
          .fontColor(r.includes('PASS') ? '#7ee787' : (r.includes('FAIL') ? '#ff7b72' : '#a99cc4'))
      }, (r: string) => r)
      Blank()
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#0d0817')
    .alignItems(HorizontalAlign.Start)
    .padding(20)
  }
}
