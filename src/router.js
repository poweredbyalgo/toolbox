import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
	{ path: '/', name: 'home', component: () => import('./pages/index/index.vue'), meta: { title: '' } },
	{ path: '/pages/index/index', redirect: '/' },
	{ path: '/pages/img2pdf/index', component: () => import('./pages/img2pdf/index.vue'), meta: { title: '图片转 PDF' } },
	{ path: '/pages/merge/index', component: () => import('./pages/merge/index.vue'), meta: { title: 'PDF 合并' } },
	{ path: '/pages/split/index', component: () => import('./pages/split/index.vue'), meta: { title: 'PDF 拆分' } },
	{ path: '/pages/add-mark/index', component: () => import('./pages/add-mark/index.vue'), meta: { title: 'PDF 加水印' } },
	{ path: '/pages/remove-mark/index', component: () => import('./pages/remove-mark/index.vue'), meta: { title: 'PDF 去水印' } },
	{ path: '/pages/pdf2img/index', component: () => import('./pages/pdf2img/index.vue'), meta: { title: 'PDF 转图片' } },
	{ path: '/pages/img-bg/index', component: () => import('./pages/img-bg/index.vue'), meta: { title: '图片背景提取' } },
	{ path: '/pages/img-resize/index', component: () => import('./pages/img-resize/index.vue'), meta: { title: '图片改尺寸' } },
	{ path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
	history: createWebHashHistory(),
	routes,
})

router.afterEach((to) => {
	document.title = to.meta.title ? `${to.meta.title} · 工具箱` : '工具箱'
})

export default router
