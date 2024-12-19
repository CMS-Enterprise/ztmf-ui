import mockAxios from 'axios'
jest.mock('axios')
const mAxios = mockAxios as jest.Mocked<typeof mockAxios>

const mockResponse = [
  {
    function: {
      datacenterenvironment: 'test-center-environment',
      description: 'test description',
      function: 'test function',
      functiondid: 1,
    },
    pillar: {
      order: 1,
      pillar: 'test pillar',
      pillarid: 1,
    },
    noteprompt: 'test note prompt',
    order: 'test-order none',
    question: 'test question',
    questionid: 'test-question-id',
  },
]
it('test axios fetch', async () => {
  mAxios.get.mockResolvedValueOnce({ data: mockResponse })
})
