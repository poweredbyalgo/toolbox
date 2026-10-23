// 图片尺寸修改：本地 canvas 缩放，文件不上传
import { canvasToBlob } from './file'

// 解码为可绘制对象，优先 createImageBitmap（解码更快、内存友好），旧浏览器回退 Image
export async function loadDrawable(blob) {
	if (typeof createImageBitmap === 'function') {
		try {
			return await createImageBitmap(blob)
		} catch (e) {
			// 部分格式（如 HEIC 伪装扩展名）失败时回退
		}
	}
	const url = URL.createObjectURL(blob)
	try {
		return await new Promise((resolve, reject) => {
			const img = new Image()
			img.onload = () => resolve(img)
			img.onerror = () => reject(new Error('无法解码该图片'))
			img.src = url
		})
	} finally {
		setTimeout(() => URL.revokeObjectURL(url), 1000)
	}
}

export function drawableSize(drawable) {
	return {
		width: drawable.naturalWidth || drawable.width,
		height: drawable.naturalHeight || drawable.height,
	}
}

// 按指定宽高高质量缩放并导出 Blob
export async function resizeImage(blob, width, height, { mime = 'image/png', quality = 0.92, background = null } = {}) {
	const drawable = await loadDrawable(blob)
	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	const ctx = canvas.getContext('2d')
	ctx.imageSmoothingEnabled = true
	ctx.imageSmoothingQuality = 'high'
	if (background) {
		ctx.fillStyle = background
		ctx.fillRect(0, 0, width, height)
	}
	ctx.drawImage(drawable, 0, 0, width, height)
	if (typeof drawable.close === 'function') drawable.close()
	return canvasToBlob(canvas, mime, quality)
}
