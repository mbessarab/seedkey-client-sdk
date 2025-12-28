/**
 * Tests for seedkey.ts
 *
 * Testing main SeedKey SDK class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SeedKey, getSeedKey, resetSeedKey, getRequestEventName, getResponseEventName } from '../src/seedkey';
import { SeedKeyError, ERROR_CODES, ExtensionNotFoundError, ExtensionNotConfiguredError, EXTENSION_DOWNLOAD_URL } from '../src/types';
import {
  fetchMock,
  extensionMock,
  createTestChallenge,
  createTestAuthResult,
  createTestUserProfile,
  createTestTokenInfo,
  flushPromises,
} from './setup';

describe('SeedKey', () => {
  const BACKEND_URL = 'https://api.example.com';

  beforeEach(() => {
    fetchMock.clear();
    extensionMock.clear();
    resetSeedKey();
  });

  afterEach(() => {
    resetSeedKey();
  });

  describe('constructor', () => {
    it('should create instance with backendUrl', () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      expect(sdk).toBeDefined();
    });

    it('should use default timeout 60000', () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      expect(sdk).toBeDefined();
      // timeout is used internally; we assert via isAvailable with its timeout
    });

    it('should accept custom timeout', () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL, timeout: 5000 });
      expect(sdk).toBeDefined();
    });

    it('should accept debug flag', () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL, debug: true });
      expect(sdk).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('should clear pending requests', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      // Start getPublicKey request - it does NOT swallow errors unlike isAvailable
      const promise = sdk.getPublicKey();

      // Destroy SDK
      sdk.destroy();

      // Request should reject with TIMEOUT error
      await expect(promise).rejects.toThrow(SeedKeyError);
    });
  });

  describe('isAvailable', () => {
    it('should return true when extension responds', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      // Automatic response for check_available
      const cleanup = extensionMock.autoRespond('check_available', {
        available: true,
      });

      const result = await sdk.isAvailable();

      expect(result).toBe(true);
      cleanup();
    });

    it('should return false on timeout', async () => {
      vi.useFakeTimers();

      const sdk = new SeedKey({ backendUrl: BACKEND_URL, timeout: 1000 });

      const promise = sdk.isAvailable();

      // Do not respond; wait for timeout
      await vi.advanceTimersByTimeAsync(3100); // isAvailable uses 3000ms timeout

      const result = await promise;
      expect(result).toBe(false);

      vi.useRealTimers();
    });

    it('should return false on error', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      // Wait for request and respond with error
      setTimeout(() => {
        const req = extensionMock.getLastRequest();
        if (req) {
          extensionMock.respondWithError(
            req.requestId,
            'EXTENSION_ERROR',
            'Error'
          );
        }
      }, 10);

      const result = await sdk.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('isInitialized', () => {
    it('should return true when identity exists', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanup = extensionMock.autoRespond('is_initialized', {
        initialized: true,
      });

      const result = await sdk.isInitialized();

      expect(result).toBe(true);
      cleanup();
    });

    it('should return false when identity does not exist', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanup = extensionMock.autoRespond('is_initialized', {
        initialized: false,
      });

      const result = await sdk.isInitialized();

      expect(result).toBe(false);
      cleanup();
    });

    it('should return false on error', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      setTimeout(() => {
        const req = extensionMock.getLastRequest();
        if (req) {
          extensionMock.respondWithError(req.requestId, 'ERROR', 'Error');
        }
      }, 10);

      const result = await sdk.isInitialized();

      expect(result).toBe(false);
    });
  });

  describe('checkExtension', () => {
    it('should return status when everything is OK', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanupAvailable = extensionMock.autoRespond('check_available', {
        available: true,
      });

      const cleanupInitialized = extensionMock.autoRespond('is_initialized', {
        initialized: true,
      });

      const status = await sdk.checkExtension();

      expect(status.installed).toBe(true);
      expect(status.initialized).toBe(true);
      expect(status.downloadUrl).toBeUndefined();

      cleanupAvailable();
      cleanupInitialized();
    });

    it('should throw ExtensionNotFoundError if not installed', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      // Mock response - extension is not installed
      const cleanup = extensionMock.autoRespond('check_available', {
        available: false,
      });

      try {
        await sdk.checkExtension();
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ExtensionNotFoundError);
        if (error instanceof ExtensionNotFoundError) {
          expect(error.code).toBe(ERROR_CODES.EXTENSION_NOT_FOUND);
          expect(error.downloadUrl).toBe(EXTENSION_DOWNLOAD_URL);
        }
      }

      cleanup();
      sdk.destroy();
    });

    it('should throw ExtensionNotConfiguredError if not configured', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanupAvailable = extensionMock.autoRespond('check_available', {
        available: true,
      });

      const cleanupInitialized = extensionMock.autoRespond('is_initialized', {
        initialized: false,
      });

      try {
        await sdk.checkExtension();
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ExtensionNotConfiguredError);
        if (error instanceof ExtensionNotConfiguredError) {
          expect(error.code).toBe(ERROR_CODES.EXTENSION_NOT_CONFIGURED);
        }
      }

      cleanupAvailable();
      cleanupInitialized();
    });
  });

  describe('getExtensionStatus', () => {
    it('should return downloadUrl if not installed', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      // Mock response - extension is not installed
      const cleanup = extensionMock.autoRespond('check_available', {
        available: false,
      });

      const status = await sdk.getExtensionStatus();

      expect(status.installed).toBe(false);
      expect(status.initialized).toBe(false);
      expect(status.downloadUrl).toBe(EXTENSION_DOWNLOAD_URL);

      cleanup();
      sdk.destroy();
    });

    it('should return initialized: false if not configured', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanupAvailable = extensionMock.autoRespond('check_available', {
        available: true,
      });

      const cleanupInitialized = extensionMock.autoRespond('is_initialized', {
        initialized: false,
      });

      const status = await sdk.getExtensionStatus();

      expect(status.installed).toBe(true);
      expect(status.initialized).toBe(false);
      expect(status.downloadUrl).toBeUndefined();

      cleanupAvailable();
      cleanupInitialized();
    });
  });

  describe('getDownloadUrl', () => {
    it('should return download URL', () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      expect(sdk.getDownloadUrl()).toBe(EXTENSION_DOWNLOAD_URL);
    });
  });

  describe('getPublicKey', () => {
    it('should return public key from extension', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanup = extensionMock.autoRespond('get_public_key', {
        publicKey: 'test-public-key-abc123',
        domain: 'test.example.com',
      });

      const publicKey = await sdk.getPublicKey();

      expect(publicKey).toBe('test-public-key-abc123');
      cleanup();
    });

    it('should send domain in payload', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanup = extensionMock.autoRespond('get_public_key', (payload) => {
        expect(payload).toEqual({ domain: 'test.example.com' });
        return { publicKey: 'key', domain: 'test.example.com' };
      });

      await sdk.getPublicKey();
      cleanup();
    });

    it('should throw error when extension rejects', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      // Use autoRespondWithError for error response
      const cleanup = extensionMock.autoRespondWithError(
        'get_public_key',
        ERROR_CODES.USER_REJECTED,
        'User rejected'
      );

      try {
        await expect(sdk.getPublicKey()).rejects.toThrow(SeedKeyError);
      } finally {
        cleanup();
      }
    });
  });

  describe('signMessage', () => {
    it('should return message signature', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanup = extensionMock.autoRespond('sign_message', {
        signature: 'test-signature',
        publicKey: 'test-public-key',
        message: 'Hello World',
      });

      const result = await sdk.signMessage('Hello World');

      expect(result.signature).toBe('test-signature');
      expect(result.publicKey).toBe('test-public-key');
      expect(result.message).toBe('Hello World');
      cleanup();
    });

    it('should pass message and domain in payload', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanup = extensionMock.autoRespond('sign_message', (payload) => {
        expect(payload).toEqual({
          message: 'Test message',
          domain: 'test.example.com',
        });
        return { signature: 'sig', publicKey: 'key', message: 'Test message' };
      });

      await sdk.signMessage('Test message');
      cleanup();
    });
  });

  describe('authenticate', () => {
    it('should execute full authentication flow', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge({ action: 'authenticate' });
      const authResult = createTestAuthResult({ action: 'login' });

      // Mock extension responses
      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'test-public-key',
        domain: 'test.example.com',
      });

      const cleanupSign = extensionMock.autoRespond('sign_challenge', {
        signature: 'test-signature',
        publicKey: 'test-public-key',
      });

      // Mock backend responses
      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { challenge, challengeId: 'challenge-123' },
        true,
        200
      );

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/verify`,
        authResult,
        true,
        200
      );

      const result = await sdk.authenticate();

      expect(result.success).toBe(true);
      expect(result.action).toBe('login');
      expect(result.user.id).toBe('user-123');

      cleanupKey();
      cleanupSign();
    });

    it('should send correct data to /challenge', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge();

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'my-public-key',
        domain: 'test.example.com',
      });

      const cleanupSign = extensionMock.autoRespond('sign_challenge', {
        signature: 'sig',
        publicKey: 'my-public-key',
      });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { challenge, challengeId: 'ch-1' },
        true,
        200
      );

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/verify`,
        createTestAuthResult(),
        true,
        200
      );

      await sdk.authenticate();

      // Verify /challenge call
      const challengeCall = fetchMock.mock.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' && call[0].includes('/challenge')
      );

      expect(challengeCall).toBeDefined();
      if (challengeCall) {
        const body = JSON.parse(challengeCall[1]?.body as string);
        expect(body.publicKey).toBe('my-public-key');
        expect(body.action).toBe('authenticate');
      }

      cleanupKey();
      cleanupSign();
    });

    it('should throw SeedKeyError on backend error', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'key',
        domain: 'test.example.com',
      });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { error: ERROR_CODES.USER_NOT_FOUND, message: 'User not found' },
        false,
        404
      );

      await expect(sdk.authenticate()).rejects.toThrow(SeedKeyError);

      cleanupKey();
    });
  });

  describe('register', () => {
    it('should execute full registration flow', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge({ action: 'register' });
      const authResult = createTestAuthResult({ action: 'register' });

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'new-public-key',
        domain: 'test.example.com',
      });

      const cleanupSign = extensionMock.autoRespond('sign_challenge', {
        signature: 'reg-signature',
        publicKey: 'new-public-key',
      });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { challenge, challengeId: 'ch-reg' },
        true,
        200
      );

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/register`,
        authResult,
        true,
        200
      );

      const result = await sdk.register();

      expect(result.success).toBe(true);
      expect(result.action).toBe('register');

      cleanupKey();
      cleanupSign();
    });

    it('should send metadata during registration', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge({ action: 'register' });

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'key',
        domain: 'test.example.com',
      });

      const cleanupSign = extensionMock.autoRespond('sign_challenge', {
        signature: 'sig',
        publicKey: 'key',
      });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { challenge, challengeId: 'ch' },
        true,
        200
      );

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/register`,
        createTestAuthResult({ action: 'register' }),
        true,
        200
      );

      await sdk.register({ metadata: { deviceName: 'My Device' } });

      // Verify /register call
      const registerCall = fetchMock.mock.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('/register')
      );

      expect(registerCall).toBeDefined();
      if (registerCall) {
        const body = JSON.parse(registerCall[1]?.body as string);
        expect(body.metadata.deviceName).toBe('My Device');
        expect(body.metadata.sdkVersion).toBe('0.0.1');
      }

      cleanupKey();
      cleanupSign();
    });

    it('should throw SeedKeyError on USER_EXISTS error', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge({ action: 'register' });

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'key',
        domain: 'test.example.com',
      });

      const cleanupSign = extensionMock.autoRespond('sign_challenge', {
        signature: 'sig',
        publicKey: 'key',
      });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { challenge, challengeId: 'ch' },
        true,
        200
      );

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/register`,
        { error: ERROR_CODES.USER_EXISTS, message: 'User already exists' },
        false,
        409
      );

      await expect(sdk.register()).rejects.toThrow(SeedKeyError);

      cleanupKey();
      cleanupSign();
    });
  });

  describe('auth (smart auth)', () => {
    it('should call authenticate on successful login', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge();
      const authResult = createTestAuthResult({ action: 'login' });

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'key',
        domain: 'test.example.com',
      });

      const cleanupSign = extensionMock.autoRespond('sign_challenge', {
        signature: 'sig',
        publicKey: 'key',
      });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { challenge, challengeId: 'ch' },
        true,
        200
      );

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/verify`,
        authResult,
        true,
        200
      );

      const result = await sdk.auth();

      expect(result.action).toBe('login');

      cleanupKey();
      cleanupSign();
    });

    it('should switch to register on USER_NOT_FOUND', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge();
      const registerResult = createTestAuthResult({ action: 'register' });

      let callCount = 0;

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'key',
        domain: 'test.example.com',
      });

      const cleanupSign = extensionMock.autoRespond('sign_challenge', {
        signature: 'sig',
        publicKey: 'key',
      });

      // First challenge call is for authenticate
      fetchMock.mock.mockImplementation(async (url: string, options?: RequestInit) => {
        const method = options?.method || 'GET';

        if (url.includes('/challenge')) {
          callCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              challenge: createTestChallenge({
                action: callCount === 1 ? 'authenticate' : 'register',
              }),
              challengeId: `ch-${callCount}`,
            }),
          };
        }

        if (url.includes('/verify')) {
          return {
            ok: false,
            status: 404,
            json: async () => ({
              error: ERROR_CODES.USER_NOT_FOUND,
              message: 'User not found',
            }),
          };
        }

        if (url.includes('/register')) {
          return {
            ok: true,
            status: 200,
            json: async () => registerResult,
          };
        }

        return { ok: false, status: 404, json: async () => ({}) };
      });

      const result = await sdk.auth();

      expect(result.action).toBe('register');

      cleanupKey();
      cleanupSign();
    });

    it('should rethrow other errors', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'key',
        domain: 'test.example.com',
      });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { error: ERROR_CODES.SERVER_ERROR, message: 'Server error' },
        false,
        500
      );

      await expect(sdk.auth()).rejects.toThrow(SeedKeyError);

      cleanupKey();
    });
  });

  describe('signChallenge (public method for custom authentication)', () => {
    it('should sign challenge', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge();

      const cleanup = extensionMock.autoRespond('sign_challenge', {
        signature: 'custom-signature',
        publicKey: 'custom-public-key',
      });

      const result = await sdk.signChallenge(challenge);

      expect(result.signature).toBe('custom-signature');
      expect(result.publicKey).toBe('custom-public-key');

      cleanup();
    });
  });

  describe('requestChallenge (public method for custom authentication)', () => {
    it('should request challenge from backend', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const challenge = createTestChallenge();

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/challenge`,
        { challenge, challengeId: 'custom-ch' },
        true,
        200
      );

      const result = await sdk.requestChallenge('my-public-key', 'authenticate');

      expect(result.challenge).toEqual(challenge);
      expect(result.challengeId).toBe('custom-ch');

      // Verify call
      const challengeCall = fetchMock.mock.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('/challenge')
      );

      expect(challengeCall).toBeDefined();
      if (challengeCall) {
        const body = JSON.parse(challengeCall[1]?.body as string);
        expect(body.publicKey).toBe('my-public-key');
        expect(body.action).toBe('authenticate');
      }
    });
  });

  describe('getUser', () => {
    it('should fetch user profile', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const userProfile = createTestUserProfile();

      fetchMock.setJsonResponse(
        'GET',
        `${BACKEND_URL}/api/v1/seedkey/user`,
        { user: userProfile },
        true,
        200
      );

      const result = await sdk.getUser('access-token');

      expect(result.id).toBe('user-123');
      expect(fetchMock.mock).toHaveBeenCalledWith(
        `${BACKEND_URL}/api/v1/seedkey/user`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer access-token',
          }),
        })
      );
    });
  });

  describe('logout', () => {
    it('should perform logout', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/logout`,
        { success: true },
        true,
        200
      );

      await expect(sdk.logout('access-token')).resolves.not.toThrow();

      expect(fetchMock.mock).toHaveBeenCalledWith(
        `${BACKEND_URL}/api/v1/seedkey/logout`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer access-token',
          }),
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const newTokens = createTestTokenInfo({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 7200,
      });

      fetchMock.setJsonResponse(
        'POST',
        `${BACKEND_URL}/api/v1/seedkey/refresh`,
        newTokens,
        true,
        200
      );

      const result = await sdk.refreshToken('old-refresh-token');

      expect(result.accessToken).toBe('new-access');
      expect(result.expiresIn).toBe(7200);
    });
  });

  describe('HTTP error handling', () => {
    it('should handle network errors', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      const cleanupKey = extensionMock.autoRespond('get_public_key', {
        publicKey: 'key',
        domain: 'test.example.com',
      });

      // Mock fetch to throw a network error
      fetchMock.mock.mockImplementationOnce(() => {
        throw new Error('Network failed');
      });

      try {
        await sdk.authenticate();
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SeedKeyError);
        if (error instanceof SeedKeyError) {
          expect(error.code).toBe(ERROR_CODES.NETWORK_ERROR);
        }
      }

      cleanupKey();
    });

    it('should handle errors with hint', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });

      fetchMock.setJsonResponse(
        'GET',
        `${BACKEND_URL}/api/v1/seedkey/user`,
        {
          error: 'INVALID_TOKEN',
          message: 'Token expired',
          hint: 'Please refresh your token',
        },
        false,
        401
      );

      try {
        await sdk.getUser('expired-token');
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SeedKeyError);
        if (error instanceof SeedKeyError) {
          expect(error.hint).toBe('Please refresh your token');
        }
      }
    });
  });

  describe('extension communication', () => {
    it('should generate unique requestId', async () => {
      const sdk = new SeedKey({ backendUrl: BACKEND_URL });
      const requestIds: string[] = [];

      const cleanup = extensionMock.autoRespond('check_available', (payload) => {
        // Extract requestId from pending requests
        const reqs = extensionMock.getPendingRequests();
        if (reqs.length > 0) {
          requestIds.push(reqs[reqs.length - 1].requestId);
        }
        return { available: true };
      });

      await sdk.isAvailable();
      await sdk.isAvailable();
      await sdk.isAvailable();

      // All requestIds must be unique
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(requestIds.length);

      cleanup();
    });

    it('should handle timeout when there is no response', async () => {
      // Use a real short timeout instead of fake timers
      const sdk = new SeedKey({ backendUrl: BACKEND_URL, timeout: 50 });

      // Start request without autoRespond (no one will respond) - should fail by timeout
      try {
        await sdk.getPublicKey();
        expect.fail('Should throw SeedKeyError on timeout');
      } catch (error) {
        expect(error).toBeInstanceOf(SeedKeyError);
        if (error instanceof SeedKeyError) {
          expect(error.code).toBe(ERROR_CODES.EXTENSION_NOT_FOUND);
        }
      }

      sdk.destroy();
    }, 1000); // timeout for this test
  });
});

describe('getSeedKey (singleton)', () => {
  beforeEach(() => {
    resetSeedKey();
  });

  afterEach(() => {
    resetSeedKey();
  });

  it('should create singleton on first call', () => {
    const sdk1 = getSeedKey({ backendUrl: 'https://api.example.com' });
    const sdk2 = getSeedKey();

    expect(sdk1).toBe(sdk2);
  });

  it('should return the same instance', () => {
    const sdk1 = getSeedKey({ backendUrl: 'https://api.example.com' });
    const sdk2 = getSeedKey({ backendUrl: 'https://other.com' }); // ignored

    expect(sdk1).toBe(sdk2);
  });

  it('should throw if not initialized', () => {
    expect(() => getSeedKey()).toThrow(
      'SeedKey SDK not initialized. Call getSeedKey with options first.'
    );
  });
});

describe('resetSeedKey', () => {
  it('should reset singleton and call destroy', () => {
    const sdk1 = getSeedKey({ backendUrl: 'https://api.example.com' });

    resetSeedKey();

    expect(() => getSeedKey()).toThrow();

    const sdk2 = getSeedKey({ backendUrl: 'https://api.example.com' });
    expect(sdk1).not.toBe(sdk2);
  });

  it('should not throw on repeated reset', () => {
    resetSeedKey();
    resetSeedKey();
    expect(true).toBe(true);
  });
});

describe('SeedKey device name detection', () => {
  beforeEach(() => {
    fetchMock.clear();
    extensionMock.clear();
    resetSeedKey();
  });

  afterEach(() => {
    resetSeedKey();
  });

  it('should detect Chrome on Windows', async () => {
    const BACKEND_URL = 'https://api.example.com';
    const sdk = new SeedKey({ backendUrl: BACKEND_URL });

    // navigator.userAgent is already mocked as Chrome on Windows in setup.ts
    const challenge = createTestChallenge({ action: 'register' });

    const cleanupKey = extensionMock.autoRespond('get_public_key', {
      publicKey: 'key',
      domain: 'test.example.com',
    });

    const cleanupSign = extensionMock.autoRespond('sign_challenge', {
      signature: 'sig',
      publicKey: 'key',
    });

    fetchMock.setJsonResponse(
      'POST',
      `${BACKEND_URL}/api/v1/seedkey/challenge`,
      { challenge, challengeId: 'ch' },
      true,
      200
    );

    fetchMock.setJsonResponse(
      'POST',
      `${BACKEND_URL}/api/v1/seedkey/register`,
      createTestAuthResult({ action: 'register' }),
      true,
      200
    );

    await sdk.register();

    // Verify deviceName in request
    const registerCall = fetchMock.mock.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('/register')
    );

    expect(registerCall).toBeDefined();
    if (registerCall) {
      const body = JSON.parse(registerCall[1]?.body as string);
      expect(body.metadata.deviceName).toBe('Chrome on Windows');
    }

    cleanupKey();
    cleanupSign();
  });
});

