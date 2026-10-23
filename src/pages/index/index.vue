<template>
	<div class="home">
		<div class="hero">
			<span class="hero-title">PDF 工具箱</span>
			<span class="hero-sub">图片转PDF · 合并 · 拆分 · 水印 · 转图片 · 背景提取，全部在浏览器本地处理，文件不上传</span>
		</div>
		<div class="grid">
			<div
				v-for="t in tools"
				:key="t.url"
				class="tool-card"
				@click="go(t.url)"
			>
				<div class="tool-icon" :style="{ backgroundColor: t.color }">
					<span class="tool-icon-text">{{ t.badge }}</span>
				</div>
				<span class="tool-name">{{ t.name }}</span>
				<span class="tool-desc">{{ t.desc }}</span>
			</div>
		</div>
		<div v-if="!installed" class="install-bar">
			<div class="install-btn" @click="onInstall">
				<span class="install-btn-text">＋ 添加到主屏幕，离线可用</span>
			</div>
		</div>
		<div v-else class="hint footer">已安装为应用，可离线使用。</div>

		<!-- 安装指引弹窗 -->
		<div v-if="showGuide" class="mask" @click="showGuide = false">
			<div class="guide-card" @click.stop>
				<span class="guide-title">{{ guideTitle }}</span>
				<div class="guide-steps">
					<span v-for="(s, i) in guideSteps" :key="i" class="guide-step">{{ i + 1 }}. {{ s }}</span>
				</div>
				<div class="guide-btn" @click="showGuide = false">
					<span class="guide-btn-text">知道了</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { isStandalone, isIOS, isWeChat, canPromptInstall, promptInstall, installConfirmed } from '@/utils/pwa-install.js'
import { toast } from '@/utils/ui'

export default {
	data() {
		return {
			installed: false,
			showGuide: false,
			guidePlatform: '',
			tools: [
				{ name: '图片转 PDF', desc: '多张图片合成一个 PDF', badge: '图', color: '#2f6bff', url: '/pages/img2pdf/index' },
				{ name: 'PDF 合并', desc: '多个 PDF 按顺序拼接', badge: '合', color: '#0ea5e9', url: '/pages/merge/index' },
				{ name: 'PDF 拆分', desc: '按页码范围拆成多个文件', badge: '拆', color: '#8b5cf6', url: '/pages/split/index' },
				{ name: 'PDF 加水印', desc: '文字/图片水印，平铺或居中', badge: '加', color: '#f59e0b', url: '/pages/add-mark/index' },
				{ name: 'PDF 去水印', desc: '删除 PDF 中的水印图片对象', badge: '去', color: '#10b981', url: '/pages/remove-mark/index' },
				{ name: 'PDF 转图片', desc: '逐页导出 JPG / PNG', badge: '转', color: '#ef4444', url: '/pages/pdf2img/index' },
				{ name: '图片背景提取', desc: '背景一键转纯白 / 透明', badge: '底', color: '#14b8a6', url: '/pages/img-bg/index' },
			],
		}
	},
	computed: {
		guideTitle() {
			if (this.guidePlatform === 'wechat') return '请在系统浏览器中打开'
			if (this.guidePlatform === 'ios') return 'iPhone / iPad 安装方法'
			if (this.guidePlatform === 'fallback') return '安装没反应？按这几步排查'
			return '安装到主屏幕'
		},
		guideSteps() {
			if (this.guidePlatform === 'wechat') {
				return [
					'点右上角 ··· 菜单',
					'选择「在浏览器打开」（安卓选 Chrome/Edge，苹果选 Safari）',
					'再回到本页点「添加到主屏幕」',
				]
			}
			if (this.guidePlatform === 'ios') {
				return [
					'iOS 只有 Safari 支持安装，微信/Edge/Chrome 内都不行',
					'用 Safari 打开本页面',
					'点底部 分享 按钮',
					'选择「添加到主屏幕」即可',
				]
			}
			if (this.guidePlatform === 'fallback') {
				return [
					'上滑打开应用列表，搜索「PDF工具箱」——有就说明已装好，长按图标拖到桌面即可',
					'Edge 菜单 ··· → 「应用」，看列表里有没有；有就直接从那里打开',
					'小米/华为/OPPO 等手机：系统设置 → 应用 → Edge → 权限 → 允许「创建桌面快捷方式」，然后重新安装',
					'仍不行就换 Chrome 打开本页面再点安装（安卓版 Edge 的 PWA 安装存在已知 bug）',
				]
			}
			return [
				'Edge：点右下角 ··· 菜单 → 「应用」→「将此网站安装为应用」',
				'Chrome：点右上角 ⋮ 菜单 → 「添加到主屏幕」/「安装应用」',
			]
		},
	},
	mounted() {
		this.installed = isStandalone()
	},
	methods: {
		go(url) {
			this.$router.push(url)
		},
		async onInstall() {
			if (isWeChat()) {
				this.guidePlatform = 'wechat'
				this.showGuide = true
				return
			}
			if (canPromptInstall()) {
				const outcome = await promptInstall()
				if (outcome === 'accepted') {
					// 等待 appinstalled 事件确认安装真正完成
					setTimeout(() => {
						if (installConfirmed()) {
							toast('已添加到主屏幕')
							this.installed = true
						} else {
							this.guidePlatform = 'fallback'
							this.showGuide = true
						}
					}, 4000)
					return
				}
				if (outcome === 'error') {
					this.guidePlatform = 'fallback'
					this.showGuide = true
				}
				return
			}
				this.guidePlatform = isIOS() ? 'ios' : 'android'
				this.showGuide = true
			},
		},
	}
