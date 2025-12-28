// ============================================================================
// SDK Version & Constants
// ============================================================================

export const SDK_VERSION = '0.0.1';

/** Extension download URL */
export const EXTENSION_DOWNLOAD_URL = '';

// Event names for communication with content script (versioned)
export const REQUEST_EVENT = `seedkey:v1:request`;
export const RESPONSE_EVENT = `seedkey:v1:response`;

// ============================================================================
// Extension Status
// ============================================================================

export interface ExtensionStatus {
  /** Extension is installed */
  installed: boolean;
  /** Extension is configured (has an identity) */
  initialized: boolean;
  /** Download URL if not installed */
  downloadUrl?: string;
}

// ============================================================================
// Challenge-Response
// ============================================================================

export interface Challenge {
  nonce: string;
  timestamp: number;
  domain: string;
  action: 'register' | 'authenticate';
  expiresAt: number;
}

// ============================================================================
// API Responses
// ============================================================================

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInfo {
  id: string;
  publicKey: string;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthResult {
  success: boolean;
  action: 'login' | 'register';
  user: UserInfo;
  token: TokenInfo;
}

export interface PublicKeyInfo {
  id: string;
  publicKey: string;
  deviceName?: string;
  addedAt: number;
  lastUsed: number;
}

export interface UserProfile {
  id: string;
  publicKey: PublicKeyInfo;
  createdAt: number;
}

// ============================================================================
// SDK Options
// ============================================================================

export interface SeedKeyOptions {
  /** Backend URL for authentication */
  backendUrl: string;
  /** Operation timeout (ms), default: 60000 */
  timeout?: number;
  /** Callback when authorization is required */
  onAuthRequired?: () => void;
  /** Enable debug logging */
  debug?: boolean;
}

export interface AuthOptions {
  /** Device metadata */
  metadata?: {
    deviceName?: string;
  };
}

// ============================================================================
// Extension API Actions
// ============================================================================

/**
 * Extension API actions
 */
export type SeedKeyAction = 
  | 'check_available'      // Check whether extension is installed
  | 'is_initialized'       // Check whether identity is initialized
  | 'get_public_key'       // Get public key for domain
  | 'sign_challenge'       // Sign challenge
  | 'sign_message';        // Sign an arbitrary message

export interface SeedKeyRequest {
  type: 'SEEDKEY_REQUEST';
  version: string;
  action: SeedKeyAction;
  requestId: string;
  origin: string;
  payload?: {
    domain?: string;
    challenge?: Challenge;
    message?: string;
  };
}

export interface SeedKeyResponse {
  type: 'SEEDKEY_RESPONSE';
  version: string;
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Extension Response Types
// ============================================================================

export interface PublicKeyResult {
  publicKey: string;
  domain: string;
}

export interface SignChallengeResult {
  signature: string;
  publicKey: string;
}

export interface SignMessageResult {
  signature: string;
  publicKey: string;
  message: string;
}

// ============================================================================
// Backend API Types
// ============================================================================

export interface ChallengeResponse {
  challenge: Challenge;
  challengeId: string;
}

export interface RegisterRequest {
  publicKey: string;
  challenge: Challenge;
  signature: string;
  metadata?: {
    deviceName?: string;
    extensionVersion?: string;
  };
}

export interface VerifyRequest {
  challengeId: string;
  challenge: Challenge;
  signature: string;
  publicKey: string;
}

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  // Extension errors
  EXTENSION_NOT_FOUND: 'EXTENSION_NOT_FOUND',
  EXTENSION_NOT_CONFIGURED: 'EXTENSION_NOT_CONFIGURED',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  EXTENSION_LOCKED: 'LOCKED',
  TIMEOUT: 'TIMEOUT',
  
  // User actions
  USER_REJECTED: 'USER_REJECTED',
  BIOMETRIC_FAILED: 'BIOMETRIC_FAILED',
  
  // Validation errors (in Extension)
  DOMAIN_MISMATCH: 'DOMAIN_MISMATCH',
  INVALID_CHALLENGE: 'INVALID_CHALLENGE',
  
  // Server/Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Challenge errors
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',
  NONCE_REUSED: 'NONCE_REUSED',
  
  // Auth errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_EXISTS: 'USER_EXISTS',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_TOKEN: 'INVALID_TOKEN',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ============================================================================
// Errors
// ============================================================================

export class SeedKeyError extends Error {
  constructor(
    public code: string,
    message: string,
    public hint?: string,
    /** Extension download URL (for EXTENSION_NOT_FOUND) */
    public downloadUrl?: string
  ) {
    super(message);
    this.name = 'SeedKeyError';
  }
}

/**
 * Extension missing error
 */
export class ExtensionNotFoundError extends SeedKeyError {
  constructor(message = 'SeedKey extension not found. Please install it.') {
    super(
      ERROR_CODES.EXTENSION_NOT_FOUND,
      message,
      'Install SeedKey browser extension',
      EXTENSION_DOWNLOAD_URL
    );
    this.name = 'ExtensionNotFoundError';
  }
}

/**
 * Extension not configured error
 */
export class ExtensionNotConfiguredError extends SeedKeyError {
  constructor(message = 'SeedKey extension is not configured. Please set up your identity.') {
    super(
      ERROR_CODES.EXTENSION_NOT_CONFIGURED,
      message,
      'Open SeedKey extension and create your identity'
    );
    this.name = 'ExtensionNotConfiguredError';
  }
}
