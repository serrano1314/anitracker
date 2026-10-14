export type User = {
  id: string
  email: string
  username: string
}

export type TokenResponse = {
  access_token: string
  token_type: string
}

export type RegisterRequest = {
  email: string
  username: string
  password: string
}

export type LoginRequest = {
  email: string
  password: string
}
