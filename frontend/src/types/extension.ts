export type ExtensionToken = {
  id: string
  name: string
  last_used_at: string | null
  revoked: boolean
  created_at: string
}

export type ExtensionTokenCreated = ExtensionToken & {
  token: string
}
