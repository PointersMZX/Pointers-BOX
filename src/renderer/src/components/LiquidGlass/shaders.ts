// Pointers-BOX · LiquidGlass 着色器（v2.3.0 移植自 XingyuMusic-desktop 液态玻璃 GLSL）
// 原始出处：Metric v1.4.3 Compose RuntimeShaderEffect（桌面端 XingyuMusic LiquidGlass 组件），
// 在此原样复用——SDF 圆角面板折射（circleMap 位移场 + 梯度方向）+ 7 色色散（红橙黄绿青蓝紫 7 tap）
// + SDF 边缘流光（光向随时间摆动）+ 指针径向高光 + caustic 微光。
// content 采样 = 主题背景栅格纹理（由 index.tsx 把 body 背景堆叠画到离屏 canvas 后上传）。
// v2.4.0：胶囊轮廓（stadium SDF）——面板半径取短边一半，两端是半圆透镜；
// 折射环沿胶囊端部弯曲出"真·胶囊液态玻璃"。DOM 面板配 border-radius:9999px（自动钳到短边一半）同形。

export const vertexSrc = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

export const fragmentSrc = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D u_content;
// 面板几何（CSS px）
uniform vec2 u_panelSize;
uniform float u_radius;
// v2.4.0：胶囊形态（stadium SDF）——0 = 固定半径圆角矩形；1 = 胶囊（半径=短边一半，两端半圆透镜）
uniform float u_shape;
// 背景纹理（窗口内容区）
uniform vec2 u_windowSize;
uniform vec2 u_panelPos;
// 折射（Metric s5 参数）
uniform float u_refractionHeight;
uniform float u_refractionAmount;
uniform float u_depthEffect;
// 色散（Metric s6 参数）
uniform float u_chromatic;
// 光效
uniform float u_edgeFalloff;
uniform vec4 u_edgeColor;   // 边缘流光（金色发丝）
uniform vec4 u_tint;        // 玻璃染色
uniform vec4 u_base;        // 玻璃底板
uniform vec4 u_glowColor;   // 指针高光色
uniform vec2 u_pointer;     // 面板局部坐标（CSS px）
uniform float u_pointerA;   // 指针在场强度 0..1
uniform float u_sheen;      // 顶部镜面光强度
uniform float u_glow;       // 指针高光强度
uniform float u_time;
// v2.5.0：六层模型的表面/光照补齐
uniform float u_grain;      // 磨砂颗粒（打散纯 blur 的塑料感；静态噪声不闪）
uniform float u_innerGlow;  // 内泛光（SDF 内部雾状提亮 = 体积感）

// SDF：圆角矩形（Metric s2 同款）
float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// 标量噪声（静态颗粒用；输出 0..1）
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

vec2 gradSdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 c = abs(p) - (b - r);
  if (c.x >= 0.0 || c.y >= 0.0) {
    return sign(p) * normalize(max(c, 0.0));
  } else {
    float gx = step(c.y, c.x);
    return sign(p) * vec2(gx, 1.0 - gx);
  }
}

// Metric s5：circleMap 折射位移
float circleMap(float x) {
  return 1.0 - sqrt(max(0.0, 1.0 - x * x));
}

