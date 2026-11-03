// GIF → MP4：gifuct-js 解析 GIF 帧，canvas 合成，WebCodecs 编码，mp4-muxer 封装
import { decompressFrames, parseGIF } from 'gifuct-js'
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'

// 单次最多输出帧数，避免超长 GIF 长时间占用主线程
const MAX_OUTPUT_FRAMES = 3000

const CODECS = {
	h264: { mux: 'avc', label: 'H.264', strings: ['avc1.42001f', 'avc1.4d0028', 'avc1.640028'] },
	hevc: { mux: 'hevc', label: 'HEVC', strings: ['hvc1.1.6.L93.B0', 'hvc1.1.6.L120.B0'] },
	vp9: { mux: 'vp9', label: 'VP9', strings: ['vp09.00.10.08', 'vp09.00.41.08'] },
	av1: { mux: 'av1', label: 'AV1', strings: ['av01.0.04M.08', 'av01.0.08M.08'] },
}

export function isGifToMp4Supported() {
	return typeof window !== 'undefined' && typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function'
}

// 只解析容器与帧头，得到尺寸、帧数、总时长（不做像素解码，速度快）
export async function readGifMeta(file) {
	const parsed = parseGIF(await file.arrayBuffer())
	const images = parsed.frames.filter((f) => f.image)
	let duration = 0
	for (const frame of images) {
		const delay = frame.gce ? (frame.gce.delay || 10) * 10 : 100
		duration += normalizeDelay(delay)
	}
	return {
		width: parsed.lsd.width,
		height: parsed.lsd.height,
		frameCount: images.length,
		duration: duration / 1000,
	}
}

function normalizeDelay(delay) {
	// 小于 20ms 的延迟会被浏览器按 100ms 处理，这里统一到 100ms 保证播放速度一致
	return delay < 20 ? 100 : delay
}

export async function decodeGif(file) {
	const parsed = parseGIF(await file.arrayBuffer())
	const rawFrames = decompressFrames(parsed, true)
	const frames = rawFrames.map((frame) => ({ ...frame, delay: normalizeDelay(frame.delay) }))
	const duration = frames.reduce((sum, frame) => sum + frame.delay, 0)
	return {
		width: parsed.lsd.width,
		height: parsed.lsd.height,
		frames,
		duration,
	}
}

function evenSize(value) {
	return Math.max(2, Math.round(value / 2) * 2)
}

// 按分辨率/帧率估算一个可用的默认码率（kbps）
export function estimateBitrate(width, height, fps) {
	const raw = Math.round((width * height * Math.max(fps, 1) * 0.12) / 1000)
	return Math.max(200, Math.round(raw / 100) * 100)
}

async function pickCodec(key, config) {
	const entry = CODECS[key] || CODECS.h264
	for (const codec of entry.strings) {
		const candidate = {
			...config,
			codec,
			// H.264 需要 avcC 描述块，mp4-muxer 默认按 avc 格式写入
			...(entry.mux === 'avc' ? { avc: { format: 'avc' } } : {}),
			alpha: 'discard',
		}
		try {
			const support = await VideoEncoder.isConfigSupported(candidate)
			if (support.supported) return { codec, config: candidate, mux: entry.mux, label: entry.label }
		} catch (e) {
			// 该编码字符串不被支持，继续尝试下一个
		}
	}
	throw new Error(`当前浏览器/设备不支持 ${entry.label} 编码，请改用 H.264`)
}

