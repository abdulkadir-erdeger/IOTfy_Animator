export type PointEvent = { clientX: number; clientY: number }

export function clientToSvgPoint(
  svg: SVGSVGElement | null,
  event: PointEvent,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!svg) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
  return {
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height,
  }
}

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}
