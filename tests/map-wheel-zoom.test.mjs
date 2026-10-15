import test from 'node:test'
import assert from 'node:assert/strict'
import { attachMapWheelZoom } from '../lib/map-wheel-zoom.ts'

class Point {
  constructor(x, y) { this.x = x; this.y = y }
  add(p) { return new Point(this.x + p.x, this.y + p.y) }
  subtract(p) { return new Point(this.x - p.x, this.y - p.y) }
  multiplyBy(n) { return new Point(this.x * n, this.y * n) }
  divideBy(n) { return this.multiplyBy(1 / n) }
}

function fixture(reducedMotion = false) {
  let now = 0
  let id = 0
  let prevented = 0
  const frames = new Map()
  const listeners = new Map()
  const events = new Map()
  const calls = []
  globalThis.window = { matchMedia: () => ({ matches: reducedMotion }) }
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } })
  globalThis.requestAnimationFrame = (callback) => { frames.set(++id, callback); return id }
  globalThis.cancelAnimationFrame = (frame) => frames.delete(frame)
  const map = {
    zoom: 6,
    getContainer: () => ({
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
    }),
    getZoom() { return this.zoom },
    getMinZoom: () => 4,
    getMaxZoom: () => 12,
    getZoomScale(target) { return 2 ** (target - this.zoom) },
    getSize: () => new Point(1000, 600),
    mouseEventToContainerPoint: () => new Point(800, 200),
    containerPointToLatLng: (point) => point,
    flyTo(center, target, options) { calls.push({ center, target, options, from: this.zoom }) },
    on: (name, callback) => events.set(name, callback),
    off: (name) => events.delete(name),
  }
  const controller = attachMapWheelZoom(map)
  return {
    map, calls, frames, listeners, events, controller,
    setTime(value) { now = value },
    wheel(deltaY, extra = {}) {
      listeners.get('wheel')({ deltaY, deltaX: 0, deltaMode: 0, ctrlKey: false,
        preventDefault: () => prevented++, ...extra })
    },
    flush() {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback())
    },
    get prevented() { return prevented },
  }
}

test('接续动画中的输入，不再丢弃 320ms 内的滚轮事件', () => {
  const f = fixture()
  f.wheel(-100); f.flush()
  assert.equal(f.calls[0].target, 7)
  f.map.zoom = 6.25
  f.setTime(16)
  f.wheel(-100); f.flush()
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[1].from, 6.25)
  assert.equal(f.calls[1].target, 8)
  assert.ok(f.calls.every(({ target }) => Number.isInteger(target)))
})

test('帧内合并输入、保留小增量，并限制高速滚动的目标距离', () => {
  const f = fixture()
  f.wheel(-40); f.wheel(-30)
  assert.equal(f.frames.size, 1)
  f.flush(); assert.equal(f.calls.length, 0)
  f.wheel(-30); f.flush(); assert.equal(f.calls[0].target, 7)
  f.map.zoom = 6.2
  f.wheel(-2400); f.flush()
  assert.equal(f.calls.at(-1).target, 8)
})

test('换向立即使用当前画面，不先完成旧目标', () => {
  const f = fixture()
  f.wheel(-200); f.flush()
  f.map.zoom = 6.4
  f.setTime(32)
  f.wheel(100); f.flush()
  assert.equal(f.calls.at(-1).target, 6)
})

test('保留鼠标锚点、上下限、Ctrl 和横向手势', () => {
  const f = fixture()
  f.wheel(-100); f.flush()
  assert.deepEqual(f.calls[0].center, new Point(650, 250))
  f.controller.cancel(); f.map.zoom = 4
  f.wheel(100); f.flush(); assert.equal(f.calls.length, 1)
  f.controller.cancel(); f.map.zoom = 12
  f.wheel(-100); f.flush(); assert.equal(f.calls.length, 1)
  const prevented = f.prevented
  f.wheel(100, { ctrlKey: true }); f.wheel(1, { deltaX: 100 }); f.flush()
  assert.equal(f.prevented, prevented)
  assert.equal(f.calls.length, 1)
})

test('减少动态效果与取消、清理', () => {
  const f = fixture(true)
  f.wheel(-100); f.flush()
  assert.equal(f.calls[0].options.animate, false)
  f.wheel(-100); f.controller.cancel(); f.flush()
  assert.equal(f.calls.length, 1)
  f.wheel(-100); f.events.get('zoomend')(); f.flush()
  assert.equal(f.calls.length, 1)
  f.controller.dispose()
  assert.equal(f.listeners.size, 0)
  assert.equal(f.events.size, 0)
})