</script>

<style>
.home {
	/* 自定义导航栏后，用安全区内边距避开手机状态栏/桌面窗口控制区 */
	padding: calc(calc(32 * var(--rpx)) + env(safe-area-inset-top)) calc(24 * var(--rpx)) calc(32 * var(--rpx));
}

.hero {
	padding: calc(24 * var(--rpx)) calc(8 * var(--rpx)) calc(40 * var(--rpx));
	display: flex;
	flex-direction: column;
}

.hero-title {
	font-size: calc(48 * var(--rpx));
	font-weight: 700;
	color: #111827;
}

.hero-sub {
	margin-top: calc(12 * var(--rpx));
	font-size: calc(24 * var(--rpx));
	color: #6b7280;
	line-height: 1.6;
}

.grid {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
}

.tool-card {
	width: 48.5%;
	box-sizing: border-box;
	background: #ffffff;
	border-radius: calc(20 * var(--rpx));
	padding: calc(28 * var(--rpx));
	margin-bottom: calc(24 * var(--rpx));
	box-shadow: 0 calc(2 * var(--rpx)) calc(10 * var(--rpx)) rgba(31, 41, 55, 0.05);
	display: flex;
	flex-direction: column;
}

.tool-card:active {
	transform: scale(0.98);
	box-shadow: 0 calc(4 * var(--rpx)) calc(16 * var(--rpx)) rgba(31, 41, 55, 0.12);
}

.tool-icon {
	width: calc(80 * var(--rpx));
	height: calc(80 * var(--rpx));
	border-radius: calc(20 * var(--rpx));
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: calc(20 * var(--rpx));
}

.tool-icon-text {
	color: #ffffff;
	font-size: calc(40 * var(--rpx));
	font-weight: 700;
}

.tool-name {
	font-size: calc(30 * var(--rpx));
	font-weight: 600;
	color: #111827;
}

.tool-desc {
	margin-top: calc(8 * var(--rpx));
	font-size: calc(22 * var(--rpx));
	color: #9ca3af;
	line-height: 1.5;
}

.footer {
	text-align: center;
	margin-top: calc(8 * var(--rpx));
}

.install-bar {
	margin-top: calc(16 * var(--rpx));
}

.install-btn {
	background: linear-gradient(135deg, #2f6bff, #0ea5e9);
	border-radius: calc(16 * var(--rpx));
	padding: calc(26 * var(--rpx)) 0;
	text-align: center;
	box-shadow: 0 calc(6 * var(--rpx)) calc(18 * var(--rpx)) rgba(47, 107, 255, 0.3);
}

.install-btn:active,
.guide-btn:active {
	opacity: 0.85;
	transform: scale(0.98);
}

.install-btn-text {
	color: #ffffff;
	font-size: calc(30 * var(--rpx));
	font-weight: 600;
}

.mask {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	background: rgba(17, 24, 39, 0.55);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 999;
	padding: calc(48 * var(--rpx));
}

.guide-card {
	width: 100%;
	background: #ffffff;
	border-radius: calc(24 * var(--rpx));
	padding: calc(40 * var(--rpx)) calc(36 * var(--rpx));
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}

.guide-title {
	font-size: calc(34 * var(--rpx));
	font-weight: 700;
	color: #111827;
	margin-bottom: calc(24 * var(--rpx));
}

.guide-steps {
	display: flex;
	flex-direction: column;
}

.guide-step {
	font-size: calc(27 * var(--rpx));
	color: #374151;
	line-height: 1.7;
	margin-bottom: calc(12 * var(--rpx));
}

.guide-btn {
	margin-top: calc(28 * var(--rpx));
	background: #2f6bff;
	border-radius: calc(14 * var(--rpx));
	padding: calc(20 * var(--rpx)) 0;
	text-align: center;
}

.guide-btn-text {
	color: #ffffff;
	font-size: calc(28 * var(--rpx));
}
</style>
