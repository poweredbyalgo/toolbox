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
			<div v-if="thumbs.length" class="thumb-scroll">
				<div class="thumb-row">
					<img v-for="(t, i) in thumbs" :key="i" class="thumb-img" :src="t" />
				</div>
			</div>
			<div v-if="!file" class="hint">选择一个 PDF，按页码范围拆分为多个文件。</div>
		</div>

		<div class="card">
			<div class="card-title">页码范围</div>
			<div class="label">每段范围用逗号分隔，各自输出为一个文件，如：1-3,5,8-10</div>
			<input class="input" v-model="ranges" placeholder="例如 1-3,5" />
			<button class="btn-primary" style="margin-top: calc(24 * var(--rpx))" :disabled="!file || busy" @click="generate">
				{{ busy ? '处理中…' : '拆分' }}
			</button>
			<div v-if="busy" class="progress-wrap">
				<div class="progress-bar"><div class="progress-inner" :style="{ width: progress * 100 + '%' }"></div></div>
				<div class="progress-text">{{ Math.round(progress * 100) }}%</div>
			</div>
		</div>

		<div v-if="results.length" class="card">
			<div class="row-between">
				<div class="card-title" style="margin-bottom:0">拆分结果（{{ results.length }} 个文件）</div>
				<button class="mini-btn" @click="downloadAll">全部下载</button>
			</div>
			<div v-for="(r, i) in results" :key="r.name" class="result-item">
				<span class="file-name">{{ r.name }}（{{ r.sizeText }}）</span>
				<button class="mini-btn" @click="downloadOne(i)">下载</button>
			</div>
		</div>
	</div>
</template>

<script>
import { pickFiles, readFileBytes, downloadBytes, formatSize, baseName } from '../../utils/file'
import { alertModal } from '../../utils/ui'
import { getPdfThumbnails, getPdfPageCount } from '../../utils/pdfjs'
import { splitPdf } from '../../utils/pdf-ops'

export default {
	data() {
		return {
			file: null,
			ranges: '',
			thumbs: [],
			busy: false,
			progress: 0,
			results: [],
		}
	},
	methods: {
		async choose() {
			const files = await pickFiles('.pdf,application/pdf', false)
			if (!files.length) return
			const f = files[0]
			const bytes = await readFileBytes(f)
			try {
				const pageCount = await getPdfPageCount(bytes)
				const thumbs = await getPdfThumbnails(bytes, Math.min(pageCount, 8))
				this.file = { name: f.name, bytes, pageCount, sizeText: formatSize(f.size) }
				this.thumbs = thumbs.filter(Boolean)
				this.ranges = `1-${pageCount}`
				this.results = []
			} catch (e) {
				alertModal('无法读取', String((e && e.message) || e))
			}
		},
		async generate() {
			this.busy = true
			this.progress = 0
			this.results = []
			try {
				const list = await splitPdf(this.file.bytes, this.ranges, baseName(this.file.name), (p) => (this.progress = p))
				this.results = list.map((r) => ({ ...r, sizeText: formatSize(r.bytes.length) }))
			} catch (e) {
				alertModal('拆分失败', String((e && e.message) || e))
			} finally {
				this.busy = false
			}
		},
		downloadOne(i) {
			const r = this.results[i]
			downloadBytes(r.bytes, r.name, 'application/pdf')
		},
		async downloadAll() {
			for (let i = 0; i < this.results.length; i++) {
				this.downloadOne(i)
				await new Promise((res) => setTimeout(res, 400))
			}
		},
	},
}
</script>

<style>
.thumb-scroll {
	margin-top: calc(20 * var(--rpx));
	white-space: nowrap;
	overflow-x: auto;
}

.thumb-row {
	display: flex;
}

.thumb-img {
	width: calc(120 * var(--rpx));
	height: calc(160 * var(--rpx));
	flex-shrink: 0;
	margin-right: calc(12 * var(--rpx));
	border-radius: calc(8 * var(--rpx));
	background: #f3f4f6;
	object-fit: contain;
}
</style>