void main() {
  vec2 halfSize = u_panelSize * 0.5;
  vec2 css = v_uv * u_panelSize;
  vec2 centered = css - halfSize;

  // v2.4.0：胶囊轮廓——半径在"固定圆角"与"短边一半（stadium）"之间按 u_shape 混合；
  // u_shape=1 时两端为半圆透镜，折射环沿弧弯，即"真·胶囊液态玻璃"
  float R = mix(u_radius, min(halfSize.x, halfSize.y), u_shape);

  float sd = sdRoundedRect(centered, halfSize, R);
  float coverage = smoothstep(0.0, 2.0, -sd);
  if (coverage <= 0.0001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // ---------- 折射 + 7 色色散（Metric s6 原式：refractedCoord = coord + d*grad；tap 在 refractedCoord ± dispersedCoord） ----------
  vec2 dispDir = vec2(0.0);
  if (-sd < u_refractionHeight) {
    sd = min(sd, 0.0);
    float d = circleMap(1.0 - -sd / u_refractionHeight) * u_refractionAmount;
    float gr = min(R * 1.5, min(halfSize.x, halfSize.y));
    vec2 grad = normalize(gradSdRoundedRect(centered, halfSize, gr) + u_depthEffect * normalize(centered + vec2(0.001)));
    dispDir = d * grad;
  }
  // 色散强度：Metric 原式 (centered.x*centered.y)/(halfSize.x*halfSize.y) —— 四角最强、四边中点为 0
  float ds = u_chromatic * (centered.x * centered.y) / (halfSize.x * halfSize.y);
  vec2 off = dispDir * ds;

  float uvA = 1.0 / u_windowSize.x;
  float uvB = 1.0 / u_windowSize.y;

  vec4 col = vec4(0.0);
  // red：refractedCoord + dispersedCoord
  vec4 red = texture2D(u_content, (u_panelPos + css + dispDir + off) * vec2(uvA, uvB));
  col.r += red.r / 3.5;
  col.a += red.a / 7.0;
  // orange：+2/3 off
  vec4 orange = texture2D(u_content, (u_panelPos + css + dispDir + off * (2.0 / 3.0)) * vec2(uvA, uvB));
  col.r += orange.r / 3.5;
  col.g += orange.g / 7.0;
  col.a += orange.a / 7.0;
  // yellow：+1/3 off
  vec4 yellow = texture2D(u_content, (u_panelPos + css + dispDir + off * (1.0 / 3.0)) * vec2(uvA, uvB));
  col.r += yellow.r / 3.5;
  col.g += yellow.g / 3.5;
  col.a += yellow.a / 7.0;
  // green：refractedCoord（无额外色散）
  vec4 green = texture2D(u_content, (u_panelPos + css + dispDir) * vec2(uvA, uvB));
  col.g += green.g / 3.5;
  col.a += green.a / 7.0;
  // cyan：-1/3 off
  vec4 cyan = texture2D(u_content, (u_panelPos + css + dispDir - off * (1.0 / 3.0)) * vec2(uvA, uvB));
  col.g += cyan.g / 3.5;
  col.b += cyan.b / 3.0;
  col.a += cyan.a / 7.0;
  // blue：-2/3 off
  vec4 blue = texture2D(u_content, (u_panelPos + css + dispDir - off * (2.0 / 3.0)) * vec2(uvA, uvB));
  col.b += blue.b / 3.0;
  col.a += blue.a / 7.0;
  // purple：-off
  vec4 purple = texture2D(u_content, (u_panelPos + css + dispDir - off) * vec2(uvA, uvB));
  col.r += purple.r / 7.0;
  col.b += purple.b / 3.0;
  col.a += purple.a / 7.0;

  // ---------- 玻璃体：染色 + 底板 ----------
  float shadeMix = clamp(u_tint.a * 1.7, 0.0, 1.0);
  vec3 shade = mix(vec3(1.0), u_tint.rgb, shadeMix);
  vec3 rgb = col.rgb * shade + u_base.rgb * u_base.a;

  // 液态微光（缓慢呼吸，让玻璃"活着"；v2.3.1：微光提亮一档）
  float caustic = 0.05 * (0.5 + 0.5 * sin(u_time * 0.6 + css.x * 0.045 + css.y * 0.09));
  rgb += caustic * u_edgeColor.rgb * u_edgeColor.a;

  // ---------- SDF 边缘光（Metric s3）：流光方向随时间摆动 ----------
  float ang = 1.5708 + 0.42 * sin(u_time * 0.21);
  float gr2 = min(R * 1.5, min(halfSize.x, halfSize.y));
  vec2 g2 = normalize(gradSdRoundedRect(centered, halfSize, gr2));
  vec2 nrm = vec2(cos(ang), sin(ang));
  float dl = dot(g2, nrm);
  float lightUp = step(0.0, dl);
  float rim = pow(abs(dl), u_edgeFalloff) * u_edgeColor.a * lightUp;
  vec3 lightCol = mix(u_edgeColor.rgb, vec3(1.0), 0.4);
  rgb += lightCol * rim;

  // 顶部镜面光（v2.3.1：提强）
  float sheen = (1.0 - smoothstep(0.0, 1.0, css.y / max(u_panelSize.y, 1.0))) * u_sheen;
  rgb += u_edgeColor.rgb * sheen * 0.8;

  // ---------- 指针高光（Metric s1） ----------
  float gd = distance(css, u_pointer);
  float glow = (1.0 - smoothstep(45.0, 130.0, gd)) * u_pointerA * u_glow;
  rgb += u_glowColor.rgb * glow;

  // ---------- v2.5.0：内泛光 + 磨砂颗粒（表面/光照层补齐） ----------
  // 内泛光：距边缘越深越亮的雾状提亮（glass 体感）
  float inner = u_innerGlow * smoothstep(0.0, 0.45, -sd);
  rgb += vec3(inner);
  // 磨砂颗粒：静态噪声微抖（±grain/2），打散大面积 blur 的塑料感
  float grain = (hash21(css) - 0.5) * u_grain;
  rgb += grain;

  // ---------- 合成（v2.3.1：边缘/镜面/高光权重提强，玻璃体更"亮"） ----------
  float alpha = coverage * clamp(u_base.a + u_tint.a * 0.9 + rim * 0.9 + sheen * 0.8 + glow * 0.8, 0.0, 0.99);
  gl_FragColor = vec4(rgb, alpha);
}
`
