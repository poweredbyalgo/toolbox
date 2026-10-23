<template>
	<div class="tool-page">
		<div class="card">
			<div class="card-title">选择图片</div>
			<button class="btn-ghost" @click="choose">{{ file ? '重新选择' : '选择图片' }}</button>
			<div v-if="file" class="src-row">
				<img class="src-thumb" :src="file.url" />
				<div class="src-info">
					<div class="file-name">{{ file.name }}</div>
					<div class="file-size">原尺寸 {{ origW }} × {{ origH }} px · {{ file.sizeText }}</div>
				</div>
				<button class="mini-btn danger" @click="clearFile">删除</button>
			</div>
		</div>

		<div v-if="file" class="card">
			<div class="card-title">尺寸设置</div>
			<div class="size-grid">
				<div class="field">
					<div class="label">宽度（px）</div>
					<input class="input" type="number" inputmode="numeric" min="1" max="12000" :value="widthInput" @input="onWidth" />
				</div>
				<div class="field">
					<div class="label">高度（px）</div>
					<input class="input" type="number" inputmode="numeric" min="1" max="12000" :value="heightInput" @input="onHeight" />
				</div>
			</div>
			<label class="lock-row">
				<input type="checkbox" class="lock-check" v-model="lockRatio" />
				<span>锁定宽高比（等比缩放）</span>
			</label>
			<div class="quick-row">
				<button v-for="p in presets" :key="p" class="mini-btn" @click="applyPreset(p)">{{ p }}%</button>
			</div>
			<div class="label">输出格式</div>
			<div class="seg">
				<div class="seg-item" :class="{ active: format === 'png' }" @click="format = 'png'">PNG（无损）</div>
				<div class="seg-item" :class="{ active: format === 'jpg' }" @click="format = 'jpg'">JPG（更小）</div>
			</div>
			<button class="btn-primary" style="margin-top: calc(24 * var(--rpx))" :disabled="busy || !validSize" @click="generate">
				{{ busy ? '处理中…' : '生成新尺寸图片' }}
			</button>
			<div class="hint" style="margin-top: calc(16 * var(--rpx))">
				宽高可手动填写；JPG 会把透明背景铺成白色。全部本地处理，文件不上传。
			</div>
		</div>

		<div v-if="result" class="card">
			<div class="row-between">
				<div class="card-title" style="margin-bottom: 0">生成结果</div>
				<button class="mini-btn" @click="downloadResult">下载</button>
			</div>
			<img class="preview-img checker" :src="result.url" />
			<div class="hint" style="margin-top: calc(12 * var(--rpx))">
				{{ result.name }} · {{ result.width }} × {{ result.height }} px · {{ result.sizeText }}
			</div>
		</div>
	</div>
</template>

<script>
import { pickFiles, downloadBlob, formatSize, baseName } from '../../utils/file'
import { alertModal, toast } from '../../utils/ui'
import { loadDrawable, drawableSize, resizeImage } from '../../utils/img-resize'

const MAX_SIDE = 12000

