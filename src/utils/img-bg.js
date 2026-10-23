// 图片背景提取：将背景转为纯白（JPG）或透明（PNG），全部在浏览器本地 canvas 处理
import { loadImageElement, canvasToBlob } from './file'

// 从图片边缘采样估算背景色（取中位数，抗噪点）
function estimateBackgroundColor(data, width, height) {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 60))
  const rs = []
  const gs = []
  const bs = []
  const push = (x, y) => {
    const i = (y * width + x) * 4
    if (data[i + 3] < 128) return // 跳过已透明像素
    rs.push(data[i])
    gs.push(data[i + 1])
    bs.push(data[i + 2])
  }
  for (let x = 0; x < width; x += step) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += step) {
    push(0, y)
    push(width - 1, y)
  }
  if (!rs.length) return [255, 255, 255]
  const median = (arr) => {
    arr.sort((a, b) => a - b)
    return arr[arr.length >> 1]
  }
  return [median(rs), median(gs), median(bs)]
}

// 生成透明度蒙版：距离背景色越近越透明，中间过渡保证边缘柔和
function buildAlphaMatte(data, width, height, tolerance) {
  const bg = estimateBackgroundColor(data, width, height)
  const hi = Math.max(8, tolerance * 2.55) // 容差 0-100 映射到 RGB 距离
  const lo = hi * 0.4
  const span = hi - lo
  const alpha = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 128) {
      alpha[p] = data[i + 3] // 原图已透明的部分保持原样
      continue
    }
    const dr = data[i] - bg[0]
    const dg = data[i + 1] - bg[1]
    const db = data[i + 2] - bg[2]
    const d = Math.sqrt(dr * dr + dg * dg + db * db)
    if (d <= lo) alpha[p] = 0
    else if (d >= hi) alpha[p] = 255
    else alpha[p] = Math.round(((d - lo) / span) * 255)
  }
  return { alpha, bg }
}

// 按蒙版合成两种输出：透明 PNG（前景色去底色还原）+ 纯白底 JPG
function composeOutputs(srcData, width, height, alpha, bg) {
  const transCanvas = document.createElement('canvas')
  transCanvas.width = width
  transCanvas.height = height
  const whiteCanvas = document.createElement('canvas')
  whiteCanvas.width = width
  whiteCanvas.height = height
  const tCtx = transCanvas.getContext('2d')
  const wCtx = whiteCanvas.getContext('2d')
  const tImg = tCtx.createImageData(width, height)
  const wImg = wCtx.createImageData(width, height)
  const [br, bg_, bb] = bg
  for (let i = 0, p = 0; i < srcData.length; i += 4, p++) {
    const a = alpha[p]
    const af = a / 255
    // 半透明边缘：把混入的背景色从前景色中剥离，避免残留底色
    let r = srcData[i]
    let g = srcData[i + 1]
    let b = srcData[i + 2]
    if (a > 0 && a < 255) {
      r = Math.min(255, Math.max(0, (r - br * (1 - af)) / af))
      g = Math.min(255, Math.max(0, (g - bg_ * (1 - af)) / af))
      b = Math.min(255, Math.max(0, (b - bb * (1 - af)) / af))
    }
    tImg.data[i] = r
    tImg.data[i + 1] = g
    tImg.data[i + 2] = b
    tImg.data[i + 3] = a
    wImg.data[i] = Math.round(r * af + 255 * (1 - af))
    wImg.data[i + 1] = Math.round(g * af + 255 * (1 - af))
    wImg.data[i + 2] = Math.round(b * af + 255 * (1 - af))
    wImg.data[i + 3] = 255
  }
  tCtx.putImageData(tImg, 0, 0)
  wCtx.putImageData(wImg, 0, 0)
  return { transCanvas, whiteCanvas }
}

// 处理一张图片，返回 { whiteBlob, transBlob }
export async function extractBackgrounds(blob, tolerance = 30) {
  const url = URL.createObjectURL(blob)
  let img
  try {
    img = await loadImageElement(url)
  } finally {
    URL.revokeObjectURL(url)
  }
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (!width || !height) throw new Error('图片尺寸无效')
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = width
  srcCanvas.height = height
  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const srcData = ctx.getImageData(0, 0, width, height).data
  const { alpha, bg } = buildAlphaMatte(srcData, width, height, tolerance)
  const { transCanvas, whiteCanvas } = composeOutputs(srcData, width, height, alpha, bg)
  const [whiteBlob, transBlob] = await Promise.all([
    canvasToBlob(whiteCanvas, 'image/jpeg', 0.92),
    canvasToBlob(transCanvas, 'image/png'),
  ])
  return { whiteBlob, transBlob }
}
