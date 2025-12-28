/**
 * Test environment setup and global mocks.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import {SDK_VERSION} from "../src";

// ============================================================================
// LocalStorage Mock
// ============================================================================

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    // Helpers for tests
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
    _reset: () => {
      store = {};
    },
  };
};

// ============================================================================
// Fetch Mock
// ============================================================================

export interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export const createFetchMock = () => {
  const mockResponses: Map<string, MockResponse> = new Map();

  const fetchMock = vi.fn(async (url: string, options?: RequestInit): Promise<MockResponse> => {
    const key = `${options?.method || 'GET'}:${url}`;
    const response = mockResponses.get(key);

    if (response) {
      return response;
    }

    // Default 404 response
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'NOT_FOUND', message: 'Not found' }),
    };
  });

  return {
    mock: fetchMock,
    setResponse: (method: string, url: string, response: MockResponse) => {
      mockResponses.set(`${method}:${url}`, response);
    },
    setJsonResponse: (method: string, url: string, data: unknown, ok = true, status = 200) => {
      mockResponses.set(`${method}:${url}`, {
        ok,
        status,
        json: async () => data,
      });
    },
    clear: () => {
      mockResponses.clear();
      fetchMock.mockClear();
    },
  };
};

// ============================================================================
// CustomEvent mock for communication with Extension
// ============================================================================

const REQUEST_EVENT = `seedkey:v1:request`;
const RESPONSE_EVENT = `seedkey:v1:response`;

export interface PendingExtensionRequest {
  action: string;
  requestId: string;
  payload: unknown;
  version: string;
  resolve: (data: unknown) => void;
}

export const createExtensionMock = () => {
  const pendingRequests: PendingExtensionRequest[] = [];

  // Listen to versioned events
  const handleRequest = (event: Event) => {
    const customEvent = event as CustomEvent;
    const { action, requestId, payload, version } = customEvent.detail;

    pendingRequests.push({
      action,
      requestId,
      payload,
      version: version || SDK_VERSION,
      resolve: (result: unknown) => {
        // Send response via versioned event
        const responseEvent = new CustomEvent(RESPONSE_EVENT, {
          detail: {
            type: 'SEEDKEY_RESPONSE',
            version: version || SDK_VERSION,
            requestId,
            success: true,
            result,
          },
          bubbles: true,
        });
        document.dispatchEvent(responseEvent);
      },
    });
  };

  return {
    install: () => {
      document.addEventListener(REQUEST_EVENT, handleRequest);
    },
    uninstall: () => {
      document.removeEventListener(REQUEST_EVENT, handleRequest);
    },
    getPendingRequests: () => [...pendingRequests],
    getLastRequest: () => pendingRequests[pendingRequests.length - 1],
    respondToLast: (result: unknown) => {
      const last = pendingRequests.pop();
      if (last) {
        last.resolve(result);
      }
    },
    respondWithError: (requestId: string, code: string, message: string) => {
      const responseEvent = new CustomEvent(RESPONSE_EVENT, {
        detail: {
          type: 'SEEDKEY_RESPONSE',
          version: SDK_VERSION,
          requestId,
          success: false,
          error: { code, message },
        },
        bubbles: true,
      });
      document.dispatchEvent(responseEvent);
    },
    clear: () => {
      pendingRequests.length = 0;
    },
    // Automatic response for specific actions
    autoRespond: (
      action: string,
      result: unknown | ((payload: unknown) => unknown)
    ) => {
      const handler = (event: Event) => {
        const customEvent = event as CustomEvent;
        const data = customEvent.detail;

        if (data.action === action) {
          const responseResult =
            typeof result === 'function' ? result(data.payload) : result;

          setTimeout(() => {
            const responseEvent = new CustomEvent(RESPONSE_EVENT, {
              detail: {
                type: 'SEEDKEY_RESPONSE',
                version: data.version || SDK_VERSION,
                requestId: data.requestId,
                success: true,
                result: responseResult,
              },
              bubbles: true,
            });
            document.dispatchEvent(responseEvent);
          }, 0);
        }
      };

      document.addEventListener(REQUEST_EVENT, handler);
      return () => document.removeEventListener(REQUEST_EVENT, handler);
    },
    // Automatic error response
    autoRespondWithError: (action: string, code: string, message: string) => {
      const handler = (event: Event) => {
        const customEvent = event as CustomEvent;
        const data = customEvent.detail;

        if (data.action === action) {
          setTimeout(() => {
            const responseEvent = new CustomEvent(RESPONSE_EVENT, {
              detail: {
                type: 'SEEDKEY_RESPONSE',
                version: data.version || SDK_VERSION,
                requestId: data.requestId,
                success: false,
                error: { code, message },
              },
              bubbles: true,
            });
            document.dispatchEvent(responseEvent);
          }, 0);
        }
      };

      document.addEventListener(REQUEST_EVENT, handler);
      return () => document.removeEventListener(REQUEST_EVENT, handler);
    },
    // Get event names for assertions
    getEventNames: () => ({
      request: REQUEST_EVENT,
      response: RESPONSE_EVENT,
    }),
  };
};

// ============================================================================
// Global Mocks
// ============================================================================

export const localStorageMock = createLocalStorageMock();
export const fetchMock = createFetchMock();
export const extensionMock = createExtensionMock();

// Set global localStorage mock
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Set global fetch mock
Object.defineProperty(globalThis, 'fetch', {
  value: fetchMock.mock,
  writable: true,
});

// ============================================================================
// Window Location Mock
// ============================================================================

const locationMock = {
  hostname: 'test.example.com',
  origin: 'https://test.example.com',
  href: 'https://test.example.com/page',
  protocol: 'https:',
  host: 'test.example.com',
  pathname: '/page',
  search: '',
  hash: '',
};

Object.defineProperty(globalThis, 'location', {
  value: locationMock,
  writable: true,
});

// ============================================================================
// Navigator Mock
// ============================================================================

const navigatorMock = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  language: 'ru-RU',
  languages: ['ru-RU', 'en-US'],
  platform: 'Win32',
  vendor: 'Google Inc.',
  onLine: true,
};

Object.defineProperty(globalThis, 'navigator', {
  value: navigatorMock,
  writable: true,
});

// ============================================================================
// Console mock (for testing logger)
// ============================================================================

export const consoleMock = {
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  group: vi.fn(),
  groupCollapsed: vi.fn(),
  groupEnd: vi.fn(),
  table: vi.fn(),
  time: vi.fn(),
  timeEnd: vi.fn(),
};

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeEach(() => {
  // Reset mocks between tests
  localStorageMock._reset();
  fetchMock.clear();
  extensionMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test challenge
 */
