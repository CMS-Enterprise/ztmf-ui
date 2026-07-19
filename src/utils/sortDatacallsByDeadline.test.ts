import { sortDatacallsByDeadline } from './sortDatacallsByDeadline'

type Row = { datacallid: number; deadline: string }
const ids = (rows: Row[]) => rows.map((r) => r.datacallid)

describe('sortDatacallsByDeadline', () => {
  it('orders by furthest-out deadline first', () => {
    const rows: Row[] = [
      { datacallid: 2, deadline: '2023-06-30' },
      { datacallid: 5, deadline: '2099-09-30' },
      { datacallid: 3, deadline: '2025-01-01' },
    ]
    expect(ids(sortDatacallsByDeadline(rows))).toEqual([5, 3, 2])
  })

  // #393: a re-imported historical call can carry the highest id but a passed
  // deadline; the furthest-out deadline must still win.
  it('does not let a higher datacallid outrank a further-out deadline', () => {
    const rows: Row[] = [
      { datacallid: 7, deadline: '2023-06-30' }, // highest id, already passed
      { datacallid: 6, deadline: '2099-09-30' }, // real current call
    ]
    expect(ids(sortDatacallsByDeadline(rows))[0]).toBe(6)
  })

  it('breaks ties on datacallid (higher first)', () => {
    const rows: Row[] = [
      { datacallid: 3, deadline: '2025-09-30' },
      { datacallid: 8, deadline: '2025-09-30' },
    ]
    expect(ids(sortDatacallsByDeadline(rows))).toEqual([8, 3])
  })

  it('sinks empty/malformed deadlines to the bottom instead of falling back to id', () => {
    const rows: Row[] = [
      { datacallid: 9, deadline: '' }, // bad deadline, highest id
      { datacallid: 1, deadline: 'not-a-date' },
      { datacallid: 4, deadline: '2025-09-30' },
    ]
    // the only valid deadline leads; the bad ones do not hijack the top slot
    expect(ids(sortDatacallsByDeadline(rows))[0]).toBe(4)
  })

  it('does not mutate the input array', () => {
    const rows: Row[] = [
      { datacallid: 1, deadline: '2023-01-01' },
      { datacallid: 2, deadline: '2099-01-01' },
    ]
    const before = ids(rows)
    sortDatacallsByDeadline(rows)
    expect(ids(rows)).toEqual(before)
  })
})
