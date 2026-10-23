<script>
import { initPwaInstall } from '@/utils/pwa-install.js'

export default {
	created() {
		initPwaInstall()
	},
	computed: {
		title() {
			return this.$route.meta.title || ''
		},
	},
	methods: {
		goBack() {
			if (window.history.state && window.history.state.back) this.$router.back()
			else this.$router.push('/')
		},
	},
}
</script>

<template>
	<div class="app-shell">
		<div v-if="title" class="app-header">
			<div class="header-back" @click="goBack">‹ 返回</div>
			<div class="header-title">{{ title }}</div>
			<div class="header-space"></div>
		</div>
		<router-view />
	</div>
</template>

<style>
/* 750rpx 设计基准：手机上按视口缩放，宽屏按 0.5px/rpx 封顶 */
:root {
  --rpx: min(0.5px, calc(100vw / 750));
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background-color: #f5f7fa;
  font-size: calc(28 * var(--rpx));
  color: #1f2937;
  -webkit-tap-highlight-color: transparent;
}

/* 原生元素基础重置，保持与原 uni 组件一致的观感 */
button {
  border: none;
  background: transparent;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

button[disabled] {
  cursor: default;
}

img {
  display: block;
}

input {
  font: inherit;
}

.range {
  width: 100%;
  accent-color: #2f6bff;
  margin-top: calc(8 * var(--rpx));
}

/* 页面标题栏（替代 uni 导航栏），首页不显示 */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(88 * var(--rpx));
  padding: env(safe-area-inset-top) calc(24 * var(--rpx)) 0;
  background: #ffffff;
  box-sizing: content-box;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: calc(1 * var(--rpx)) solid #f0f1f3;
}

.header-back {
  font-size: calc(28 * var(--rpx));
  color: #2f6bff;
  padding: calc(12 * var(--rpx)) calc(16 * var(--rpx));
}

.header-title {
  font-size: calc(32 * var(--rpx));
  font-weight: 600;
  color: #111827;
}

.header-space {
  min-width: calc(96 * var(--rpx));
}

/* 工具页通用布局 */
.tool-page {
  padding: calc(24 * var(--rpx));
  box-sizing: border-box;
  min-height: calc(100vh - calc(88 * var(--rpx)));
}

.card {
  background: #ffffff;
  border-radius: calc(20 * var(--rpx));
  padding: calc(28 * var(--rpx));
  margin-bottom: calc(24 * var(--rpx));
  box-shadow: 0 calc(2 * var(--rpx)) calc(10 * var(--rpx)) rgba(31, 41, 55, 0.05);
}

.card-title {
  font-size: calc(30 * var(--rpx));
  font-weight: 600;
  margin-bottom: calc(16 * var(--rpx));
  color: #111827;
}

.hint {
  color: #6b7280;
  font-size: calc(24 * var(--rpx));
  line-height: 1.6;
}

.btn-primary {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: #2f6bff;
  color: #ffffff;
  border-radius: calc(14 * var(--rpx));
  font-size: calc(30 * var(--rpx));
  padding: calc(22 * var(--rpx)) 0;
  text-align: center;
  line-height: 1.4;
}

.btn-primary[disabled] {
  background: #b9cbff;
  color: #ffffff;
}

.btn-ghost {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: #eef2ff;
  color: #2f6bff;
  border-radius: calc(14 * var(--rpx));
  font-size: calc(28 * var(--rpx));
  padding: calc(18 * var(--rpx)) 0;
  text-align: center;
  line-height: 1.4;
}

.btn-ghost[disabled] {
  color: #9ca3af;
  background: #f3f4f6;
}

.file-item {
  display: flex;
  align-items: center;
  padding: calc(16 * var(--rpx)) 0;
  border-bottom: calc(1 * var(--rpx)) solid #f0f1f3;
}

.file-item:last-child {
  border-bottom: none;
}

.file-thumb {
  width: calc(88 * var(--rpx));
  height: calc(110 * var(--rpx));
  border-radius: calc(8 * var(--rpx));
  background: #f3f4f6;
  flex-shrink: 0;
  object-fit: cover;
}

.file-name {
  flex: 1;
  margin-left: calc(20 * var(--rpx));
  font-size: calc(26 * var(--rpx));
  color: #374151;
  word-break: break-all;
}

.file-size {
  color: #9ca3af;
  font-size: calc(22 * var(--rpx));
}

.file-actions {
  display: flex;
  flex-direction: column;
  margin-left: calc(16 * var(--rpx));
}

