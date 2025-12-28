/**
 * SeedKey Auth SDK
 * 
 * Client library for authentication via the SeedKey browser extension
 * 
 * ## Two usage modes
 * 
 * ### 1. Ready-to-use methods (REST API) - recommended
 * 
 * @example
 * ```ts
 * import { SeedKey, getSeedKey } from '@seedkey/sdk-client';
 * 
 * const sdk = getSeedKey({ backendUrl: 'http://localhost:3000', debug: true });
 * 
 * // Extension check
 * const status = await sdk.getExtensionStatus();
 * if (!status.installed) {
 *   console.log('Install extension:', status.downloadUrl);
 *   return;
 * }
 * 
 * // Full authentication (register if user doesn't exist)
 * const result = await sdk.auth();
 * console.log('User ID:', result.user.id);
 * ```
 * 
 * ### 2. Low-level methods for custom authentication
 * 
 * @example
 * ```ts
 * const sdk = getSeedKey({ backendUrl: 'http://localhost:3000' });
 * 
 * // Extension check (throws if there are issues)
 * await sdk.checkExtension();
 * 
 * // Custom flow
 * const publicKey = await sdk.getPublicKey();
 * const { challenge, challengeId } = await sdk.requestChallenge(publicKey, 'authenticate');
 * const { signature } = await sdk.signChallenge(challenge);
 * 
 * // Send to your backend
 * await fetch('/my-api/verify', {
 *   method: 'POST',
 *   body: JSON.stringify({ challengeId, signature, publicKey })
 * });
 * ```
 */

// SDK
export {
  SeedKey,
  getSeedKey,
  resetSeedKey,
  getRequestEventName,
  getResponseEventName,
} from './seedkey';

// API Client
export { ApiClient, getApiClient, resetApiClient } from './api';

// Storage
export {
  saveTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getUserId,
  isTokenExpired,
  hasToken,
  getSession,
} from './storage';

// Logger
export {
  createLogger,
  enableDebug,
  disableDebug,
  sdkLogger,
  authLogger,
  apiLogger,
  storageLogger,
  uiLogger,
} from './logger';

// Types - export all types
export type {
  Challenge,
  TokenInfo,
  UserInfo,
  AuthResult,
  PublicKeyInfo,
  UserProfile,
  SeedKeyOptions,
  AuthOptions,
  SeedKeyAction,
  SeedKeyRequest,
  SeedKeyResponse,
  PublicKeyResult,
  SignChallengeResult,
  SignMessageResult,
  ChallengeResponse,
  RegisterRequest,
  VerifyRequest,
  ErrorCode,
  ExtensionStatus,
} from './types';

// Errors & Constants
export {
  SeedKeyError,
  ExtensionNotFoundError,
  ExtensionNotConfiguredError,
  ERROR_CODES,
  EXTENSION_DOWNLOAD_URL,
  SDK_VERSION,
  REQUEST_EVENT,
  RESPONSE_EVENT, 
} from './types';
