export type WatchSite = {
  id: string
  name: string
  base_url: string
  episode_url_template: string | null
  search_url_template: string | null
}

export type SiteInput = {
  name: string
  base_url: string
  episode_url_template: string | null
  search_url_template: string | null
}

export type AnimeSite = {
  site_id: string
  name: string
  base_url: string
  episode_url_template: string | null
  search_url_template: string | null
  anime_url: string | null
}
