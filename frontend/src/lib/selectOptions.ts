import type { SelectOption } from '../components/Select'
import { STATUS_LABELS } from '../types/library'

export function libraryStatusSelectOptions(): SelectOption[] {
  return Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
}

export function scoreSelectOptions(): SelectOption[] {
  return [
    { value: '', label: 'No score' },
    ...Array.from({ length: 10 }, (_, index) => {
      const score = String(index + 1)
      return { value: score, label: score }
    }),
  ]
}
