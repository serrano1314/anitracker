import { createContext, useContext } from 'react'

export type DialogTone = 'default' | 'danger'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: DialogTone
}

export type NoticeOptions = {
  title: string
  message: string
}

export type DialogApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  error: (options: NoticeOptions) => Promise<void>
  success: (options: NoticeOptions) => Promise<void>
}

export const DialogContext = createContext<DialogApi | null>(null)

export function useDialog(): DialogApi {
  const dialog = useContext(DialogContext)
  if (!dialog) {
    throw new Error('useDialog must be used within DialogProvider')
  }
  return dialog
}
