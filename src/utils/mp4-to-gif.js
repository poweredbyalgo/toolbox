// MP4（或其他浏览器可播放的视频）→ GIF：逐帧定位、缩放、量化并编码（纯本地处理）
import { GIFEncoder } from 'gifenc'
import { indexRgba, quantizeRgba } from './gif-palette'

// 单次转换最多取样的帧数，避免超长视频把内存/时间打满
const MAX_FRAMES = 600

// 把视频地址绑定到 video 元素并读取元信息
export function loadVideoTo(element, url) {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			element.removeEventListener('loadedmetadata', onLoaded)
			element.removeEventListener('error', onError)
		}
		const onLoaded = () => {
			cleanup()
			if (!element.videoWidth || !element.videoHeight) {
				reject(new Error('无法读取视频尺寸，该文件可能已损坏'))
				return
			}
			if (!Number.isFinite(element.duration) || element.duration <= 0) {
				reject(new Error('无法读取视频时长，该编码可能不被当前浏览器支持'))
				return
			}
			resolve({
				width: element.videoWidth,
				height: element.videoHeight,
				duration: element.duration,
			})
		}
		const onError = () => {
			cleanup()
			reject(new Error('浏览器无法解码该视频。若是 HEVC/ProRes 等编码，请先转成 H.264 的 MP4'))
		}
		element.addEventListener('loadedmetadata', onLoaded)
		element.addEventListener('error', onError)
		element.preload = 'auto'
		element.src = url
		element.load()
	})
}

// 跳转到指定时间并等待新画面绘制完成
function seekTo(video, time) {
	return new Promise((resolve) => {
		const target = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.001)))
		let finished = false
		let fallbackTimer = null
		let failureTimer = null
		let onData = null
		const finish = () => {
			if (finished) return
			finished = true
			if (fallbackTimer) clearTimeout(fallbackTimer)
			if (failureTimer) clearTimeout(failureTimer)
			video.removeEventListener('seeked', onSeeked)
			if (onData) video.removeEventListener('loadeddata', onData)
			resolve()
		}
		const waitForFrame = () => {
			// seeked 只代表跳转完成，用 rVFC 再等一帧真正解码输出；旧浏览器退化为两帧 rAF
			if (typeof video.requestVideoFrameCallback === 'function') {
				fallbackTimer = setTimeout(finish, 300)
				video.requestVideoFrameCallback(() => finish())
			} else {
				requestAnimationFrame(() => requestAnimationFrame(finish))
			}
		}
		const onSeeked = () => waitForFrame()

		// 时间没变化时不会触发 seeked，需确保当前已解出一帧（例如 t=0 且视频刚加载）
		if (Math.abs(video.currentTime - target) < 0.0005) {
			if (video.readyState >= 2) {
				waitForFrame()
			} else {
				onData = () => {
					video.removeEventListener('loadeddata', onData)
					onData = null
					waitForFrame()
				}
				video.addEventListener('loadeddata', onData)
				failureTimer = setTimeout(finish, 2500)
			}
			return
		}

		video.addEventListener('seeked', onSeeked)
		// 极少数文件 seek 事件不触发，兜底避免卡死
		failureTimer = setTimeout(finish, 2500)
		try {
			video.currentTime = target
		} catch (e) {
			finish()
		}
	})
}

// 从若干帧（每 4 个像素取 1 个）构建全片统一调色板
async function buildSharedPalette({ video, canvas, ctx, width, height, frameCount, start, end, colors, format }) {
	const sampleCount = Math.min(6, Math.max(1, Math.round(frameCount / 8)))
	const perSample = Math.ceil((width * height) / 4)
	const samples = new Uint8Array(sampleCount * perSample * 4)
	let offset = 0
	for (let s = 0; s < sampleCount; s++) {
		const t = start + ((end - start) * (s + 0.5)) / sampleCount
		await seekTo(video, t)
		ctx.drawImage(video, 0, 0, width, height)
		const data = ctx.getImageData(0, 0, width, height).data
		for (let p = 0; p < width * height; p += 4) {
			const src = p * 4
			samples[offset] = data[src]
			samples[offset + 1] = data[src + 1]
			samples[offset + 2] = data[src + 2]
			samples[offset + 3] = 255
			offset += 4
		}
	}
	return quantizeRgba(samples.subarray(0, offset), colors, format)
}

export async function convertVideoToGif({
	video,
	start = 0,
	end = null,
	fps = 10,
	width = 480,
	colors = 256,
	format = 'rgb565',
	dither = 0,
	paletteMode = 'global',
	loop = 0,
	onProgress,
}) {
	const sourceWidth = video.videoWidth
	const sourceHeight = video.videoHeight
	if (!sourceWidth || !sourceHeight) throw new Error('视频尚未加载完成')

	const totalDuration = Number.isFinite(video.duration) ? video.duration : 0
	const from = Math.max(0, Math.min(start, totalDuration))
	const to = Math.min(end === null || end === undefined ? totalDuration : end, totalDuration)
	if (!(to > from)) throw new Error('结束时间必须大于开始时间')

	const outWidth = Math.max(1, Math.min(4096, Math.round(width)))
	const outHeight = Math.max(1, Math.round((outWidth * sourceHeight) / sourceWidth))
	const frameCount = Math.max(1, Math.min(MAX_FRAMES, Math.round((to - from) * fps)))
	// GIF 延迟以 10ms 为单位，先取整再写入，实际帧率会有极小偏差
	const delayMs = Math.max(20, Math.round((1000 / fps) / 10) * 10)

	const canvas = document.createElement('canvas')
	canvas.width = outWidth
	canvas.height = outHeight
	const ctx = canvas.getContext('2d', { willReadFrequently: true })
	ctx.imageSmoothingEnabled = true
	ctx.imageSmoothingQuality = 'high'

	video.pause()

	let sharedPalette = null
	if (paletteMode === 'global') {
		sharedPalette = await buildSharedPalette({
			video, canvas, ctx, width: outWidth, height: outHeight,
			frameCount, start: from, end: to, colors, format,
		})
	}

	const gif = GIFEncoder()
	let palette = sharedPalette
	for (let i = 0; i < frameCount; i++) {
		const time = Math.min(to - 0.001, from + i / fps)
		await seekTo(video, time)
		ctx.drawImage(video, 0, 0, outWidth, outHeight)
		const rgba = ctx.getImageData(0, 0, outWidth, outHeight).data
		// 每帧独立调色板：对画面变化剧烈的视频更准确，但文件更大且可能闪烁
		if (paletteMode === 'frame') palette = quantizeRgba(rgba, colors, format)
		const index = indexRgba(rgba, palette, {
			format,
			width: outWidth,
			height: outHeight,
			dither,
		})
		gif.writeFrame(index, outWidth, outHeight, {
			// 第一帧写全局调色板；逐帧模式下每帧附带局部调色板
			palette: i === 0 || paletteMode === 'frame' ? palette : undefined,
			delay: delayMs,
			repeat: loop,
		})
		if (onProgress) onProgress((i + 1) / frameCount)
		// 让出主线程，保证进度条能刷新
		if (onProgress && i % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0))
	}

	gif.finish()
	const blob = new Blob([gif.bytesView()], { type: 'image/gif' })
	return {
		blob,
		width: outWidth,
		height: outHeight,
		frameCount,
		duration: frameCount * delayMs / 1000,
		delayMs,
	}
}
