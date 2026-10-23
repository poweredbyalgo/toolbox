<template>
	<view class="tool-page">
		<view class="card">
			<view class="card-title">选择图片</view>
			<button class="btn-ghost" @tap="choose">{{ files.length ? `已选 ${files.length} 张，重新选择` : '选择图片（可多选）' }}</button>
			<view v-if="files.length" class="file-list">
				<view v-for="(f, i) in files" :key="i" class="file-item">
					<image class="file-thumb" :src="f.url" mode="aspectFill" />
					<view class="file-name">
						<text>{{ f.name }}</text>
						<text class="file-size">{{ f.sizeText }}</text>
					</view>
					<button class="mini-btn danger" @tap="removeFile(i)">删除</button>
				</view>
			</view>
		</view>

		<view class="card">
			<view class="card-title">提取设置</view>
			<view class="label">背景容差：{{ tolerance }}（背景越杂、越深，数值调越大）</view>
			<slider :value="tolerance" :min="5" :max="100" :step="5" activeColor="#2f6bff" @change="(e) => (tolerance = e.detail.value)" />
			<button class="btn-primary" style="margin-top: 24rpx" :disabled="!files.length || busy" @tap="generate">
				{{ busy ? `提取中 ${Math.round(progress * 100)}%` : '提取纯白 / 透明背景' }}
			</button>
			<view v-if="busy" class="progress-wrap">
				<view class="progress-bar"><view class="progress-inner" :style="{ width: progress * 100 + '%' }"></view></view>
			</view>
			<view class="hint" style="margin-top: 16rpx">每张图片输出两个文件：纯白底 JPG + 透明底 PNG，全部本地处理不上传。</view>
		</view>

		<view v-if="results.length" class="card">
			<view class="row-between">
				<view class="card-title" style="margin-bottom: 0">提取结果（{{ results.length }} 个文件）</view>
				<button class="mini-btn" @tap="downloadAll">全部下载</button>
			</view>
			<view v-for="(r, i) in results" :key="r.name" class="result-item">
				<image class="out-thumb" :class="{ checker: r.kind === '透明' }" :src="r.url" mode="aspectFill" />
				<text class="file-name">{{ r.name }}（{{ r.sizeText }}）</text>
				<button class="mini-btn" @tap="downloadOne(i)">下载</button>
			</view>
		</view>
	</view>
</template>

<script>
import { pickFiles, downloadBlob, formatSize, baseName } from '../../utils/file'
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
					uni.showModal({ title: `「${f.name}」处理失败`, content: String((e && e.message) || e), showCancel: false })
				}
				this.progress = (i + 1) / total
			}
			this.busy = false
			if (this.results.length) uni.showToast({ title: `已生成 ${this.results.length} 个文件`, icon: 'success' })
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
	onUnload() {
		this.clearFiles()
		this.clearResults()
	},
}
</script>

<style>
.file-list {
	margin-top: 16rpx;
}

.out-thumb {
	width: 72rpx;
	height: 72rpx;
	border-radius: 8rpx;
	background: #f3f4f6;
	flex-shrink: 0;
	margin-right: 16rpx;
	object-fit: contain;
}

/* 透明 PNG 用棋盘格衬托，方便确认抠图效果 */
.out-thumb.checker {
	background: conic-gradient(#e5e7eb 90deg, #ffffff 90deg 180deg, #e5e7eb 180deg 270deg, #ffffff 270deg);
	background-size: 16rpx 16rpx;
}
</style>
