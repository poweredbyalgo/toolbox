<template>
	<div class="tool-page">
		<div class="card">
			<div class="card-title">转换方向</div>
			<div class="seg">
				<div class="seg-item" :class="{ active: direction === 'gif2mp4' }" @click="switchDirection('gif2mp4')">GIF → MP4</div>
				<div class="seg-item" :class="{ active: direction === 'mp42gif' }" @click="switchDirection('mp42gif')">MP4 → GIF</div>
			</div>
			<div class="hint" style="margin-top: calc(16 * var(--rpx))">{{ directionHint }}</div>
		</div>

		<div class="card">
			<div class="card-title">{{ direction === 'gif2mp4' ? '选择 GIF' : '选择视频' }}</div>
			<button class="btn-ghost" :disabled="busy" @click="choose">
				{{ file ? '重新选择' : chooseLabel }}
			</button>
			<div v-if="file" class="file-item">
				<div class="file-name">
					<span>{{ file.name }}</span>
					<span class="file-size">{{ file.sizeText }}</span>
				</div>
				<button class="mini-btn danger" :disabled="busy" @click="clearFile">删除</button>
			</div>
			<img v-if="file && direction === 'gif2mp4'" class="media-preview" :src="previewUrl" alt="GIF 预览" />
			<video v-if="file && direction === 'mp42gif'" ref="previewVideo" class="media-preview" controls playsinline></video>
			<div v-if="fileInfo" class="hint" style="margin-top: calc(12 * var(--rpx))">{{ fileInfo }}</div>
		</div>

		<div v-if="direction === 'gif2mp4' && !gif2mp4Supported" class="card notice">
			当前浏览器不支持 WebCodecs 视频编码，无法把 GIF 转成 MP4。请使用最新版 Chrome / Edge（Safari 对 H.264 编码的支持不稳定）。MP4 → GIF 不受影响。
		</div>

		<!-- GIF → MP4 -->
		<div v-if="direction === 'gif2mp4'" class="card">
			<div class="card-title">输出设置</div>
			<div class="label">输出宽度（px）</div>
			<input class="input" type="number" inputmode="numeric" min="2" max="1920" v-model.number="gifSettings.width" />
			<div class="preset-row">
				<button v-for="p in gifWidthPresets" :key="p.label" class="mini-btn" @click="gifSettings.width = p.value">{{ p.label }}</button>
			</div>
			<div class="param-hint">
				高度按 GIF 原比例自动计算{{ gifMeta ? `，当前约 ${gifMp4Height} px` : '' }}。放大只会让文件变大，不会增加细节；缩小到 480–640 px 通常最均衡。
			</div>

			<div class="check-row">
				<input type="checkbox" class="check" v-model="gifSettings.keepTiming" />
				<span>保持 GIF 原始帧时序</span>
			</div>
			<div class="param-hint">
				勾选后逐帧沿用 GIF 自带的延迟，动画速度与原文件一致，适合表情包/手绘动画。取消勾选则按下面的目标帧率重新取样，画面更均匀，但速度可能与原文件略有差异。
			</div>

			<div class="label">目标帧率（fps）</div>
			<input class="input" type="number" inputmode="numeric" min="1" max="60" v-model.number="gifSettings.fps" :disabled="gifSettings.keepTiming" />
			<div class="param-hint">
				仅在取消「保持原始帧时序」时生效。帧率越高越流畅、文件越大；GIF 常见 8–15 fps，设得过高只会重复帧。
			</div>

			<button class="adv-toggle" @click="showAdvanced = !showAdvanced">
				<span>高级参数（编码、码率等）</span>
				<span class="adv-arrow">{{ showAdvanced ? '收起 ▲' : '展开 ▼' }}</span>
			</button>

			<div v-if="showAdvanced" class="adv-body">
				<div class="param">
					<div class="label">编码格式</div>
					<select class="input" v-model="gifSettings.codec">
						<option value="h264">H.264 / AVC（兼容性最好）</option>
						<option value="hevc">HEVC / H.265（同画质体积更小）</option>
						<option value="vp9">VP9（开源，体积较小）</option>
						<option value="av1">AV1（压缩率最高）</option>
					</select>
					<div class="param-hint">
						H.264 几乎所有手机、浏览器、播放器和剪辑软件都能播放，最稳妥。HEVC 同画质约小 30%，但部分旧设备、Windows 自带播放器可能不支持；VP9 / AV1 压缩率更高，但兼容性更差。默认 H.264。
					</div>
				</div>

				<div class="param">
					<div class="label">视频码率（kbps）</div>
					<input class="input" type="number" inputmode="numeric" min="0" step="50" v-model.number="gifSettings.bitrateKbps" />
					<div class="preset-row">
						<button class="mini-btn" @click="gifSettings.bitrateKbps = recommendedBitrate">按当前分辨率推荐（约 {{ recommendedBitrate }}）</button>
						<button class="mini-btn" @click="gifSettings.bitrateKbps = 0">自动</button>
					</div>
					<div class="param-hint">
						0 表示自动估算。码率越高，细节保留越多、文件越大；过低会出现块状模糊。GIF 画面色块较多，通常 400–2000 kbps 已足够。
					</div>
				</div>

				<div class="param">
					<div class="label">码率模式</div>
					<div class="seg">
						<div class="seg-item" :class="{ active: gifSettings.bitrateMode === 'variable' }" @click="gifSettings.bitrateMode = 'variable'">VBR 可变</div>
						<div class="seg-item" :class="{ active: gifSettings.bitrateMode === 'constant' }" @click="gifSettings.bitrateMode = 'constant'">CBR 恒定</div>
					</div>
					<div class="param-hint">
						VBR 按画面复杂度分配码率，同体积画质更好，适合本地保存；CBR 码率平稳、文件大小可预估，适合网络传输或直播。默认 VBR。
					</div>
				</div>

				<div class="param">
					<div class="label">关键帧间隔（帧，0 = 自动约 2 秒）</div>
					<input class="input" type="number" inputmode="numeric" min="0" max="600" v-model.number="gifSettings.keyFrameInterval" />
					<div class="param-hint">
						间隔越小，播放器拖动定位和循环起播越快，但文件更大；间隔越大压缩率越高。画面变化剧烈时建议 30–60 帧。
					</div>
				</div>

				<div class="param">
					<div class="label">硬件加速</div>
					<select class="input" v-model="gifSettings.hardwareAcceleration">
						<option value="no-preference">自动（交给浏览器决定）</option>
						<option value="prefer-hardware">优先硬件编码</option>
						<option value="prefer-software">优先软件编码</option>
					</select>
					<div class="param-hint">
						硬件编码更快、更省电；但个别显卡/驱动输出画质略有差异或直接不支持。软件编码更稳定但速度慢。默认自动。
					</div>
				</div>

				<div class="param">
					<div class="label">编码模式</div>
					<select class="input" v-model="gifSettings.latencyMode">
						<option value="quality">质量优先</option>
						<option value="realtime">实时优先</option>
					</select>
					<div class="param-hint">
						质量优先让编码器多分析画面，画质更好；实时优先降低编码延迟、速度更快，但同码率下画质略差。本地转换建议质量优先。
					</div>
				</div>

				<div class="param">
					<div class="label">背景色（透明区域填充）</div>
					<input class="color-input" type="color" v-model="gifSettings.background" />
					<div class="param-hint">
						MP4 没有透明通道，GIF 的透明区域会填充为该颜色。默认白色；深色动画建议改成黑色，避免边缘出现白边。
					</div>
				</div>
			</div>

			<button class="btn-primary" style="margin-top: calc(24 * var(--rpx))" :disabled="convertDisabled" @click="convert">
				{{ busy ? '转换中…' : '开始转 MP4' }}
			</button>
			<div v-if="busy" class="progress-wrap">
				<div class="progress-bar"><div class="progress-inner" :style="{ width: progress * 100 + '%' }"></div></div>
				<div class="progress-text">{{ progressText }}</div>
			</div>
			<div class="hint" style="margin-top: calc(16 * var(--rpx))">
				全部在浏览器本地完成，文件不会上传。编码能力取决于设备，首次使用若失败可改用 H.264 + 软件编码。
			</div>
		</div>

		<!-- MP4 → GIF -->
		<div v-if="direction === 'mp42gif'" class="card">
			<div class="card-title">输出设置</div>
			<div class="field-grid">
				<div class="field">
					<div class="label">起始时间（秒）</div>
					<input class="input" type="number" inputmode="decimal" min="0" step="0.1" v-model.number="mp4Settings.start" />
				</div>
				<div class="field">
					<div class="label">结束时间（秒）</div>
					<input class="input" type="number" inputmode="decimal" min="0" step="0.1" v-model.number="mp4Settings.end" />
				</div>
			</div>
			<div class="param-hint">
				只导出该时间段。GIF 体积随时长线性增长，建议控制在 10 秒以内；长视频请先用「结束时间」截取精彩片段。
			</div>

			<div class="label">帧率（fps）</div>
			<input class="input" type="number" inputmode="numeric" min="1" max="30" v-model.number="mp4Settings.fps" />
			<div class="param-hint">
				每秒抽取多少帧。越高越流畅、文件越大，GIF 常用 10–15 fps。GIF 帧延迟以 10ms 为单位，10/20/50 以外的帧率实际速度会有轻微偏差。
			</div>

			<div class="label">输出宽度（px）</div>
			<input class="input" type="number" inputmode="numeric" min="2" max="1920" v-model.number="mp4Settings.width" />
			<div class="preset-row">
				<button v-for="p in mp4WidthPresets" :key="p.label" class="mini-btn" @click="mp4Settings.width = p.value">{{ p.label }}</button>
			</div>
			<div class="param-hint">
				高度按视频原比例自动计算{{ videoMeta ? `，当前约 ${mp4GifHeight} px` : '' }}。GIF 宽度 320–640 px 最实用，太大文件会迅速膨胀。
			</div>

			<button class="adv-toggle" @click="showAdvanced = !showAdvanced">
				<span>高级参数（调色板、抖动等）</span>
				<span class="adv-arrow">{{ showAdvanced ? '收起 ▲' : '展开 ▼' }}</span>
			</button>

			<div v-if="showAdvanced" class="adv-body">
				<div class="param">
					<div class="label">颜色数量：{{ mp4Settings.colors }}</div>
					<input type="range" class="range" min="2" max="256" step="1" v-model.number="mp4Settings.colors" />
					<div class="param-hint">
						GIF 最多 256 色。颜色越少文件越小，但渐变更容易出现色带；视频转 GIF 常用 128–256。低于 32 色会出现明显色块。
					</div>
				</div>

				<div class="param">
					<div class="label">调色板精度</div>
					<div class="seg">
						<div class="seg-item" :class="{ active: mp4Settings.format === 'rgb565' }" @click="mp4Settings.format = 'rgb565'">rgb565 高质量</div>
						<div class="seg-item" :class="{ active: mp4Settings.format === 'rgb444' }" @click="mp4Settings.format = 'rgb444'">rgb444 更快</div>
					</div>
					<div class="param-hint">
						rgb565 每通道 5/6/5 位，绿色更细腻、量化稍慢；rgb444 每通道 4 位，计算更快、文件略小，但色彩过渡略生硬。
					</div>
				</div>

				<div class="param">
					<div class="label">调色板模式</div>
					<div class="seg">
						<div class="seg-item" :class="{ active: mp4Settings.paletteMode === 'global' }" @click="mp4Settings.paletteMode = 'global'">全片统一</div>
						<div class="seg-item" :class="{ active: mp4Settings.paletteMode === 'frame' }" @click="mp4Settings.paletteMode = 'frame'">每帧独立</div>
					</div>
					<div class="param-hint">
						全片统一：所有帧共用一张调色板，颜色稳定、闪烁少、文件更小（推荐）；每帧独立：对画面颜色剧烈变化的视频更准确，但可能出现颜色跳动且文件更大。
					</div>
				</div>

				<div class="param">
					<div class="check-row">
						<input type="checkbox" class="check" v-model="mp4Settings.dither" />
						<span>开启抖动（Floyd–Steinberg）</span>
					</div>
					<div class="label" style="margin-top: calc(12 * var(--rpx))">抖动强度：{{ Math.round(mp4Settings.ditherStrength * 100) }}%</div>
					<input type="range" class="range" min="0.1" max="1" step="0.05" v-model.number="mp4Settings.ditherStrength" :disabled="!mp4Settings.dither" />
					<div class="param-hint">
						抖动用像素点交错模拟更多颜色，渐变和阴影更平滑，但会增加噪点、体积变大且编码更慢。强度越高扩散越强。颜色数较低（≤64）时效果最明显，关闭时色带更明显。
					</div>
				</div>

				<div class="param">
					<div class="label">循环次数</div>
					<input class="input" type="number" inputmode="numeric" min="-1" max="65535" v-model.number="mp4Settings.loop" />
					<div class="param-hint">
						0 = 无限循环（表情包常用）；-1 = 只播放一次；正数 = 额外循环次数。部分聊天软件会忽略该设置并强制循环。
					</div>
				</div>
			</div>

			<button class="btn-primary" style="margin-top: calc(24 * var(--rpx))" :disabled="convertDisabled" @click="convert">
				{{ busy ? '转换中…' : '开始转 GIF' }}
			</button>
			<div v-if="busy" class="progress-wrap">
				<div class="progress-bar"><div class="progress-inner" :style="{ width: progress * 100 + '%' }"></div></div>
				<div class="progress-text">{{ progressText }}</div>
			</div>
			<div class="hint" style="margin-top: calc(16 * var(--rpx))">
				全部在浏览器本地完成，文件不会上传。视频解码依赖浏览器，HEVC 等编码可能无法读取，建议先转成 H.264 的 MP4。
			</div>
		</div>

		<div v-if="result" class="card">
			<div class="row-between">
				<div class="card-title" style="margin-bottom: 0">转换结果</div>
				<button class="mini-btn" @click="downloadResult">下载</button>
			</div>
			<video v-if="result.type === 'mp4'" class="media-preview" :src="result.url" controls playsinline></video>
			<img v-else class="media-preview" :src="result.url" alt="转换后的 GIF" />
			<div class="hint" style="margin-top: calc(12 * var(--rpx))">
				{{ result.name }} · {{ result.sizeText }} · {{ result.width }} × {{ result.height }} px · 约 {{ formatDuration(result.duration) }}
			</div>
			<div v-if="result.extra" class="param-hint">{{ result.extra }}</div>
		</div>
	</div>
