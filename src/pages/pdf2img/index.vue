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
			<div class="card-title">导出设置</div>
			<div class="label">格式</div>
			<div class="seg">
				<div class="seg-item" :class="{ active: format === 'jpeg' }" @click="format = 'jpeg'">JPG</div>
				<div class="seg-item" :class="{ active: format === 'png' }" @click="format = 'png'">PNG</div>
			</div>
			<div class="label">清晰度：{{ scale }}x（约 {{ Math.round(scale * 96) }} DPI）</div>
			<input type="range" class="range" :value="scale * 10" :min="10" :max="40" :step="5" @input="(e) => (scale = Number(e.target.value) / 10)" />
			<button class="btn-primary" style="margin-top: calc(24 * var(--rpx))" :disabled="!file || busy" @click="generate">
				{{ busy ? `导出中 ${Math.round(progress * 100)}%` : '逐页导出图片' }}
			</button>
			<div v-if="busy" class="progress-wrap">
				<div class="progress-bar"><div class="progress-inner" :style="{ width: progress * 100 + '%' }"></div></div>
			</div>
		</div>

		<div v-if="images.length" class="card">
			<div class="row-between">
				<div class="card-title" style="margin-bottom: 0">导出结果（{{ images.length }} 张）</div>
				<button class="mini-btn" @click="downloadAll">全部下载</button>
			</div>
			<div v-for="(im, i) in images" :key="im.name" class="result-item">
				<img class="out-thumb" :src="im.url" />
				<span class="file-name">{{ im.name }}（{{ im.sizeText }}）</span>
				<button class="mini-btn" @click="downloadOne(i)">下载</button>
			</div>
		</div>
	</div>
</template>

<script>
import { pickFiles, readFileBytes, canvasToBlob, downloadBlob, formatSize, baseName } from '../../utils/file'
import { alertModal } from '../../utils/ui'
import { loadPdfDoc, renderPageToCanvas, getPdfPageCount } from '../../utils/pdfjs'

export default {
	data() {
		return {
			file: null,
			format: 'jpeg',
			scale: 2,
			busy: false,
			progress: 0,
			images: [],
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
				this.clearImages()
			} catch (e) {
				alertModal('无法读取', String((e && e.message) || e))
			}
		},
		clearImages() {
			this.images.forEach((im) => URL.revokeObjectURL(im.url))
			this.images = []
		},
		async generate() {
			this.busy = true
			this.progress = 0
			this.clearImages()
			let doc = null
			try {
				doc = await loadPdfDoc(this.file.bytes)
				const mime = this.format === 'jpeg' ? 'image/jpeg' : 'image/png'
				const ext = this.format === 'jpeg' ? 'jpg' : 'png'
				const base = baseName(this.file.name)
				for (let i = 1; i <= doc.numPages; i++) {
					const page = await doc.getPage(i)
					const canvas = await renderPageToCanvas(page, this.scale)
					const blob = await canvasToBlob(canvas, mime, 0.92)
					this.images.push({
						name: `${base}_第${i}页.${ext}`,
						blob,
						sizeText: formatSize(blob.size),
						url: URL.createObjectURL(blob),
					})
					this.progress = i / doc.numPages
				}
			} catch (e) {
				alertModal('导出失败', String((e && e.message) || e))
			} finally {
				if (doc) await doc.destroy()
				this.busy = false
			}
		},
		downloadOne(i) {
			const im = this.images[i]
			downloadBlob(im.blob, im.name)
		},
		async downloadAll() {
			for (let i = 0; i < this.images.length; i++) {
				this.downloadOne(i)
				await new Promise((res) => setTimeout(res, 400))
			}
		},
	},
}
</script>

<style>
.out-thumb {
	width: calc(64 * var(--rpx));
	height: calc(84 * var(--rpx));
	border-radius: calc(8 * var(--rpx));
	background: #f3f4f6;
	flex-shrink: 0;
	margin-right: calc(16 * var(--rpx));
	object-fit: cover;
}
</style>
