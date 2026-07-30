import { Routes } from '@/router/constants'

// Minimal stand-in for the BroadcastChannel the module constructs at load time.
// Captures posted messages and the registered onmessage so tests can drive both
// the send and receive sides without a real channel.
class FakeBroadcastChannel {
  static last: FakeBroadcastChannel | null = null
  name: string
  onmessage: ((e: MessageEvent) => void) | null = null
  posted: unknown[] = []
  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.last = this
  }
  postMessage(data: unknown): void {
    this.posted.push(data)
  }
  close(): void {}
}

const originalLocation = window.location
const originalBroadcastChannel = (globalThis as { BroadcastChannel?: unknown })
  .BroadcastChannel

beforeEach(() => {
  jest.resetModules()
  FakeBroadcastChannel.last = null
  // jsdom forbids assigning hash / calling reload on the real location; swap in
  // a writable stub so the redirect is observable.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { hash: '', reload: jest.fn() },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  })
  ;(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel =
    originalBroadcastChannel
})

describe('with BroadcastChannel available', () => {
  function loadModule() {
    ;(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel =
      FakeBroadcastChannel as unknown
    // Fresh import so the module-level channel is built against the fake.
    let mod!: typeof import('./sessionSync')
    jest.isolateModules(() => {
      mod = require('./sessionSync')
    })
    return mod
  }

  it('broadcastLogout posts a logout message on the channel', () => {
    const { broadcastLogout } = loadModule()
    broadcastLogout()
    expect(FakeBroadcastChannel.last?.posted).toEqual(['logout'])
  })

  it('a received logout reloads the tab without touching the hash', () => {
    // The reload re-runs the root authLoader, which renders LoginPage on any
    // route - and leaving the hash alone means a user who vetoes the reload
    // via the questionnaire's beforeunload guard loses nothing.
    window.location.hash = '#/users'
    const { initLogoutListener } = loadModule()
    initLogoutListener()

    FakeBroadcastChannel.last?.onmessage?.({ data: 'logout' } as MessageEvent)

    expect(window.location.reload as jest.Mock).toHaveBeenCalled()
    expect(window.location.hash).toBe('#/users')
  })

  it('ignores non-logout messages', () => {
    const { initLogoutListener } = loadModule()
    initLogoutListener()

    FakeBroadcastChannel.last?.onmessage?.({ data: 'other' } as MessageEvent)

    expect(window.location.reload as jest.Mock).not.toHaveBeenCalled()
  })

  it('reloads even when the tab is already on the sign-in route', () => {
    // No "already on /signin" suppression: a tab can sit on /signin with
    // stale in-memory loader data still claiming an active session, and
    // skipping the reload would leave it wedged. Reloading a genuinely
    // signed-out /signin tab is cheap and idempotent.
    window.location.hash = `#${Routes.SIGNIN}`
    const { initLogoutListener } = loadModule()
    initLogoutListener()

    FakeBroadcastChannel.last?.onmessage?.({ data: 'logout' } as MessageEvent)

    expect(window.location.reload as jest.Mock).toHaveBeenCalled()
  })
})

describe('without BroadcastChannel (unsupported browser)', () => {
  function loadModule() {
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel
    let mod!: typeof import('./sessionSync')
    jest.isolateModules(() => {
      mod = require('./sessionSync')
    })
    return mod
  }

  it('broadcastLogout and initLogoutListener are safe no-ops', () => {
    const { broadcastLogout, initLogoutListener } = loadModule()
    expect(() => broadcastLogout()).not.toThrow()
    expect(() => initLogoutListener()).not.toThrow()
    expect(window.location.reload as jest.Mock).not.toHaveBeenCalled()
  })
})