</template>

<script>
import { baseName, downloadBlob, formatSize, pickFiles } from '../../utils/file'
import { alertModal, toast } from '../../utils/ui'
import { isGifToMp4Supported, readGifMeta, convertGifToMp4, estimateBitrate } from '../../utils/gif-to-mp4'
import { convertVideoToGif, loadVideoTo } from '../../utils/mp4-to-gif'

export default {
	data() {
		return {
			direction: 'gif2mp4',
			file: null,
			previewUrl: '',
			gifMeta: null,
			videoMeta: null,
			showAdvanced: false,
			busy: false,
			progress: 0,
			progressText: '',
			result: null,
			gif2mp4Supported: isGifToMp4Supported(),
			gifSettings: {
				width: 480,
				keepTiming: true,
				fps: 10,
				background: '#ffffff',
				codec: 'h264',
				bitrateKbps: 0,
				bitrateMode: 'variable',
				keyFrameInterval: 0,
				hardwareAcceleration: 'no-preference',
				latencyMode: 'quality',
			},
			mp4Settings: {
				start: 0,
				end: 10,
				fps: 10,
				width: 480,
				colors: 256,
				format: 'rgb565',
				paletteMode: 'global',
				dither: false,
				ditherStrength: 0.6,
				loop: 0,
			},
		}
	},
	computed: {
		chooseLabel() {
			return this.direction === 'gif2mp4' ? '选择 GIF 文件' : '选择视频文件'
		},
		directionHint() {
			return this.direction === 'gif2mp4'
				? '把动图 GIF 转成通用视频 MP4，可调编码、码率、帧率等参数；透明区域会填充背景色。'
				: '把视频截取片段转成 GIF，可调帧率、颜色数、抖动等参数；建议先截取 10 秒以内。'
		},
		fileInfo() {
			if (!this.file) return ''
			if (this.direction === 'gif2mp4' && this.gifMeta) {
				return `${this.gifMeta.width} × ${this.gifMeta.height} px · ${this.gifMeta.frameCount} 帧 · ${this.gifMeta.duration.toFixed(2)} 秒`
			}
			if (this.direction === 'mp42gif' && this.videoMeta) {
				const longHint = this.videoMeta.duration > 30 ? ' · 视频较长，建议截取片段' : ''
				return `${this.videoMeta.width} × ${this.videoMeta.height} px · ${this.videoMeta.duration.toFixed(1)} 秒${longHint}`
			}
			return ''
		},
		gifMp4Width() {
			return Math.max(2, Math.min(1920, Math.round(Number(this.gifSettings.width) || 0)))
		},
		gifMp4Height() {
			if (!this.gifMeta) return 0
			return Math.max(2, Math.round((this.gifMp4Width * this.gifMeta.height) / this.gifMeta.width))
		},
		gifMp4Fps() {
			if (!this.gifSettings.keepTiming || !this.gifMeta) {
				return Math.max(1, Math.min(60, Math.round(Number(this.gifSettings.fps) || 10)))
			}
			return Math.max(1, Math.min(60, Math.round(this.gifMeta.frameCount / Math.max(this.gifMeta.duration, 0.01))))
		},
		recommendedBitrate() {
			if (!this.gifMeta) return 800
			return estimateBitrate(this.gifMp4Width, this.gifMp4Height, this.gifMp4Fps)
		},
		gifWidthPresets() {
			const presets = [{ label: '原始宽度', value: this.gifMeta ? Math.min(this.gifMeta.width, 1920) : 480 }]
			;[640, 480, 320].forEach((value) => {
				if (!this.gifMeta || this.gifMeta.width > value) presets.push({ label: `${value}px`, value })
			})
			return presets
		},
		mp4WidthPresets() {
			const presets = [{ label: '原始宽度', value: this.videoMeta ? Math.min(this.videoMeta.width, 1920) : 480 }]
			;[640, 480, 320].forEach((value) => {
				if (!this.videoMeta || this.videoMeta.width > value) presets.push({ label: `${value}px`, value })
			})
			return presets
		},
		mp4GifWidth() {
			return Math.max(2, Math.min(1920, Math.round(Number(this.mp4Settings.width) || 0)))
		},
		mp4GifHeight() {
			if (!this.videoMeta) return 0
			return Math.max(2, Math.round((this.mp4GifWidth * this.videoMeta.height) / this.videoMeta.width))
		},
		convertDisabled() {
			if (!this.file || this.busy) return true
			if (this.direction === 'gif2mp4' && !this.gif2mp4Supported) return true
			return false
		},
	},
	methods: {
		switchDirection(direction) {
			if (this.direction === direction || this.busy) return
			this.clearFile()
			this.clearResult()
			this.showAdvanced = false
			this.direction = direction
		},
		async choose() {
			if (this.busy) return
			const isGif = this.direction === 'gif2mp4'
			const files = await pickFiles(isGif ? 'image/gif,.gif' : 'video/mp4,video/quicktime,video/webm,video/*', false)
			if (!files.length) return
			const picked = files[0]
			this.clearFile()
			this.clearResult()
			this.file = { blob: picked, name: picked.name, sizeText: formatSize(picked.size) }
			this.previewUrl = URL.createObjectURL(picked)

			if (isGif) {
				try {
					const meta = await readGifMeta(picked)
					if (!meta.frameCount) throw new Error('没有找到可显示的 GIF 画面帧')
					this.gifMeta = meta
					this.gifSettings.width = Math.min(meta.width, 640)
					this.gifSettings.fps = Math.max(1, Math.min(60, Math.round(meta.frameCount / Math.max(meta.duration, 0.01))))
				} catch (e) {
					alertModal('无法读取 GIF', String((e && e.message) || e))
					this.clearFile()
				}
				return
			}

			await this.$nextTick()
			try {
				const meta = await loadVideoTo(this.$refs.previewVideo, this.previewUrl)
				this.videoMeta = meta
				this.mp4Settings.start = 0
				this.mp4Settings.end = Math.min(10, Math.round(meta.duration * 10) / 10)
				this.mp4Settings.width = Math.min(meta.width, 480)
			} catch (e) {
				alertModal('无法读取视频', String((e && e.message) || e))
				this.clearFile()
			}
		},
		clearFile() {
			const video = this.$refs.previewVideo
			if (video) {
				try {
					video.pause()
					video.removeAttribute('src')
					video.load()
				} catch (e) {
					// 忽略卸载时的异常
				}
			}
			if (this.previewUrl) URL.revokeObjectURL(this.previewUrl)
			this.previewUrl = ''
			this.file = null
			this.gifMeta = null
			this.videoMeta = null
		},
		clearResult() {
			if (this.result) URL.revokeObjectURL(this.result.url)
			this.result = null
		},
		async convert() {
			if (this.convertDisabled || !this.file) return
			this.clearResult()
			this.busy = true
			this.progress = 0
			this.progressText = '准备中…'
			try {
				if (this.direction === 'gif2mp4') {
					const res = await convertGifToMp4({
						file: this.file.blob,
						width: this.gifMp4Width,
						fps: Math.max(1, Math.min(60, Math.round(Number(this.gifSettings.fps) || 30))),
						keepTiming: this.gifSettings.keepTiming,
						codec: this.gifSettings.codec,
						bitrateKbps: Math.max(0, Number(this.gifSettings.bitrateKbps) || 0),
						bitrateMode: this.gifSettings.bitrateMode,
						keyFrameInterval: Math.max(0, Number(this.gifSettings.keyFrameInterval) || 0),
						hardwareAcceleration: this.gifSettings.hardwareAcceleration,
						latencyMode: this.gifSettings.latencyMode,
						background: this.gifSettings.background,
						onProgress: (ratio) => {
							this.progress = ratio
							this.progressText = `编码中 ${Math.round(ratio * 100)}%`
						},
					})
					const name = `${baseName(this.file.name)}_${res.width}x${res.height}.mp4`
					this.result = {
						type: 'mp4',
						blob: res.blob,
						url: URL.createObjectURL(res.blob),
						name,
						sizeText: formatSize(res.blob.size),
						width: res.width,
						height: res.height,
						duration: res.duration,
						extra: `${res.codecLabel} · ${res.bitrateKbps} kbps · ${res.frameCount} 帧`,
					}
				} else {
					const meta = this.videoMeta
					if (!meta) throw new Error('视频尚未加载完成')
					const start = Math.max(0, Number(this.mp4Settings.start) || 0)
					const end = Number(this.mp4Settings.end)
					if (!(end > start)) throw new Error('结束时间必须大于开始时间')
					if (end > meta.duration + 0.05) throw new Error(`结束时间不能超过视频时长（${meta.duration.toFixed(1)} 秒）`)
					const fps = Math.max(1, Math.min(30, Math.round(Number(this.mp4Settings.fps) || 10)))
					const res = await convertVideoToGif({
						video: this.$refs.previewVideo,
						start,
						end: Math.min(end, meta.duration),
						fps,
						width: this.mp4GifWidth,
						colors: Math.max(2, Math.min(256, Math.round(Number(this.mp4Settings.colors) || 256))),
						format: this.mp4Settings.format,
						dither: this.mp4Settings.dither ? this.mp4Settings.ditherStrength : 0,
						paletteMode: this.mp4Settings.paletteMode,
						loop: Math.round(Number(this.mp4Settings.loop) || 0),
						onProgress: (ratio) => {
							this.progress = ratio
							this.progressText = `生成 GIF ${Math.round(ratio * 100)}%`
						},
					})
					const name = `${baseName(this.file.name)}_${res.width}x${res.height}.gif`
					this.result = {
						type: 'gif',
						blob: res.blob,
						url: URL.createObjectURL(res.blob),
						name,
						sizeText: formatSize(res.blob.size),
						width: res.width,
						height: res.height,
						duration: res.duration,
						extra: `${res.frameCount} 帧 · 帧延迟 ${res.delayMs}ms`,
					}
				}
				toast('转换完成')
			} catch (e) {
				alertModal('转换失败', String((e && e.message) || e))
			}
			this.busy = false
			this.progress = 0
			this.progressText = ''
		},
		downloadResult() {
			if (this.result) downloadBlob(this.result.blob, this.result.name)
		},
		formatDuration(seconds) {
			const value = Number(seconds) || 0
			return `${value.toFixed(2)} 秒`
		},
	},
	unmounted() {
		this.clearFile()
		this.clearResult()
	},
}
</script>