.mini-btn {
  font-size: calc(22 * var(--rpx));
  color: #6b7280;
  background: #f3f4f6;
  border-radius: calc(8 * var(--rpx));
  padding: calc(6 * var(--rpx)) calc(16 * var(--rpx));
  margin: calc(4 * var(--rpx)) 0;
  line-height: 1.4;
}

.mini-btn[disabled] {
  color: #d1d5db;
}

.mini-btn.danger {
  color: #ef4444;
  background: #fef2f2;
}

.row {
  display: flex;
  align-items: center;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label {
  font-size: calc(26 * var(--rpx));
  color: #374151;
  margin: calc(16 * var(--rpx)) 0 calc(8 * var(--rpx));
}

.input {
  border: calc(1 * var(--rpx)) solid #e5e7eb;
  border-radius: calc(12 * var(--rpx));
  padding: calc(16 * var(--rpx)) calc(20 * var(--rpx));
  font-size: calc(28 * var(--rpx));
  width: 100%;
  box-sizing: border-box;
  background: #fafbfc;
}

.progress-wrap {
  margin-top: calc(20 * var(--rpx));
}

.progress-bar {
  height: calc(12 * var(--rpx));
  background: #e5e7eb;
  border-radius: calc(6 * var(--rpx));
  overflow: hidden;
}

.progress-inner {
  height: 100%;
  background: #2f6bff;
  border-radius: calc(6 * var(--rpx));
  transition: width 0.2s;
}

.progress-text {
  font-size: calc(24 * var(--rpx));
  color: #6b7280;
  margin-top: calc(8 * var(--rpx));
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(18 * var(--rpx)) 0;
  border-bottom: calc(1 * var(--rpx)) solid #f0f1f3;
}

.result-item:last-child {
  border-bottom: none;
}

/* 分段选择器 */
.seg {
  display: flex;
  background: #f3f4f6;
  border-radius: calc(12 * var(--rpx));
  padding: calc(6 * var(--rpx));
  margin-top: calc(8 * var(--rpx));
}

.seg-item {
  flex: 1;
  text-align: center;
  font-size: calc(26 * var(--rpx));
  color: #6b7280;
  padding: calc(14 * var(--rpx)) 0;
  border-radius: calc(10 * var(--rpx));
}

.seg-item.active {
  background: #ffffff;
  color: #2f6bff;
  font-weight: 600;
  box-shadow: 0 calc(2 * var(--rpx)) calc(8 * var(--rpx)) rgba(31, 41, 55, 0.08);
}

/* 结果预览大图 */
.preview-img {
  width: 100%;
  height: auto;
  border-radius: calc(12 * var(--rpx));
  background: #f3f4f6;
  margin-top: calc(20 * var(--rpx));
}

/* toast / 弹窗（utils/ui.js 动态挂载） */
.ui-toast {
  position: fixed;
  left: 50%;
  bottom: 15%;
  transform: translateX(-50%) translateY(calc(20 * var(--rpx)));
  background: rgba(17, 24, 39, 0.85);
  color: #ffffff;
  font-size: calc(26 * var(--rpx));
  padding: calc(18 * var(--rpx)) calc(32 * var(--rpx));
  border-radius: calc(14 * var(--rpx));
  z-index: 1000;
  opacity: 0;
  transition: all 0.3s;
  max-width: 80%;
  text-align: center;
}

.ui-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.ui-mask {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  padding: calc(48 * var(--rpx));
}

.ui-dialog {
  width: 100%;
  max-width: calc(600 * var(--rpx));
  background: #ffffff;
  border-radius: calc(24 * var(--rpx));
  padding: calc(40 * var(--rpx)) calc(36 * var(--rpx));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.ui-dialog-title {
  font-size: calc(32 * var(--rpx));
  font-weight: 700;
  color: #111827;
  margin-bottom: calc(20 * var(--rpx));
}

.ui-dialog-content {
  font-size: calc(27 * var(--rpx));
  color: #374151;
  line-height: 1.7;
  word-break: break-all;
}

.ui-dialog-btn {
  margin-top: calc(28 * var(--rpx));
  background: #2f6bff;
  border-radius: calc(14 * var(--rpx));
  padding: calc(20 * var(--rpx)) 0;
  text-align: center;
  color: #ffffff;
  font-size: calc(28 * var(--rpx));
}

/* 桌面端 PWA 以 window-controls-overlay 运行时，标题栏区域交给页面：
   顶部标题栏可拖拽窗口，交互元素保持可点击 */
.app-header {
  -webkit-app-region: drag;
}

.header-back,
.app-header button,
.app-header input {
  -webkit-app-region: no-drag;
}
</style>
