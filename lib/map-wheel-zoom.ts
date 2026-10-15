import type { Map as LeafletMap, Point } from 'leaflet'

/** 接续滚轮输入；只在动画途中使用小数级别，结束仍落在整数瓦片级。 */
export function attachMapWheelZoom(map: LeafletMap) {
  const container = map.getContainer()
  let frame: number | undefined
  let delta = 0
  let lastInputAt = -Infinity
  let targetZoom: number | undefined
  let lastDirection = 0
  let anchor: Point

  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    delta = 0
    targetZoom = undefined
    lastDirection = 0
  }

  const apply = () => {
    frame = undefined
    const steps = Math.trunc(delta / 100)
    if (!steps) return
    delta %= 100
    const current = map.getZoom()
    const direction = -Math.sign(steps)
    // 换向从当前画面计算，不先走完旧方向的目标。
    if (targetZoom === undefined || direction !== lastDirection) {
      targetZoom = direction > 0 ? Math.floor(current) : Math.ceil(current)
    }
    lastDirection = direction
    // 限制领先距离，防止高速滚轮堆出松手后仍长时间追赶的缩放队列。
    targetZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(),
      Math.max(Math.floor(current) - 1, Math.min(Math.ceil(current) + 1, targetZoom - steps)),
    ))
    if (targetZoom === current) return

    const scale = map.getZoomScale(targetZoom)
    const half = map.getSize().divideBy(2)
    const center = map.containerPointToLatLng(
      half.add(anchor.subtract(half).multiplyBy(1 - 1 / scale)),
    )
    // flyTo 可从正在移动的小数级别接续；这里不能先 stop()，否则会吸附回整数级。
    map.flyTo(center, targetZoom, {
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      duration: 0.24,
    })
  }

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return
    event.preventDefault()
    const now = performance.now()
    if (now - lastInputAt > 180) {
      delta = 0
      targetZoom = undefined
      lastDirection = 0
    }
    lastInputAt = now
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1)
    if (delta && Math.sign(delta) !== Math.sign(pixels)) delta = 0
    delta += pixels
    anchor = map.mouseEventToContainerPoint(event)
    if (frame === undefined) frame = requestAnimationFrame(apply)
  }

  container.addEventListener('wheel', onWheel, { passive: false })
  container.addEventListener('pointerdown', cancel)
  map.on('zoomend', cancel)
  return {
    cancel,
    dispose: () => {
      cancel()
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('pointerdown', cancel)
      map.off('zoomend', cancel)
    },
  }
}
