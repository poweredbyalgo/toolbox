// GIF 调色板工具：颜色量化、像素索引映射，以及可选的 Floyd–Steinberg 抖动
// GIF 最多只有 256 色，视频转 GIF 必须先把 RGB 画面压缩到调色板
import { applyPalette, quantize } from 'gifenc'

// rgb565：红 5 位 / 绿 6 位 / 蓝 5 位，色彩更细腻但量化更慢
// rgb444：每通道 4 位，速度更快、色阶更少
const KEY_TABLES = {
	rgb444: {
		size: 4096,
		key: (r, g, b) => ((r >> 4) << 8) | (g & 0xf0) | (b >> 4),
	},
	rgb565: {
		size: 65536,
		key: (r, g, b) => ((r << 8) & 0xf800) | ((g << 2) & 0x03e0) | (b >> 3),
	},
}

export function quantizeRgba(rgba, maxColors, format = 'rgb565') {
	return quantize(rgba, maxColors, { format })
}

// 把 RGBA 画面转成调色板索引位图；dither 为 0 时用 gifenc 自带的最近色查表
export function indexRgba(rgba, palette, { format = 'rgb565', width, height, dither = 0 } = {}) {
	if (!dither || !width || !height) return applyPalette(rgba, palette, format)
	return ditherIndex(rgba, palette, format, width, height, dither)
}

// Floyd–Steinberg 误差扩散抖动：
// 逐个像素找最接近的调色板颜色，并把色差按权重分给右侧/下方的像素，
// 用点状噪点换取更平滑的渐变。strength 0~1 控制扩散强度。
function ditherIndex(rgba, palette, format, width, height, strength) {
	const table = KEY_TABLES[format] || KEY_TABLES.rgb565
	const index = new Uint8Array(width * height)
	const cache = new Int16Array(table.size).fill(-1)
	let current = {
		r: new Float32Array(width + 2),
		g: new Float32Array(width + 2),
		b: new Float32Array(width + 2),
	}
	let next = {
		r: new Float32Array(width + 2),
		g: new Float32Array(width + 2),
		b: new Float32Array(width + 2),
	}
	const weight = strength / 16

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const offset = (y * width + x) * 4
			const r = clampByte(rgba[offset] + current.r[x + 1])
			const g = clampByte(rgba[offset + 1] + current.g[x + 1])
			const b = clampByte(rgba[offset + 2] + current.b[x + 1])

			const key = table.key(r, g, b)
			let paletteIndex = cache[key]
			if (paletteIndex < 0) {
				paletteIndex = nearestIndex(r, g, b, palette)
				cache[key] = paletteIndex
			}
			index[y * width + x] = paletteIndex

			const color = palette[paletteIndex] || [0, 0, 0]
			const errorR = r - color[0]
			const errorG = g - color[1]
			const errorB = b - color[2]
			// 右 7/16
			current.r[x + 2] += errorR * 7 * weight
			current.g[x + 2] += errorG * 7 * weight
			current.b[x + 2] += errorB * 7 * weight
			// 下一行：左下 3/16、正下 5/16、右下 1/16
			next.r[x] += errorR * 3 * weight
			next.g[x] += errorG * 3 * weight
			next.b[x] += errorB * 3 * weight
			next.r[x + 1] += errorR * 5 * weight
			next.g[x + 1] += errorG * 5 * weight
			next.b[x + 1] += errorB * 5 * weight
			next.r[x + 2] += errorR * weight
			next.g[x + 2] += errorG * weight
			next.b[x + 2] += errorB * weight
		}
		const swap = current
		current = next
		next = swap
		next.r.fill(0)
		next.g.fill(0)
		next.b.fill(0)
	}

	return index
}

function nearestIndex(r, g, b, palette) {
	let best = 0
	let bestDistance = Infinity
	for (let i = 0; i < palette.length; i++) {
		const color = palette[i]
		const dr = color[0] - r
		const dg = color[1] - g
		const db = color[2] - b
		const distance = dr * dr + dg * dg + db * db
		if (distance < bestDistance) {
			bestDistance = distance
			best = i
			if (distance === 0) break
		}
	}
	return best
}

function clampByte(value) {
	if (value <= 0) return 0
	if (value >= 255) return 255
	return Math.round(value)
}
