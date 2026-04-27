import '@testing-library/jest-dom'
import { server } from './mocks/server'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// jsdom localStorage polyfill (needed for some jsdom versions)
const storage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v }),
  removeItem: vi.fn((k: string) => { delete storage[k] }),
  clear: vi.fn(() => { Object.keys(storage).forEach((k) => delete storage[k]) }),
  get length() { return Object.keys(storage).length },
  key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
}

if (typeof localStorage === 'undefined' || !(localStorage.getItem instanceof Function)) {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
}
