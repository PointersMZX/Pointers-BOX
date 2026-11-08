// 液态玻璃视觉常量与柔光球背景（参考 06-liquid-glass-spec dark 预设 + 05-gradient-flow-bg）
export class Glass {
  static readonly cardBg: string = '#8F2a2135';
  static readonly cardAltBg: string = '#85241c2e';
  static readonly cardBorder: string = '#29FFFFFF';
  static readonly navBg: string = '#CC1a1425';
}

// 柔光球背景：三颗径向渐变大球（百分比 center/radius，铺满各自区域）
@Component
export struct OrbBackground {
  build() {
    Stack() {
      Column()
        .width('130%')
        .height('80%')
        .position({ x: '-30%', y: '-25%' })
        .radialGradient({
          center: ['40%', '40%'],
          radius: '65%',
          colors: [['#B37c5cff', 0.0], ['#007c5cff', 0.65]]
        } as RadialGradientOptions)
      Column()
        .width('120%')
        .height('70%')
        .position({ x: '30%', y: '60%' })
        .radialGradient({
          center: ['55%', '45%'],
          radius: '62%',
          colors: [['#A506b6d4', 0.0], ['#0006b6d4', 0.62]]
        } as RadialGradientOptions)
      Column()
        .width('90%')
        .height('50%')
        .position({ x: '10%', y: '30%' })
        .radialGradient({
          center: ['50%', '50%'],
          radius: '60%',
          colors: [['#8Fec4899', 0.0], ['#00ec4899', 0.6]]
        } as RadialGradientOptions)
    }
    .width('100%')
    .height('100%')
    .alignContent(Alignment.TopStart)
  }
}
