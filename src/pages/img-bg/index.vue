<template>
	<div class="tool-page">
		<div class="card">
			<div class="card-title">选择图片</div>
			<button class="btn-ghost" @click="choose">{{ files.length ? `已选 ${files.length} 张，重新选择` : '选择图片（可多选）' }}</button>
			<div v-if="files.length" class="file-list">
				<div v-for="(f, i) in files" :key="i" class="file-item">
					<img class="file-thumb" :src="f.url" />
					<div class="file-name">
						<span>{{ f.name }}</span>
						<span class="file-size">{{ f.sizeText }}</span>
					</div>
					<button class="mini-btn danger" @click="removeFile(i)">删除</button>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-title">提取设置</div>
			<div class="label">背景容差：{{ tolerance }}（背景越杂、越深，数值调越大）</div>
			<input type="range" class="range" :value="tolerance" :min="5" :max="100" :step="5" @input="(e) => (tolerance = Number(e.target.value))" />
			<button class="btn-primary" style="margin-top: calc(24 * var(--rpx))" :disabled="!files.length || busy" @click="generate">
				{{ busy ? `提取中 ${Math.round(progress * 100)}%` : '提取纯白 / 透明背景' }}
			</button>
			<div v-if="busy" class="progress-wrap">
				<div class="progress-bar"><div class="progress-inner" :style="{ width: progress * 100 + '%' }"></div></div>
			</div>
			<div class="hint" style="margin-top: calc(16 * var(--rpx))">每张图片输出两个文件：纯白底 JPG + 透明底 PNG，全部本地处理不上传。</div>
		</div>

		<div v-if="results.length" class="card">
			<div class="row-between">
				<div class="card-title" style="margin-bottom: 0">提取结果（{{ results.length }} 个文件）</div>
				<button class="mini-btn" @click="downloadAll">全部下载</button>
			</div>
			<div v-for="(r, i) in results" :key="r.name" class="result-item">
				<img class="out-thumb" :class="{ checker: r.kind === '透明' }" :src="r.url" />
				<span class="file-name">{{ r.name }}（{{ r.sizeText }}）</span>
				<button class="mini-btn" @click="downloadOne(i)">下载</button>
			</div>
		</div>
	</div>
</template>

<script>
import { pickFiles, downloadBlob, formatSize, baseName } from '../../utils/file'
import { alertModal, toast } from '../../utils/ui'
import { extractBackgrounds } from '../../utils/img-bg'

export default {
	data() {
		return {
			files: [],
			tolerance: 30,
			busy: false,
			progress: 0,
			results: [],
		}
	},
	methods: {
		async choose() {
			const picked = await pickFiles('image/*', true)
			this.clearFiles()
			this.files = picked.map((f) => ({
				name: f.name,
				blob: f,
				sizeText: formatSize(f.size),
				url: URL.createObjectURL(f),
			}))
		},
		removeFile(i) {
			URL.revokeObjectURL(this.files[i].url)
			this.files.splice(i, 1)
		},
		clearFiles() {
			this.files.forEach((f) => URL.revokeObjectURL(f.url))
			this.files = []
		},
		clearResults() {
			this.results.forEach((r) => URL.revokeObjectURL(r.url))
			this.results = []
		},
		async generate() {
			this.busy = true
			this.progress = 0
			this.clearResults()
			const total = this.files.length
			for (let i = 0; i < total; i++) {
				const f = this.files[i]
				try {
					const { whiteBlob, transBlob } = await extractBackgrounds(f.blob, this.tolerance)
					const base = baseName(f.name)
					this.pushResult(`${base}_纯白底.jpg`, whiteBlob, '纯白')
					this.pushResult(`${base}_透明底.png`, transBlob, '透明')
				} catch (e) {
					alertModal(`「${f.name}」处理失败`, String((e && e.message) || e))
				}
				this.progress = (i + 1) / total
			}
			this.busy = false
			if (this.results.length) toast(`已生成 ${this.results.length} 个文件`)
		},
		pushResult(name, blob, kind) {
			this.results.push({ name, blob, kind, sizeText: formatSize(blob.size), url: URL.createObjectURL(blob) })
		},
		downloadOne(i) {
			const r = this.results[i]
			downloadBlob(r.blob, r.name)
		},
		async downloadAll() {
			for (let i = 0; i < this.results.length; i++) {
				this.downloadOne(i)
				await new Promise((res) => setTimeout(res, 400))
			}
		},
	},
	unmounted() {
		this.clearFiles()
		this.clearResults()
	},
}
</script>

<style>
.file-list {
	margin-top: calc(16 * var(--rpx));
}

.out-thumb {
	width: calc(72 * var(--rpx));
	height: calc(72 * var(--rpx));
	border-radius: calc(8 * var(--rpx));
	background: #f3f4f6;
	flex-shrink: 0;
	margin-right: calc(16 * var(--rpx));
	object-fit: contain;
}

/* 透明 PNG 用棋盘格衬托，方便确认抠图效果 */
.out-thumb.checker {
	background: conic-gradient(#e5e7eb 90deg, #ffffff 90deg 180deg, #e5e7eb 180deg 270deg, #ffffff 270deg);
	background-size: calc(16 * var(--rpx)) calc(16 * var(--rpx));
}
</style>