export default {
	data() {
		return {
			file: null,
			origW: 0,
			origH: 0,
			widthInput: '',
			heightInput: '',
			lockRatio: true,
			format: 'png',
			busy: false,
			presets: [25, 50, 75, 150, 200],
			result: null,
		}
	},
	computed: {
		validSize() {
			const w = Math.round(Number(this.widthInput))
			const h = Math.round(Number(this.heightInput))
			return this.file && w >= 1 && h >= 1 && w <= MAX_SIDE && h <= MAX_SIDE
		},
	},
	methods: {
		async choose() {
			const picked = await pickFiles('image/*', false)
			if (!picked.length) return
			const f = picked[0]
			let drawable
			try {
				drawable = await loadDrawable(f)
			} catch (e) {
				alertModal('无法读取图片', String((e && e.message) || e))
				return
			}
			const { width, height } = drawableSize(drawable)
			if (typeof drawable.close === 'function') drawable.close()
			this.clearFile()
			this.clearResult()
			this.file = { name: f.name, blob: f, sizeText: formatSize(f.size), url: URL.createObjectURL(f) }
			this.origW = width
			this.origH = height
			this.widthInput = String(width)
			this.heightInput = String(height)
		},
		onWidth(e) {
			this.widthInput = e.target.value
			if (this.lockRatio && this.origW) {
				const w = Math.round(Number(e.target.value))
				if (w >= 1) this.heightInput = String(Math.max(1, Math.round((w * this.origH) / this.origW)))
			}
		},
		onHeight(e) {
			this.heightInput = e.target.value
			if (this.lockRatio && this.origH) {
				const h = Math.round(Number(e.target.value))
				if (h >= 1) this.widthInput = String(Math.max(1, Math.round((h * this.origW) / this.origH)))
			}
		},
		applyPreset(p) {
			const w = Math.max(1, Math.round((this.origW * p) / 100))
			const h = Math.max(1, Math.round((this.origH * p) / 100))
			this.widthInput = String(w)
			this.heightInput = String(h)
		},
		clearFile() {
			if (this.file) URL.revokeObjectURL(this.file.url)
			this.file = null
			this.origW = 0
			this.origH = 0
			this.widthInput = ''
			this.heightInput = ''
		},
		clearResult() {
			if (this.result) URL.revokeObjectURL(this.result.url)
			this.result = null
		},
		async generate() {
			if (!this.validSize) {
				alertModal('尺寸无效', `宽高需为 1 ~ ${MAX_SIDE} 之间的整数`)
				return
			}
			this.busy = true
			this.clearResult()
			const w = Math.round(Number(this.widthInput))
			const h = Math.round(Number(this.heightInput))
			try {
				const mime = this.format === 'jpg' ? 'image/jpeg' : 'image/png'
				const blob = await resizeImage(this.file.blob, w, h, {
					mime,
					quality: 0.92,
					background: this.format === 'jpg' ? '#ffffff' : null,
				})
				this.result = {
					name: `${baseName(this.file.name)}_${w}x${h}.${this.format}`,
					blob,
					url: URL.createObjectURL(blob),
					sizeText: formatSize(blob.size),
					width: w,
					height: h,
				}
				toast('已生成新尺寸图片')
			} catch (e) {
				alertModal('处理失败', String((e && e.message) || e))
			}
			this.busy = false
		},
		downloadResult() {
			if (this.result) downloadBlob(this.result.blob, this.result.name)
		},
	},
	unmounted() {
		this.clearFile()
		this.clearResult()
	},
}
</script>

<style>
.src-row {
	display: flex;
	align-items: center;
	margin-top: calc(20 * var(--rpx));
}

.src-thumb {
	width: calc(120 * var(--rpx));
	height: calc(120 * var(--rpx));
	border-radius: calc(12 * var(--rpx));
	background: #f3f4f6;
	flex-shrink: 0;
	object-fit: contain;
}

.src-info {
	flex: 1;
	margin-left: calc(20 * var(--rpx));
	min-width: 0;
}

.size-grid {
	display: flex;
	gap: calc(20 * var(--rpx));
}

.field {
	flex: 1;
	min-width: 0;
}

.field .label {
	margin-top: 0;
}

.lock-row {
	display: flex;
	align-items: center;
	margin-top: calc(16 * var(--rpx));
	font-size: calc(26 * var(--rpx));
	color: #374151;
}

.lock-check {
	width: calc(36 * var(--rpx));
	height: calc(36 * var(--rpx));
	margin-right: calc(12 * var(--rpx));
	accent-color: #2f6bff;
	flex-shrink: 0;
}

.quick-row {
	display: flex;
	flex-wrap: wrap;
	gap: calc(12 * var(--rpx));
	margin-top: calc(16 * var(--rpx));
}

.quick-row .mini-btn {
	margin: 0;
}

/* 结果图棋盘格底，便于查看透明区域 */
.preview-img.checker {
	background: conic-gradient(#e5e7eb 90deg, #ffffff 90deg 180deg, #e5e7eb 180deg 270deg, #ffffff 270deg);
	background-size: calc(24 * var(--rpx)) calc(24 * var(--rpx));
}
</style>
