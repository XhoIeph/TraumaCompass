'use client'

import { useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/** 只动画面板内容，不碰 Leaflet 管理的 transform 或地图容器尺寸。 */
export function PanelMotion({ children, motionKey }: { children: ReactNode; motionKey: string }) {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(root.current, { y: 8, opacity: 0.6, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity' })
    })
    return () => media.revert()
  }, { scope: root, dependencies: [motionKey], revertOnUpdate: true })
  return <div ref={root}>{children}</div>
}
