import { Routes } from '@/router/constants'

// Stand-in for the channel the module builds at load time. `dispatch` delivers
// to onmessage AND addEventListener handlers like a browser does, so the
// idempotency test can observe stacked handlers - driving onmessage directly
// never could, since the property holds one function.
class FakeBroadcastChannel {
  static last: FakeBroadcastChannel | null = null
  name: string
  onmessage: ((e: MessageEvent) => void) | null = null
  listeners: ((e: MessageEvent) => void)[] = []
  posted: unknown[] = []
  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.last = this
  }
  postMessage(data: unknown): void {
    this.posted.push(data)
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void): void {
    if (type === 'message') this.listeners.push(fn)
  }
  removeEventListener(type: string, fn: (e: MessageEvent) => void): void {
    if (type === 'message')
      this.listeners = this.listeners.filter((l) => l !== fn)
  }
  /** Deliver a message the way the browser would: onmessage AND every listener. */
  dispatch(data: unknown): void {
    const event = { data } as MessageEvent
    this.onmessage?.(event)
    this.listeners.forEach((fn) => fn(event))
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
    // Leaving the hash alone means a user who vetoes the reload via the
    // questionnaire's beforeunload guard loses nothing.
    window.location.hash = '#/users'
    const { initLogoutListener } = loadModule()
    initLogoutListener()

    FakeBroadcastChannel.last?.dispatch('logout')

    expect(window.location.reload as jest.Mock).toHaveBeenCalled()
    expect(window.location.hash).toBe('#/users')
  })

  it('ignores non-logout messages', () => {
    const { initLogoutListener } = loadModule()
    initLogoutListener()

    FakeBroadcastChannel.last?.dispatch('other')

    expect(window.location.reload as jest.Mock).not.toHaveBeenCalled()
  })

  it('is idempotent across repeat initLogoutListener calls', () => {
    const { initLogoutListener } = loadModule()
    initLogoutListener()
    initLogoutListener()

    FakeBroadcastChannel.last?.dispatch('logout')

    expect(window.location.reload as jest.Mock).toHaveBeenCalledTimes(1)
  })

  it('swallows a postMessage failure so the logging-out tab still finishes', () => {
    // handleLogout calls this before its own reload with the session already
    // dead, so an escaping throw would strand the user mid-logout.
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { broadcastLogout } = loadModule()
    const channel = FakeBroadcastChannel.last!
    channel.postMessage = () => {
      throw new Error('InvalidStateError')
    }

    expect(() => broadcastLogout()).not.toThrow()
    expect(errSpy).toHaveBeenCalled()

    errSpy.mockRestore()
  })

  it('reloads even when the tab is already on the sign-in route', () => {
    // A tab can sit on /signin with stale loader data still claiming a
    // session; skipping the reload would wedge it.
    window.location.hash = `#${Routes.SIGNIN}`
    const { initLogoutListener } = loadModule()
    initLogoutListener()

    FakeBroadcastChannel.last?.dispatch('logout')

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

describe('when constructing the channel throws', () => {
  // Import-time throw would white-screen the app; degrade to the no-op path.
  function loadModule() {
    ;(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel =
      function ThrowingChannel() {
        throw new Error('blocked by policy')
      } as unknown
    let mod!: typeof import('./sessionSync')
    jest.isolateModules(() => {
      mod = require('./sessionSync')
    })
    return mod
  }

  it('does not throw at import and leaves both functions as no-ops', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => loadModule()).not.toThrow()
    const { broadcastLogout, initLogoutListener } = loadModule()
    expect(() => broadcastLogout()).not.toThrow()
    expect(() => initLogoutListener()).not.toThrow()
    expect(window.location.reload as jest.Mock).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()

    errSpy.mockRestore()
  })
})
