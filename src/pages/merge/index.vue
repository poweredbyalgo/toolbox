<template>
	<div class="tool-page">
		<div class="card">
			<div class="card-title">选择 PDF</div>
			<button class="btn-ghost" @click="choose">添加 PDF 文件</button>
			<div v-for="(it, i) in items" :key="it.id" class="file-item">
				<img v-if="it.thumb" class="file-thumb" :src="it.thumb" />
				<div v-else class="file-thumb"></div>
				<div class="file-name">
					<span>{{ it.name }}</span>
					<span class="file-size">{{ it.pageCount }} 页 · {{ it.sizeText }}</span>
				</div>
				<div class="file-actions">
					<button class="mini-btn" :disabled="i === 0" @click="moveUp(i)">上移</button>
					<button class="mini-btn" :disabled="i === items.length - 1" @click="moveDown(i)">下移</button>
					<button class="mini-btn danger" @click="removeAt(i)">删除</button>
				</div>
			</div>
			<div v-if="!items.length" class="hint">至少两个 PDF，按列表顺序合并。</div>
		</div>

		<div class="card">
			<button class="btn-primary" :disabled="items.length < 2 || busy" @click="generate">
				{{ busy ? '处理中…' : '合并并下载' }}
			</button>
			<div v-if="busy" class="progress-wrap">
				<div class="progress-bar"><div class="progress-inner" :style="{ width: progress * 100 + '%' }"></div></div>
				<div class="progress-text">{{ Math.round(progress * 100) }}%</div>
			</div>
		</div>
	</div>
</template>

<script>
import { pickFiles, readFileBytes, downloadBytes, formatSize, baseName } from '../../utils/file'
import { alertModal } from '../../utils/ui'
import { getPdfThumbnails, getPdfPageCount } from '../../utils/pdfjs'
import { mergePdfs } from '../../utils/pdf-ops'

let uid = 1

export default {
	data() {
		return {
			items: [],
			busy: false,
			progress: 0,
		}
	},
	methods: {
		async choose() {
			const files = await pickFiles('.pdf,application/pdf', true)
			for (const f of files) {
				const bytes = await readFileBytes(f)
				let pageCount = 0
				let thumb = ''
				try {
					pageCount = await getPdfPageCount(bytes)
					thumb = (await getPdfThumbnails(bytes, 1))[0] || ''
				} catch (e) {
					alertModal('无法读取', `${f.name} 可能已损坏或加密`)
					continue
				}
				this.items.push({ id: uid++, name: f.name, bytes, pageCount, thumb, sizeText: formatSize(f.size) })
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
			this.items.splice(i, 1)
		},
		async generate() {
			this.busy = true
			this.progress = 0
			try {
				const bytes = await mergePdfs(
					this.items.map((it) => ({ bytes: it.bytes, name: it.name })),
					(p) => (this.progress = p)
				)
				const name = `${baseName(this.items[0].name)}_合并${this.items.length}份.pdf`
				downloadBytes(bytes, name, 'application/pdf')
			} catch (e) {
				alertModal('合并失败', String((e && e.message) || e))
			} finally {
				this.busy = false
			}
		},
	},
}
</script>