export function createTestChallenge(overrides: Partial<{
  nonce: string;
  timestamp: number;
  domain: string;
  action: 'register' | 'authenticate';
  expiresAt: number;
}> = {}) {
  const now = Date.now();
  return {
    nonce: 'test-nonce-123',
    timestamp: now,
    domain: 'test.example.com',
    action: 'authenticate' as const,
    expiresAt: now + 5 * 60 * 1000, // 5 minutes
    ...overrides,
  };
}

/**
 * Create a test TokenInfo
 */
export function createTestTokenInfo(overrides: Partial<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> = {}) {
  return {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresIn: 3600,
    ...overrides,
  };
}

/**
 * Create a test AuthResult
 */
export function createTestAuthResult(overrides: Partial<{
  success: boolean;
  action: 'login' | 'register';
  user: {
    id: string;
    publicKey: string;
    createdAt: string;
    lastLogin?: string;
  };
  token: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}> = {}) {
  return {
    success: true,
    action: 'login' as const,
    user: {
      id: 'user-123',
      publicKey: 'test-public-key',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    },
    token: createTestTokenInfo(),
    ...overrides,
  };
}

/**
 * Create a test UserProfile
 */
export function createTestUserProfile(overrides: Partial<{
  id: string;
  publicKey: {
    id: string;
    publicKey: string;
    deviceName?: string;
    addedAt: string;
    lastUsed: string;
  };
  createdAt: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    id: 'user-123',
    publicKey: {
      id: 'key-1',
      publicKey: 'test-public-key',
      deviceName: 'Chrome on Windows',
      addedAt: now,
      lastUsed: now,
    },
    createdAt: now,
    ...overrides,
  };
}

/**
 * Wait for a specified time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush promises (wait for all pending promises)
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
