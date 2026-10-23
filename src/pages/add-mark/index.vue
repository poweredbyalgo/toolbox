<template>
	<div class="tool-page">
		<div class="card">
			<div class="card-title">选择 PDF</div>
			<button class="btn-ghost" @click="choose">{{ file ? '重新选择' : '选择 PDF 文件' }}</button>
			<div v-if="file" class="file-item">
				<div class="file-name">
					<span>{{ file.name }}</span>
					<span class="file-size">{{ file.pageCount }} 页 · {{ file.sizeText }}</span>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-title">水印内容</div>
			<div class="seg">
				<div class="seg-item" :class="{ active: mode === 'text' }" @click="mode = 'text'">文字</div>
				<div class="seg-item" :class="{ active: mode === 'image' }" @click="mode = 'image'">图片</div>
			</div>
			<template v-if="mode === 'text'">
				<div class="label">水印文字</div>
				<input class="input" v-model="text" placeholder="例如：机密文件" />
			</template>
			<template v-else>
				<div class="label">水印图片</div>
				<div class="row">
					<button class="btn-ghost" style="flex:1" @click="chooseImage">{{ imageFile ? imageFile : '选择图片' }}</button>
					<button v-if="imageBytes" class="mini-btn danger" @click="clearImage">清除</button>
				</div>
				<img v-if="imageURL" class="mark-img" :src="imageURL" />
			</template>
			<div class="label">布局</div>
			<div class="seg">
				<div class="seg-item" :class="{ active: layout === 'tile' }" @click="layout = 'tile'">平铺</div>
				<div class="seg-item" :class="{ active: layout === 'center' }" @click="layout = 'center'">居中</div>
			</div>
			<div class="label">颜色</div>
			<div class="row color-row">
				<div
					v-for="c in colorPresets"
					:key="c"
					class="color-dot"
					:class="{ active: color === c }"
					:style="{ backgroundColor: c }"
					@click="color = c"
				></div>
				<input class="input color-input" v-model="color" placeholder="#9ca3af" />
			</div>
			<div class="label">透明度：{{ opacity }}%</div>
			<input type="range" class="range" :value="opacity" :min="5" :max="100" :step="5" @input="(e) => (opacity = Number(e.target.value))" />
			<div class="label">倾斜角度：{{ angle }}°</div>
			<input type="range" class="range" :value="angle" :min="-90" :max="90" :step="5" @input="(e) => (angle = Number(e.target.value))" />
			<div class="label">大小：{{ size }} pt</div>
			<input type="range" class="range" :value="size" :min="16" :max="120" :step="4" @input="(e) => (size = Number(e.target.value))" />
		</div>

		<div class="card">
			<button class="btn-primary" :disabled="!file || busy" @click="generate">
				{{ busy ? '处理中…' : '生成预览' }}
			</button>
			<img v-if="preview" class="preview-img" :src="preview" />
			<div v-if="result" class="result-item">
				<span class="file-name">{{ result.name }}（{{ result.sizeText }}）</span>
				<button class="mini-btn" @click="download">下载</button>
			</div>
		</div>
	</div>
</template>

<script>
import { pickFiles, readFileBytes, downloadBytes, formatSize, baseName } from '../../utils/file'
import { alertModal } from '../../utils/ui'
import { getPdfThumbnails, getPdfPageCount } from '../../utils/pdfjs'
import { addWatermark } from '../../utils/watermark-add'

export default {
	data() {
		return {
			file: null,
			mode: 'text',
			text: '机密',
			imageBytes: null,
			imageURL: '',
			imageFile: '',
			color: '#9ca3af',
			colorPresets: ['#9ca3af', '#ef4444', '#2f6bff', '#111827'],
			opacity: 25,
			angle: 30,
			size: 48,
			layout: 'tile',
			busy: false,
			result: null,
			preview: '',
		}
	},
	methods: {
		async choose() {
			const files = await pickFiles('.pdf,application/pdf', false)
			if (!files.length) return
			const f = files[0]
			try {
				const bytes = await readFileBytes(f)
				const pageCount = await getPdfPageCount(bytes)
				this.file = { name: f.name, bytes, pageCount, sizeText: formatSize(f.size) }
				this.result = null
				this.preview = ''
			} catch (e) {
				alertModal('无法读取', String((e && e.message) || e))
			}
		},
		async chooseImage() {
			const files = await pickFiles('image/*', false)
			if (!files.length) return
			const f = files[0]
			this.imageBytes = await readFileBytes(f)
			this.imageFile = f.name
			if (this.imageURL) URL.revokeObjectURL(this.imageURL)
			this.imageURL = URL.createObjectURL(f)
		},
		clearImage() {
			this.imageBytes = null
			this.imageFile = ''
			if (this.imageURL) URL.revokeObjectURL(this.imageURL)
			this.imageURL = ''
		},
		async generate() {
			this.busy = true
			this.result = null
			this.preview = ''
			try {
				const bytes = await addWatermark(this.file.bytes, {
					mode: this.mode,
					text: this.text,
					imageBytes: this.imageBytes,
					color: this.color,
					opacity: this.opacity / 100,
					angle: this.angle,
					size: this.size,
					layout: this.layout,
				})
				const name = `${baseName(this.file.name)}_已加水印.pdf`
				this.result = { bytes, name, sizeText: formatSize(bytes.length) }
				this.preview = (await getPdfThumbnails(bytes, 1, 600))[0] || ''
			} catch (e) {
				alertModal('生成失败', String((e && e.message) || e))
			} finally {
				this.busy = false
			}
		},
		download() {
			if (this.result) downloadBytes(this.result.bytes, this.result.name, 'application/pdf')
		},
	},
}
</script>

<style>
.color-row {
	flex-wrap: wrap;
}

.color-dot {
	width: calc(56 * var(--rpx));
	height: calc(56 * var(--rpx));
	border-radius: 50%;
	margin-right: calc(16 * var(--rpx));
	border: calc(4 * var(--rpx)) solid transparent;
}

.color-dot.active {
	border-color: #2f6bff;
}

.color-input {
	flex: 1;
	min-width: calc(200 * var(--rpx));
}

.mark-img {
	width: calc(200 * var(--rpx));
	height: calc(200 * var(--rpx));
	background: #f3f4f6;
	border-radius: calc(12 * var(--rpx));
	margin-top: calc(16 * var(--rpx));
	object-fit: contain;
}
</style>
