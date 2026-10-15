export type BackTarget = {
  label: string
  to: string
}

export type AnimeDetailLocationState = {
  back?: BackTarget
}

export function backFromLibrary(params: URLSearchParams): BackTarget {
  const query = params.toString()
  return {
    label: 'Back to My List',
    to: query ? `/?${query}` : '/',
  }
}

export function backFromSearch(params: URLSearchParams): BackTarget {
  const query = params.toString()
  return {
    label: 'Back to Search',
    to: query ? `/search?${query}` : '/search',
  }
}
