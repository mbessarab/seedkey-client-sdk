/**
 * API client for backend integration
 */

import { UserProfile, SeedKeyError, ERROR_CODES } from './types';
import { apiLogger as log } from './logger';

// ============================================================================
// API Client
// ============================================================================

export class ApiClient {
  constructor(private baseUrl: string) {
    log.info('ApiClient initialized', { baseUrl });
  }

  /**
   * Get user profile
   */
  async getUser(accessToken: string): Promise<UserProfile> {
    log.debug('GET /api/v1/seedkey/user');
    const response = await this.fetch('/api/v1/seedkey/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      log.error('Failed to get user', { status: response.status, error });
      throw new SeedKeyError(
        error.error || ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to get user'
      );
    }

    const data = await response.json();
    log.info('User retrieved', { userId: data.user?.id });
    return data.user;
  }

  /**
   * Logout (invalidate token)
   */
  async logout(accessToken: string): Promise<void> {
    log.debug('POST /api/v1/seedkey/logout');
    const response = await this.fetch('/api/v1/seedkey/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      log.error('Logout failed', { status: response.status, error });
      throw new SeedKeyError(
        error.error || ERROR_CODES.SERVER_ERROR,
        error.message || 'Logout failed'
      );
    }
    
    log.info('Logout successful');
  }

  /**
   * Refresh token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    log.debug('POST /api/v1/seedkey/refresh');
    const response = await this.fetch('/api/v1/seedkey/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      log.error('Token refresh failed', { status: response.status, error });
      throw new SeedKeyError(
        error.error || ERROR_CODES.INVALID_TOKEN,
        error.message || 'Token refresh failed'
      );
    }

    const result = await response.json();
    log.info('Token refreshed', { expiresIn: result.expiresIn });
    return result;
  }

  /**
   * Base fetch with defaults
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    log.time(`fetch ${endpoint}`);
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      log.timeEnd(`fetch ${endpoint}`);
      log.debug(`${options.method || 'GET'} ${endpoint}`, { status: response.status, ok: response.ok });
      return response;
    } catch (error) {
      log.timeEnd(`fetch ${endpoint}`);
      log.error(`Network error: ${endpoint}`, error);
      throw new SeedKeyError(
        ERROR_CODES.NETWORK_ERROR,
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apiClientInstance: ApiClient | null = null;

export function getApiClient(baseUrl?: string): ApiClient {
  if (!apiClientInstance && baseUrl) {
    apiClientInstance = new ApiClient(baseUrl);
  }
  
  if (!apiClientInstance) {
    throw new Error('ApiClient not initialized. Call getApiClient with baseUrl first.');
  }
  
  return apiClientInstance;
}

/**
 * Reset singleton API client instance
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}
