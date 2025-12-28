/**
 * Tests for api.ts
 *
 * Testing ApiClient
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ApiClient, getApiClient, resetApiClient } from '../src/api';
import { SeedKeyError, ERROR_CODES } from '../src/types';
import { fetchMock, createTestUserProfile } from './setup';

describe('ApiClient', () => {
  const BASE_URL = 'https://api.example.com';

  beforeEach(() => {
    fetchMock.clear();
    resetApiClient();
  });

  describe('constructor', () => {
    it('should create client with baseUrl', () => {
      const client = new ApiClient(BASE_URL);
      expect(client).toBeDefined();
    });
  });

  describe('getUser', () => {
    it('should fetch user profile', async () => {
      const userProfile = createTestUserProfile();
      fetchMock.setJsonResponse(
        'GET',
        `${BASE_URL}/api/v1/seedkey/user`,
        { user: userProfile },
        true,
        200
      );

      const client = new ApiClient(BASE_URL);
      const result = await client.getUser('test-access-token');

      expect(result).toEqual(userProfile);
      expect(fetchMock.mock).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/seedkey/user`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw SeedKeyError on server error', async () => {
      fetchMock.setJsonResponse(
        'GET',
        `${BASE_URL}/api/v1/seedkey/user`,
        { error: 'INVALID_TOKEN', message: 'Token expired' },
        false,
        401
      );

      const client = new ApiClient(BASE_URL);

      await expect(client.getUser('invalid-token')).rejects.toThrow(SeedKeyError);

      try {
        await client.getUser('invalid-token');
      } catch (error) {
        expect(error).toBeInstanceOf(SeedKeyError);
        if (error instanceof SeedKeyError) {
          expect(error.code).toBe('INVALID_TOKEN');
          expect(error.message).toBe('Token expired');
        }
      }
    });

    it('should throw SeedKeyError on network error', async () => {
      // Mock fetch to throw an error
      fetchMock.mock.mockImplementationOnce(() => {
        throw new Error('Network failed');
      });

      const client = new ApiClient(BASE_URL);

      try {
        await client.getUser('token');
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SeedKeyError);
        if (error instanceof SeedKeyError) {
          expect(error.code).toBe(ERROR_CODES.NETWORK_ERROR);
          expect(error.message).toContain('Network');
        }
      }
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      fetchMock.setJsonResponse(
        'POST',
        `${BASE_URL}/api/v1/seedkey/logout`,
        { success: true },
        true,
        200
      );

      const client = new ApiClient(BASE_URL);
      await expect(client.logout('access-token')).resolves.not.toThrow();

      expect(fetchMock.mock).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/seedkey/logout`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer access-token',
          }),
        })
      );
    });

    it('should throw SeedKeyError on logout error', async () => {
      fetchMock.setJsonResponse(
        'POST',
        `${BASE_URL}/api/v1/seedkey/logout`,
        { error: 'SERVER_ERROR', message: 'Internal error' },
        false,
        500
      );

      const client = new ApiClient(BASE_URL);

      await expect(client.logout('token')).rejects.toThrow(SeedKeyError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 7200,
      };

      fetchMock.setJsonResponse(
        'POST',
        `${BASE_URL}/api/v1/seedkey/refresh`,
        newTokens,
        true,
        200
      );

      const client = new ApiClient(BASE_URL);
      const result = await client.refreshToken('old-refresh-token');

      expect(result).toEqual(newTokens);
      expect(fetchMock.mock).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/seedkey/refresh`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'old-refresh-token' }),
        })
      );
    });

    it('should throw SeedKeyError with INVALID_TOKEN for invalid refresh token', async () => {
      fetchMock.setJsonResponse(
        'POST',
        `${BASE_URL}/api/v1/seedkey/refresh`,
        { error: 'INVALID_TOKEN', message: 'Refresh token expired' },
        false,
        401
      );

      const client = new ApiClient(BASE_URL);

      try {
        await client.refreshToken('expired-token');
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SeedKeyError);
        if (error instanceof SeedKeyError) {
          expect(error.code).toBe('INVALID_TOKEN');
        }
      }
    });

    it('should use INVALID_TOKEN as default code on refresh error', async () => {
      fetchMock.setJsonResponse(
        'POST',
        `${BASE_URL}/api/v1/seedkey/refresh`,
        { message: 'Some error' },
        false,
        400
      );

      const client = new ApiClient(BASE_URL);

      try {
        await client.refreshToken('token');
        expect.fail('Should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SeedKeyError);
        if (error instanceof SeedKeyError) {
          expect(error.code).toBe(ERROR_CODES.INVALID_TOKEN);
        }
      }
    });
  });
});

describe('getApiClient (singleton)', () => {
  beforeEach(() => {
    resetApiClient();
  });

  it('should create singleton on first call with baseUrl', () => {
    const client1 = getApiClient('https://api.example.com');
    const client2 = getApiClient();

    expect(client1).toBe(client2);
  });

  it('should return the same instance on subsequent calls', () => {
    const client1 = getApiClient('https://api.example.com');
    const client2 = getApiClient('https://other.example.com'); // baseUrl is ignored
    const client3 = getApiClient();

    expect(client1).toBe(client2);
    expect(client2).toBe(client3);
  });

  it('should throw if not initialized', () => {
    expect(() => getApiClient()).toThrow(
      'ApiClient not initialized. Call getApiClient with baseUrl first.'
    );
  });
});

describe('resetApiClient', () => {
  it('should reset singleton', () => {
    const client1 = getApiClient('https://api.example.com');
    resetApiClient();

    expect(() => getApiClient()).toThrow();

    const client2 = getApiClient('https://api.example.com');
    expect(client1).not.toBe(client2);
  });

  it('should not throw on repeated reset', () => {
    resetApiClient();
    resetApiClient();
    expect(true).toBe(true);
  });
});

describe('ApiClient edge cases', () => {
  const BASE_URL = 'https://api.example.com';

  beforeEach(() => {
    fetchMock.clear();
  });

  it('should handle empty response body', async () => {
    fetchMock.setJsonResponse(
      'GET',
      `${BASE_URL}/api/v1/seedkey/user`,
      {},
      true,
      200
    );

    const client = new ApiClient(BASE_URL);
    const result = await client.getUser('token');

    expect(result).toBeUndefined(); // response.user will be undefined
  });

  it('should handle default error message', async () => {
    fetchMock.setJsonResponse(
      'GET',
      `${BASE_URL}/api/v1/seedkey/user`,
      {}, // no error and message
      false,
      500
    );

    const client = new ApiClient(BASE_URL);

    try {
      await client.getUser('token');
      expect.fail('Should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SeedKeyError);
      if (error instanceof SeedKeyError) {
        expect(error.code).toBe(ERROR_CODES.SERVER_ERROR);
        expect(error.message).toBe('Failed to get user');
      }
    }
  });

  it('should include Content-Type in headers', async () => {
    fetchMock.setJsonResponse(
      'POST',
      `${BASE_URL}/api/v1/seedkey/refresh`,
      { accessToken: 'new', refreshToken: 'new', expiresIn: 3600 },
      true,
      200
    );

    const client = new ApiClient(BASE_URL);
    await client.refreshToken('token');

    expect(fetchMock.mock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });
});
