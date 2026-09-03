import queryClient from './queryClient'

describe('queryClient', () => {
  afterEach(() => {
    queryClient.clear()
  })

  it('uses the application query defaults', () => {
    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    })
  })
})
