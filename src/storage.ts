/**
 * Local token storage
 */

import { TokenInfo } from './types';
import { storageLogger as log } from './logger';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'seedkey_access_token',
  REFRESH_TOKEN: 'seedkey_refresh_token',
  EXPIRES_AT: 'seedkey_expires_at',
  USER_ID: 'seedkey_user_id',
} as const;

/**
 * Save tokens to localStorage
 */
export function saveTokens(tokens: TokenInfo, userId?: string): void {
  log.debug('Saving tokens...', { 
    hasAccessToken: !!tokens.accessToken,
    hasRefreshToken: !!tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    userId 
  });
  
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  
  const expiresAt = Date.now() + tokens.expiresIn * 1000;
  localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
  
  if (userId) {
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }
  
  log.info('Tokens saved', { expiresAt: new Date(expiresAt).toLocaleString() });
}

/**
 * Get access token
 */
export function getAccessToken(): string | null {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  log.debug('getAccessToken', { hasToken: !!token });
  return token;
}

/**
 * Get refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Get user ID
 */
export function getUserId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_ID);
}

/**
 * Check whether token is expired
 */
export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
  if (!expiresAt) {
    log.debug('isTokenExpired: no expiration time');
    return true;
  }
  
  // Consider expired 5 minutes before actual expiration
  const bufferMs = 5 * 60 * 1000;
  const expired = Date.now() > parseInt(expiresAt, 10) - bufferMs;
  const expiresDate = new Date(parseInt(expiresAt, 10));
  
  log.debug('isTokenExpired', { 
    expired, 
    expiresAt: expiresDate.toLocaleString(),
    remainingMs: parseInt(expiresAt, 10) - Date.now() - bufferMs
  });
  
  return expired;
}

/**
 * Check whether token exists
 */
export function hasToken(): boolean {
  return !!getAccessToken();
}

/**
 * Clear all tokens
 */
export function clearTokens(): void {
  log.info('Clearing tokens from localStorage');
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.USER_ID);
}

/**
 * Get full session data
 */
export function getSession(): {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  isExpired: boolean;
} {
  const session = {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
    userId: getUserId(),
    isExpired: isTokenExpired(),
  };
  
  log.debug('getSession', { 
    hasAccessToken: !!session.accessToken,
    hasRefreshToken: !!session.refreshToken,
    userId: session.userId,
    isExpired: session.isExpired
  });
  
  return session;
}
