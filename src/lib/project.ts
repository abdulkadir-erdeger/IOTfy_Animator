import type { Background, Project } from '../types'
import { DEFAULT_TEMPLATES, createFigureFromTemplate } from './figures'
import { uid } from './ids'

export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 450

export const BACKGROUNDS: Background[] = [
  { id: 'white', name: 'Beyaz Kağıt', type: 'color', value: '#ffffff' },
  { id: 'sky', name: 'Gökyüzü', type: 'gradient', value: 'linear-gradient(180deg, #7dd3fc 0%, #e0f2fe 55%, #bbf7d0 100%)' },
  { id: 'sunset', name: 'Gün Batımı', type: 'gradient', value: 'linear-gradient(180deg, #fb7185 0%, #fdba74 42%, #fde68a 100%)' },
  { id: 'space', name: 'Uzay', type: 'gradient', value: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)' },
  { id: 'class', name: 'Sınıf', type: 'gradient', value: 'linear-gradient(180deg, #e0f2fe 0%, #fef3c7 70%, #d6d3d1 100%)' },
]

const STORAGE_KEY = 'iotfy-animator-project-v1'

export function createDefaultProject(): Project {
  const stickman = DEFAULT_TEMPLATES[0]
  return {
    frames: [
      {
        id: uid('frame'),
        figures: [
          createFigureFromTemplate(stickman, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.62, 1),
        ],
      },
    ],
    templates: DEFAULT_TEMPLATES.map((template) => ({
      ...template,
      joints: template.joints.map((joint) => ({ ...joint })),
    })),
    fps: 8,
    loop: true,
    background: BACKGROUNDS[0],
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
  }
}

export function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultProject()
    const parsed = JSON.parse(raw) as Project
    if (!parsed.frames?.length) return createDefaultProject()
    return {
      ...createDefaultProject(),
      ...parsed,
      templates: parsed.templates?.length ? parsed.templates : DEFAULT_TEMPLATES,
    }
  } catch {
    return createDefaultProject()
  }
}

export function saveProject(project: Project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  } catch {
    // ignore quota errors
  }
}

export function downloadProject(project: Project, filename = 'iotfy-animasyon.json') {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
