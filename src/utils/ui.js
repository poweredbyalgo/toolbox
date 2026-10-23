// 轻量 UI 反馈：toast 与提示弹窗（纯 DOM 实现，替代原 uni.showToast / uni.showModal）

export function toast(title) {
	const el = document.createElement('div')
	el.className = 'ui-toast'
	el.textContent = title
	document.body.appendChild(el)
	requestAnimationFrame(() => el.classList.add('show'))
	setTimeout(() => {
		el.classList.remove('show')
		setTimeout(() => el.remove(), 300)
	}, 2000)
}

// 单按钮提示弹窗，等价于 uni.showModal({ showCancel: false })
export function alertModal(title, content) {
	return new Promise((resolve) => {
		const mask = document.createElement('div')
		mask.className = 'ui-mask'
		const card = document.createElement('div')
		card.className = 'ui-dialog'
		card.innerHTML =
			'<div class="ui-dialog-title"></div><div class="ui-dialog-content"></div>' +
			'<div class="ui-dialog-btn">知道了</div>'
		card.querySelector('.ui-dialog-title').textContent = title
		card.querySelector('.ui-dialog-content').textContent = content
		mask.appendChild(card)
		const close = () => {
			mask.remove()
			resolve(true)
		}
		mask.addEventListener('click', (e) => {
			if (e.target === mask || e.target.classList.contains('ui-dialog-btn')) close()
		})
		document.body.appendChild(mask)
	})
}
