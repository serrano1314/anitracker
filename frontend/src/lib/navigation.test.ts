import { describe, expect, it } from 'vitest'
import { backFromLibrary, backFromSearch } from './navigation'

describe('anime detail back targets', () => {
  it('preserves library tab and page in the return link', () => {
    const params = new URLSearchParams({ status: 'watching', page: '2' })
    expect(backFromLibrary(params)).toEqual({
      label: 'Back to My List',
      to: '/?status=watching&page=2',
    })
  })

  it('preserves search query and page in the return link', () => {
    const params = new URLSearchParams({ q: 'One Piece', page: '2' })
    expect(backFromSearch(params)).toEqual({
      label: 'Back to Search',
      to: '/search?q=One+Piece&page=2',
    })
  })
})
