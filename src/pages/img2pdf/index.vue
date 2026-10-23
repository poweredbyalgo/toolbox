<template>
	<div class="tool-page">
		<div class="card">
			<div class="card-title">选择图片</div>
			<button class="btn-ghost" @click="choose">添加图片</button>
			<div v-if="items.length" class="hint" style="margin-top: calc(16 * var(--rpx))">共 {{ items.length }} 张，列表顺序即页序</div>
			<div v-for="(it, i) in items" :key="it.id" class="file-item">
				<img class="file-thumb" :src="it.url" />
				<div class="file-name">
					<span>{{ it.name }}</span>
					<span class="file-size">{{ it.sizeText }}</span>
				</div>
				<div class="file-actions">
					<button class="mini-btn" :disabled="i === 0" @click="moveUp(i)">上移</button>
					<button class="mini-btn" :disabled="i === items.length - 1" @click="moveDown(i)">下移</button>
					<button class="mini-btn danger" @click="removeAt(i)">删除</button>
				</div>
			</div>
			<div v-if="!items.length" class="hint">支持 JPG / PNG / WebP 等，可多选。</div>
		</div>

		<div class="card">
			<div class="card-title">参数</div>
			<div class="label">页面大小</div>
			<div class="seg">
				<div class="seg-item" :class="{ active: pageSize === 'a4' }" @click="pageSize = 'a4'">A4</div>
				<div class="seg-item" :class="{ active: pageSize === 'original' }" @click="pageSize = 'original'">按图片尺寸</div>
			</div>
			<template v-if="pageSize === 'a4'">
				<div class="label">方向</div>
				<div class="seg">
					<div
						v-for="o in orientations"
						:key="o.value"
						class="seg-item"
						:class="{ active: orientation === o.value }"
						@click="orientation = o.value"
					>{{ o.label }}</div>
				</div>
			</template>
			<div class="label">页边距：{{ margin }} pt</div>
			<input type="range" class="range" :value="margin" :min="0" :max="60" :step="5" @input="onMargin" />
		</div>

		<div class="card">
			<button class="btn-primary" :disabled="!items.length || busy" @click="generate">
				{{ busy ? '处理中…' : '生成 PDF' }}
			</button>
			<div v-if="busy" class="progress-wrap">
				<div class="progress-bar"><div class="progress-inner" :style="{ width: progress * 100 + '%' }"></div></div>
				<div class="progress-text">{{ Math.round(progress * 100) }}%</div>
			</div>
			<div v-if="result" class="result-item">
				<span class="file-name">{{ result.name }}（{{ result.sizeText }}）</span>
				<button class="mini-btn" @click="download">下载</button>
			</div>
		</div>
	</div>
</template>

<script>
import { pickFiles, downloadBytes, formatSize, baseName } from '../../utils/file'
import { alertModal } from '../../utils/ui'
import { imagesToPdf } from '../../utils/pdf-ops'

let uid = 1

export default {
	data() {
		return {
			items: [],
			pageSize: 'a4',
			orientation: 'auto',
			orientations: [
				{ value: 'auto', label: '自动' },
				{ value: 'portrait', label: '纵向' },
				{ value: 'landscape', label: '横向' },
			],
			margin: 20,
			busy: false,
			progress: 0,
			result: null,
		}
	},
	methods: {
		async choose() {
			const files = await pickFiles('image/*', true)
			for (const f of files) {
				this.items.push({
					id: uid++,
					file: f,
					name: f.name,
					sizeText: formatSize(f.size),
					url: URL.createObjectURL(f),
				})
			}
		},
		moveUp(i) {
			if (i === 0) return
			const arr = this.items.slice()
			const t = arr.splice(i, 1)[0]
			arr.splice(i - 1, 0, t)
			this.items = arr
		},
		moveDown(i) {
			const arr = this.items.slice()
			if (i === arr.length - 1) return
			const t = arr.splice(i, 1)[0]
			arr.splice(i + 1, 0, t)
			this.items = arr
		},
		removeAt(i) {
			const [it] = this.items.splice(i, 1)
			if (it) URL.revokeObjectURL(it.url)
		},
		onMargin(e) {
			this.margin = Number(e.target.value)
		},
		async generate() {
			this.busy = true
			this.progress = 0
			this.result = null
			try {
				const bytes = await imagesToPdf(
					this.items.map((it) => it.file),
					{ pageSize: this.pageSize, orientation: this.orientation, margin: this.margin },
					(p) => (this.progress = p)
				)
				const name = `${baseName(this.items[0].name)}_共${this.items.length}页.pdf`
				this.result = { bytes, name, sizeText: formatSize(bytes.length) }
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
