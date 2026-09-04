import type { Background, FigurePose, Project } from '../types'
import { hexPointList, parallelOffset, segmentRadius } from './segment'
import { computeWorldJoints } from './skeleton'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image'))
    image.src = src
  })
}

function fillGradient(ctx: CanvasRenderingContext2D, background: Background, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  if (background.id === 'sky') {
    gradient.addColorStop(0, '#7dd3fc')
    gradient.addColorStop(0.55, '#e0f2fe')
    gradient.addColorStop(1, '#bbf7d0')
  } else if (background.id === 'sunset') {
    gradient.addColorStop(0, '#fb7185')
    gradient.addColorStop(0.42, '#fdba74')
    gradient.addColorStop(1, '#fde68a')
  } else if (background.id === 'space') {
    gradient.addColorStop(0, '#1e1b4b')
    gradient.addColorStop(0.5, '#312e81')
    gradient.addColorStop(1, '#4c1d95')
  } else if (background.id === 'class') {
    gradient.addColorStop(0, '#e0f2fe')
    gradient.addColorStop(0.7, '#fef3c7')
    gradient.addColorStop(1, '#d6d3d1')
  } else {
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(1, '#f8fafc')
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

async function paintBackground(
  ctx: CanvasRenderingContext2D,
  background: Background,
  width: number,
  height: number,
) {
  if (background.type === 'color') {
    ctx.fillStyle = background.value
    ctx.fillRect(0, 0, width, height)
    return
  }
  if (background.type === 'image') {
    try {
      const image = await loadImage(background.value)
      ctx.drawImage(image, 0, 0, width, height)
    } catch {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    return
  }
  fillGradient(ctx, background, width, height)
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, width)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawFigure(ctx: CanvasRenderingContext2D, figure: FigurePose) {
  const world = computeWorldJoints(figure)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const joint of world) {
    if (!joint.parentId || !joint.visible) continue
    const color = figure.color
    const radius = segmentRadius(joint)
    if (joint.kind === 'double') {
      const offset = Math.max(3, joint.thickness * 0.55)
      const twin = parallelOffset(joint.parentX, joint.parentY, joint.x, joint.y, offset)
      strokeSegment(ctx, twin.ax1, twin.ay1, twin.ax2, twin.ay2, joint.thickness, color)
      strokeSegment(ctx, twin.bx1, twin.by1, twin.bx2, twin.by2, joint.thickness, color)
    } else if (joint.kind === 'ring') {
      strokeSegment(ctx, joint.parentX, joint.parentY, joint.x, joint.y, Math.max(3, joint.thickness * 0.55), color)
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(3, joint.thickness)
      ctx.beginPath()
      ctx.arc(joint.x, joint.y, radius, 0, Math.PI * 2)
      ctx.stroke()
    } else if (joint.kind === 'hex') {
      strokeSegment(ctx, joint.parentX, joint.parentY, joint.x, joint.y, Math.max(3, joint.thickness * 0.45), color)
      const points = hexPointList(joint.x, joint.y, radius)
      ctx.fillStyle = color
      ctx.beginPath()
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.closePath()
      ctx.fill()
    } else if (joint.kind === 'circle') {
      strokeSegment(ctx, joint.parentX, joint.parentY, joint.x, joint.y, joint.thickness, color)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(joint.x, joint.y, radius, 0, Math.PI * 2)
      ctx.fill()
    } else {
      strokeSegment(ctx, joint.parentX, joint.parentY, joint.x, joint.y, joint.thickness, color)
    }
  }
}

export async function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  frameIndex: number,
) {
  const { canvasWidth: width, canvasHeight: height, background } = project
  await paintBackground(ctx, background, width, height)
  const frame = project.frames[frameIndex]
  if (!frame) return
  const figures = [...frame.figures].sort((a, b) => a.zOrder - b.zOrder)
  figures.forEach((figure) => drawFigure(ctx, figure))
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportGif(
  project: Project,
  filename: string,
  onProgress?: (current: number, total: number) => void,
) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const canvas = document.createElement('canvas')
  canvas.width = project.canvasWidth
  canvas.height = project.canvasHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')

  const gif = GIFEncoder()
  const delay = Math.max(20, Math.round(1000 / project.fps))
  const total = project.frames.length

  for (let i = 0; i < total; i += 1) {
    onProgress?.(i + 1, total)
    await renderFrame(ctx, project, i)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, canvas.width, canvas.height, {
      palette,
      delay,
      repeat: i === 0 ? 0 : undefined,
    })
  }

  gif.finish()
  downloadBlob(new Blob([gif.bytes()], { type: 'image/gif' }), filename)
}

function pickMimeType(): string {
  const options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  return options.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) ?? ''
}

export async function exportVideo(
  project: Project,
  filename: string,
  onProgress?: (current: number, total: number) => void,
) {
  const mimeType = pickMimeType()
  if (!mimeType) throw new Error('video-unsupported')

  const canvas = document.createElement('canvas')
  canvas.width = project.canvasWidth
  canvas.height = project.canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  const stream = canvas.captureStream(project.fps)
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error('record'))
  })

  await renderFrame(ctx, project, 0)
  recorder.start()
  const delay = Math.max(40, Math.round(1000 / project.fps))
  const total = Math.max(1, project.frames.length)

  for (let i = 0; i < total; i += 1) {
    onProgress?.(i + 1, total)
    await renderFrame(ctx, project, i)
    const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }
    track.requestFrame?.()
    await new Promise((resolve) => window.setTimeout(resolve, delay))
  }

  await new Promise((resolve) => window.setTimeout(resolve, delay))
  if (recorder.state !== 'inactive') recorder.stop()
  await stopped
  stream.getTracks().forEach((track) => track.stop())

  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
  const name = filename.replace(/\.(webm|mp4)$/i, `.${extension}`)
  downloadBlob(new Blob(chunks, { type: mimeType.split(';')[0] }), name)
}