export async function convertGifToMp4({
	file,
	width = 480,
	fps = 0,
	keepTiming = true,
	codec = 'h264',
	bitrateKbps = 0,
	bitrateMode = 'variable',
	keyFrameInterval = 0,
	hardwareAcceleration = 'no-preference',
	latencyMode = 'quality',
	background = '#ffffff',
	onProgress,
}) {
	if (!isGifToMp4Supported()) {
		throw new Error('当前浏览器不支持 WebCodecs 视频编码，请使用最新版 Chrome / Edge')
	}

	const gif = await decodeGif(file)
	if (!gif.frames.length) throw new Error('GIF 中没有可用的画面帧')

	const outWidth = evenSize(Math.max(2, Math.min(4096, Math.round(width))))
	const outHeight = evenSize(Math.max(2, (outWidth * gif.height) / gif.width))

	// 帧时序：保持原速时逐帧使用 GIF 自带延迟；否则按目标帧率重采样
	let timeline = null
	let totalDuration = gif.duration / 1000
	let outputCount = gif.frames.length
	let effectiveFps = Math.max(1, Math.min(60, Math.round(gif.frames.length / Math.max(totalDuration, 0.01))))
	if (keepTiming) {
		if (outputCount > MAX_OUTPUT_FRAMES) {
			throw new Error(`GIF 帧数过多（${outputCount} 帧），请取消「保持原始帧时序」并降低帧率`)
		}
	} else {
		const targetFps = Math.max(1, Math.min(60, Math.round(fps || 10)))
		outputCount = Math.max(1, Math.min(MAX_OUTPUT_FRAMES, Math.round((gif.duration / 1000) * targetFps)))
		const starts = []
		let cursor = 0
		for (const frame of gif.frames) {
			starts.push(cursor)
			cursor += frame.delay
		}
		timeline = []
		// 每个输出帧取该时刻正在显示的 GIF 帧
		let sourceIndex = 0
		for (let i = 0; i < outputCount; i++) {
			const time = (i * 1000) / targetFps
			while (sourceIndex + 1 < starts.length && starts[sourceIndex + 1] <= time) sourceIndex++
			timeline.push(sourceIndex)
		}
		totalDuration = outputCount / targetFps
		effectiveFps = targetFps
	}

	const bitrate = (bitrateKbps > 0 ? bitrateKbps : estimateBitrate(outWidth, outHeight, effectiveFps)) * 1000
	const { codec: encoderCodec, config, mux, label } = await pickCodec(codec, {
		width: outWidth,
		height: outHeight,
		bitrate,
		framerate: effectiveFps,
		bitrateMode,
		latencyMode,
		hardwareAcceleration,
	})

	// 合成画布：按 GIF 原始尺寸叠加各帧，再整体缩放到输出尺寸
	const compose = document.createElement('canvas')
	compose.width = gif.width
	compose.height = gif.height
	const composeCtx = compose.getContext('2d')
	const patchCanvas = document.createElement('canvas')
	patchCanvas.width = gif.width
	patchCanvas.height = gif.height
	const patchCtx = patchCanvas.getContext('2d')

	const output = document.createElement('canvas')
	output.width = outWidth
	output.height = outHeight
	const outputCtx = output.getContext('2d')
	outputCtx.imageSmoothingEnabled = true
	outputCtx.imageSmoothingQuality = 'high'

	const target = new ArrayBufferTarget()
	const muxer = new Muxer({
		target,
		video: { codec: mux, width: outWidth, height: outHeight, frameRate: effectiveFps },
		fastStart: 'in-memory',
		firstTimestampBehavior: 'offset',
	})

	let encoderError = null
	const encoder = new VideoEncoder({
		output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
		error: (error) => {
			encoderError = error
		},
	})
	encoder.configure(config)

	let renderedIndex = -1
	let snapshot = null
	const clampRect = (frame) => {
		const left = Math.max(0, Math.min(frame.dims.left, gif.width - 1))
		const top = Math.max(0, Math.min(frame.dims.top, gif.height - 1))
		const width = Math.max(1, Math.min(frame.dims.width, gif.width - left))
		const height = Math.max(1, Math.min(frame.dims.height, gif.height - top))
		return { left, top, width, height }
	}

	// 画出一帧（含 disposal=3 的快照）
	const renderFrame = (index) => {
		const frame = gif.frames[index]
		const rect = clampRect(frame)
		if (frame.disposalType === 3) snapshot = composeCtx.getImageData(rect.left, rect.top, rect.width, rect.height)
		// 补丁先画到临时画布，再整体叠加：透明像素不会擦掉已有画面
		const imageData = new ImageData(frame.patch, frame.dims.width, frame.dims.height)
		patchCtx.putImageData(imageData, 0, 0)
		composeCtx.drawImage(patchCanvas, 0, 0, rect.width, rect.height, rect.left, rect.top, rect.width, rect.height)
	}

	// 应用当前帧的 disposal 方式，为下一帧准备画布状态
	const disposeFrame = (index) => {
		const frame = gif.frames[index]
		const rect = clampRect(frame)
		if (frame.disposalType === 2) {
			composeCtx.clearRect(rect.left, rect.top, rect.width, rect.height)
		} else if (frame.disposalType === 3 && snapshot) {
			composeCtx.putImageData(snapshot, rect.left, rect.top)
			snapshot = null
		}
	}

	// 前进到目标帧：途中经过的帧也要绘制并处理 disposal，才能得到正确的合成画面
	const advanceTo = (targetIndex) => {
		while (renderedIndex < targetIndex) {
			if (renderedIndex >= 0) disposeFrame(renderedIndex)
			renderedIndex++
			renderFrame(renderedIndex)
		}
	}

	const keyEvery = keyFrameInterval > 0 ? Math.round(keyFrameInterval) : Math.max(1, Math.round(effectiveFps * 2))
	let timestampMs = 0

	try {
		for (let i = 0; i < outputCount; i++) {
			if (encoderError) throw encoderError
			const sourceIndex = keepTiming ? i : timeline[i]
			advanceTo(sourceIndex)

			// 统一铺底色：GIF 的透明区域在 MP4 里没有透明通道
			outputCtx.fillStyle = background
			outputCtx.fillRect(0, 0, outWidth, outHeight)
			outputCtx.drawImage(compose, 0, 0, outWidth, outHeight)

			const durationMs = keepTiming
				? gif.frames[i].delay
				: 1000 / effectiveFps
			const frame = new VideoFrame(output, {
				timestamp: Math.round(timestampMs * 1000),
				duration: Math.round(durationMs * 1000),
			})
			encoder.encode(frame, { keyFrame: i % keyEvery === 0 })
			frame.close()
			timestampMs += durationMs

			if (onProgress) onProgress((i + 1) / outputCount)
			await relieveEncoder(encoder, () => encoderError)
			if (i % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0))
		}

		// 等待编码器把队列里的帧全部输出
		await encoder.flush()
		if (encoderError) throw encoderError
		encoder.close()
		muxer.finalize()
	} catch (error) {
		try {
			if (encoder.state !== 'closed') encoder.close()
		} catch (e) {
			// ignore
		}
		throw error
	}

	const blob = new Blob([target.buffer], { type: 'video/mp4' })
	return {
		blob,
		width: outWidth,
		height: outHeight,
		duration: timestampMs / 1000,
		frameCount: outputCount,
		codec: encoderCodec,
		codecLabel: label,
		bitrateKbps: Math.round(bitrate / 1000),
	}
}

// 编码队列过长时稍作等待，避免内存暴涨
async function relieveEncoder(encoder, getError) {
	while (encoder.encodeQueueSize > 10) {
		const error = getError()
		if (error) throw error
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
}
