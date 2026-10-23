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
			<div class="hint">去水印 = 删除 PDF 中的水印图片对象（带透明蒙版、跨页重复出现的图片，以及 Watermark 注释），不做栅格化，正文文字与排版保持原样。</div>
		</div>

		<div class="card">
			<button class="btn-primary" :disabled="!file || busy" @click="detect">
				{{ busy ? '处理中…' : file && !candidates.length && !detected ? '识别水印' : '重新识别' }}
			</button>
			<div v-if="busy" class="progress-wrap">
				<div class="progress-bar"><div class="progress-inner" :style="{ width: progress * 100 + '%' }"></div></div>
				<div class="progress-text">{{ Math.round(progress * 100) }}%</div>
			</div>
		</div>

		<div v-if="detected && !candidates.length" class="card">
			<div class="hint">未检测到水印图片对象。该文件可能没有可结构化删除的水印（例如水印是直接绘制在页面内容里的普通图片）。</div>
		</div>

		<div v-if="candidates.length" class="card">
			<div class="row-between">
				<div class="card-title" style="margin-bottom: 0">候选水印（{{ candidates.length }} 个）</div>
				<span class="hint">点击条目可勾选/取消</span>
			</div>
			<div v-for="c in candidates" :key="c.id" class="cand" :class="{ on: c.checked }" @click="c.checked = !c.checked">
				<div class="cand-check">{{ c.checked ? '✓' : '' }}</div>
				<img v-if="c.preview" class="cand-img" :src="c.preview" />
				<div v-else class="cand-img cand-img-empty"><span>{{ c.type === 'annot' ? '注释' : '无预览' }}</span></div>
				<div class="cand-info">
					<span class="cand-reason">{{ c.reason }}</span>
					<span class="cand-pages">第 {{ c.pages.join('、') }} 页<span v-if="c.width"> · {{ c.width }}×{{ c.height }}</span></span>
				</div>
			</div>
			<button class="btn-primary" style="margin-top: calc(24 * var(--rpx))" :disabled="busy || !checkedIds.length" @click="remove">
				删除所选并生成（{{ checkedIds.length }} 个）
			</button>
		</div>

		<div v-if="result" class="card">
			<div class="card-title">结果预览（首页）</div>
			<img v-if="preview" class="preview-img" :src="preview" />
			<div class="result-item">
				<span class="file-name">{{ result.name }}（{{ result.sizeText }}）</span>
				<button class="mini-btn" @click="download">下载</button>
			</div>
		</div>
	</div>
</template>

<script>
import { pickFiles, readFileBytes, downloadBytes, formatSize, baseName } from '../../utils/file'
import { alertModal } from '../../utils/ui'
import { getPdfThumbnails } from '../../utils/pdfjs'
import { detectWatermarks, removeWatermarks } from '../../utils/watermark-remove'

export default {
	data() {
		return {
			file: null,
			candidates: [],
			detected: false,
			busy: false,
			progress: 0,
			result: null,
			preview: '',
		}
	},
	computed: {
		checkedIds() {
			return this.candidates.filter((c) => c.checked).map((c) => c.id)
		},
	},
	methods: {
		async choose() {
			const files = await pickFiles('.pdf,application/pdf', false)
			if (!files.length) return
			const f = files[0]
			try {
				const bytes = await readFileBytes(f)
				this.file = { name: f.name, bytes, sizeText: formatSize(f.size) }
				this.candidates = []
				this.detected = false
				this.result = null
				this.preview = ''
				await this.detect()
			} catch (e) {
				alertModal('无法读取', String((e && e.message) || e))
			}
		},
		async detect() {
			this.busy = true
			this.progress = 0
			this.result = null
			this.preview = ''
			try {
				const { candidates, pageCount } = await detectWatermarks(this.file.bytes)
				this.file.pageCount = pageCount
				this.candidates = candidates
				this.detected = true
			} catch (e) {
				alertModal('识别失败', String((e && e.message) || e))
			} finally {
				this.busy = false
			}
		},
		async remove() {
			this.busy = true
			this.progress = 0
			try {
				const bytes = await removeWatermarks(this.file.bytes, this.checkedIds, (p) => (this.progress = p))
				const name = `${baseName(this.file.name)}_已去水印.pdf`
				this.result = { bytes, name, sizeText: formatSize(bytes.length) }
				this.preview = (await getPdfThumbnails(bytes, 1, 600))[0] || ''
			} catch (e) {
				alertModal('删除失败', String((e && e.message) || e))
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
.cand {
	display: flex;
	align-items: center;
	padding: calc(20 * var(--rpx)) 0;
	border-bottom: calc(1 * var(--rpx)) solid #f0f1f3;
}

.cand:last-of-type {
	border-bottom: none;
}

.cand-check {
	width: calc(48 * var(--rpx));
	height: calc(48 * var(--rpx));
	border-radius: calc(10 * var(--rpx));
	border: calc(2 * var(--rpx)) solid #d1d5db;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #ffffff;
	font-size: calc(30 * var(--rpx));
	flex-shrink: 0;
	margin-right: calc(20 * var(--rpx));
}

.cand.on .cand-check {
	background: #2f6bff;
	border-color: #2f6bff;
}

.cand-img {
	width: calc(88 * var(--rpx));
	height: calc(88 * var(--rpx));
	border-radius: calc(8 * var(--rpx));
	background: #f3f4f6;
	flex-shrink: 0;
	object-fit: contain;
}

.cand-img-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: calc(20 * var(--rpx));
	color: #9ca3af;
}

.cand-info {
	flex: 1;
	margin-left: calc(20 * var(--rpx));
	display: flex;
	flex-direction: column;
}

.cand-reason {
	font-size: calc(26 * var(--rpx));
	color: #374151;
}

.cand-pages {
	font-size: calc(22 * var(--rpx));
	color: #9ca3af;
	margin-top: calc(6 * var(--rpx));
}
</style>
