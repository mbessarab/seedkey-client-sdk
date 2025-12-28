import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveTokens,
  getAccessToken,
  getRefreshToken,
  getUserId,
  isTokenExpired,
  hasToken,
  clearTokens,
  getSession,
} from '../src/storage';
import { localStorageMock, createTestTokenInfo } from './setup';

describe('storage', () => {
  beforeEach(() => {
    localStorageMock._reset();
    vi.clearAllMocks();
  });

  describe('saveTokens', () => {
    it('should save tokens to localStorage', () => {
      const tokens = createTestTokenInfo();

      saveTokens(tokens);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'seedkey_access_token',
        'test-access-token'
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'seedkey_refresh_token',
        'test-refresh-token'
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'seedkey_expires_at',
        expect.any(String)
      );
    });

    it('should save userId if provided', () => {
      const tokens = createTestTokenInfo();

      saveTokens(tokens, 'user-123');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'seedkey_user_id',
        'user-123'
      );
    });

    it('should not save userId if not provided', () => {
      const tokens = createTestTokenInfo();

      saveTokens(tokens);

      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
        'seedkey_user_id',
        expect.anything()
      );
    });

    it('should compute expiresAt correctly', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const tokens = createTestTokenInfo({ expiresIn: 7200 }); // 2 hours
      saveTokens(tokens);

      const expectedExpiresAt = now + 7200 * 1000;
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'seedkey_expires_at',
        expectedExpiresAt.toString()
      );
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from localStorage', () => {
      localStorageMock._setStore({
        seedkey_access_token: 'my-access-token',
      });

      const token = getAccessToken();

      expect(token).toBe('my-access-token');
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'seedkey_access_token'
      );
    });

    it('should return null if token is missing', () => {
      const token = getAccessToken();

      expect(token).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should return refresh token from localStorage', () => {
      localStorageMock._setStore({
        seedkey_refresh_token: 'my-refresh-token',
      });

      const token = getRefreshToken();

      expect(token).toBe('my-refresh-token');
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'seedkey_refresh_token'
      );
    });

    it('should return null if token is missing', () => {
      const token = getRefreshToken();

      expect(token).toBeNull();
    });
  });

  describe('getUserId', () => {
    it('should return user ID from localStorage', () => {
      localStorageMock._setStore({
        seedkey_user_id: 'user-456',
      });

      const userId = getUserId();

      expect(userId).toBe('user-456');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('seedkey_user_id');
    });

    it('should return null if user ID is missing', () => {
      const userId = getUserId();

      expect(userId).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true if expiresAt is not set', () => {
      const expired = isTokenExpired();

      expect(expired).toBe(true);
    });

    it('should return true if token is expired', () => {
      const pastTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      localStorageMock._setStore({
        seedkey_expires_at: pastTime.toString(),
      });

      const expired = isTokenExpired();

      expect(expired).toBe(true);
    });

    it('should return true if token expires within 5 minutes (buffer)', () => {
      const nearFuture = Date.now() + 4 * 60 * 1000; // in 4 minutes
      localStorageMock._setStore({
        seedkey_expires_at: nearFuture.toString(),
      });

      const expired = isTokenExpired();

      expect(expired).toBe(true);
    });

    it('should return false if token is still valid', () => {
      const futureTime = Date.now() + 30 * 60 * 1000; // in 30 minutes
      localStorageMock._setStore({
        seedkey_expires_at: futureTime.toString(),
      });

      const expired = isTokenExpired();

      expect(expired).toBe(false);
    });

    it('should return false if token expires in exactly 5 minutes + 1ms', () => {
      const exactBuffer = Date.now() + 5 * 60 * 1000 + 1; // 5 minutes + 1ms
      localStorageMock._setStore({
        seedkey_expires_at: exactBuffer.toString(),
      });

      const expired = isTokenExpired();

      expect(expired).toBe(false);
    });
  });

  describe('hasToken', () => {
    it('should return true if access token exists', () => {
      localStorageMock._setStore({
        seedkey_access_token: 'some-token',
      });

      const has = hasToken();

      expect(has).toBe(true);
    });

    it('should return false if access token does not exist', () => {
      const has = hasToken();

      expect(has).toBe(false);
    });

    it('should return false if access token is an empty string', () => {
      localStorageMock._setStore({
        seedkey_access_token: '',
      });

      const has = hasToken();

      expect(has).toBe(false);
    });
  });

  describe('clearTokens', () => {
    it('should remove all tokens from localStorage', () => {
      localStorageMock._setStore({
        seedkey_access_token: 'access',
        seedkey_refresh_token: 'refresh',
        seedkey_expires_at: '12345',
        seedkey_user_id: 'user',
        other_key: 'should-remain',
      });

      clearTokens();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'seedkey_access_token'
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'seedkey_refresh_token'
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'seedkey_expires_at'
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'seedkey_user_id'
      );

      // other_key should remain
      expect(localStorageMock._getStore()['other_key']).toBe('should-remain');
    });
  });

  describe('getSession', () => {
    it('should return full session data', () => {
      const futureTime = Date.now() + 60 * 60 * 1000;
      localStorageMock._setStore({
        seedkey_access_token: 'access-token',
        seedkey_refresh_token: 'refresh-token',
        seedkey_user_id: 'user-123',
        seedkey_expires_at: futureTime.toString(),
      });

      const session = getSession();

      expect(session).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        userId: 'user-123',
        isExpired: false,
      });
    });

    it('should return null for missing data', () => {
      const session = getSession();

      expect(session).toEqual({
        accessToken: null,
        refreshToken: null,
        userId: null,
        isExpired: true,
      });
    });

    it('should set isExpired: true for an expired token', () => {
      const pastTime = Date.now() - 60 * 1000;
      localStorageMock._setStore({
        seedkey_access_token: 'access-token',
        seedkey_refresh_token: 'refresh-token',
        seedkey_expires_at: pastTime.toString(),
      });

      const session = getSession();

      expect(session.isExpired).toBe(true);
    });

    it('should set isExpired: false for a valid token', () => {
      const futureTime = Date.now() + 30 * 60 * 1000;
      localStorageMock._setStore({
        seedkey_access_token: 'access-token',
        seedkey_expires_at: futureTime.toString(),
      });

      const session = getSession();

      expect(session.isExpired).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('saveTokens -> getSession -> clearTokens', () => {
      // 1. Save
      const tokens = createTestTokenInfo({ expiresIn: 3600 });
      saveTokens(tokens, 'user-abc');

      // 2. Verify session
      const session = getSession();
      expect(session.accessToken).toBe('test-access-token');
      expect(session.refreshToken).toBe('test-refresh-token');
      expect(session.userId).toBe('user-abc');
      expect(session.isExpired).toBe(false);

      // 3. Clear
      clearTokens();

      // 4. Verify cleared
      const clearedSession = getSession();
      expect(clearedSession.accessToken).toBeNull();
      expect(clearedSession.refreshToken).toBeNull();
      expect(clearedSession.userId).toBeNull();
      expect(clearedSession.isExpired).toBe(true);
    });

    it('hasToken reflects state after saveTokens/clearTokens', () => {
      expect(hasToken()).toBe(false);

      saveTokens(createTestTokenInfo());
      expect(hasToken()).toBe(true);

      clearTokens();
      expect(hasToken()).toBe(false);
    });
  });
});