<style>
.media-preview {
	width: 100%;
	max-height: calc(560 * var(--rpx));
	margin-top: calc(20 * var(--rpx));
	border-radius: calc(12 * var(--rpx));
	background: #0f172a;
	object-fit: contain;
}

.notice {
	background: #fffbeb;
	color: #92400e;
	font-size: calc(24 * var(--rpx));
	line-height: 1.7;
}

.field-grid {
	display: flex;
	gap: calc(20 * var(--rpx));
}

.field {
	flex: 1;
	min-width: 0;
}

.preset-row {
	display: flex;
	flex-wrap: wrap;
	gap: calc(12 * var(--rpx));
	margin-top: calc(12 * var(--rpx));
}

.preset-row .mini-btn {
	margin: 0;
}

.param {
	margin-top: calc(24 * var(--rpx));
}

.param-hint {
	margin-top: calc(8 * var(--rpx));
	font-size: calc(22 * var(--rpx));
	color: #9ca3af;
	line-height: 1.6;
}

.check-row {
	display: flex;
	align-items: center;
	margin-top: calc(20 * var(--rpx));
	font-size: calc(26 * var(--rpx));
	color: #374151;
}

.check {
	width: calc(36 * var(--rpx));
	height: calc(36 * var(--rpx));
	margin-right: calc(12 * var(--rpx));
	accent-color: #2f6bff;
	flex-shrink: 0;
}

.adv-toggle {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	box-sizing: border-box;
	margin-top: calc(28 * var(--rpx));
	padding: calc(20 * var(--rpx)) calc(24 * var(--rpx));
	background: #f5f7fb;
	border-radius: calc(12 * var(--rpx));
	font-size: calc(26 * var(--rpx));
	color: #2f6bff;
}

.adv-toggle:active {
	background: #eef2ff;
}

.adv-arrow {
	font-size: calc(23 * var(--rpx));
	color: #6b7280;
}

.adv-body {
	margin-top: calc(8 * var(--rpx));
	padding-top: calc(4 * var(--rpx));
	border-top: calc(1 * var(--rpx)) solid #f0f1f3;
}

.color-input {
	width: calc(140 * var(--rpx));
	height: calc(72 * var(--rpx));
	padding: 0;
	border: calc(1 * var(--rpx)) solid #e5e7eb;
	border-radius: calc(12 * var(--rpx));
	background: #fafbfc;
	margin-top: calc(12 * var(--rpx));
}
</style>
