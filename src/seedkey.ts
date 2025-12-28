/**
 * SeedKey Auth SDK
 * 
 *  COMMUNICATION:
 * - Events are versioned: 'seedkey:v1:request' / 'seedkey:v1:response'
 * 
 * 🔑 TWO USAGE MODES:
 * 
 * 1. Ready-to-use methods (REST API):
 *    - auth(), register(), authenticate() - full flow
 *    - getUser(), logout(), refreshToken() - session management
 * 
 * 2. Low-level methods (custom implementation):
 *    - checkExtension() - extension check
 *    - getPublicKey() - get public key
 *    - signChallenge() - sign challenge
 *    - signMessage() - sign an arbitrary message
 *    - requestChallenge() - request challenge from backend
 */

import {
  SeedKeyOptions,
  SeedKeyRequest,
  SeedKeyResponse,
  SeedKeyAction,
  AuthResult,
  AuthOptions,
  Challenge,
  ChallengeResponse,
  PublicKeyResult,
  SignChallengeResult,
  SignMessageResult,
  UserProfile,
  TokenInfo,
  ExtensionStatus,
  SeedKeyError,
  ERROR_CODES,
  EXTENSION_DOWNLOAD_URL,
  ExtensionNotFoundError,
  ExtensionNotConfiguredError,
} from './types';
import { sdkLogger as log, enableDebug } from './logger';
import { REQUEST_EVENT, RESPONSE_EVENT, SDK_VERSION } from './types';

/**
 * Get the request event name for the current SDK version
 */
export function getRequestEventName(): string {
  return REQUEST_EVENT;
}

/**
 * Get the response event name for the current SDK version
 */
export function getResponseEventName(): string {
  return RESPONSE_EVENT;
}

export class SeedKey {
  private backendUrl: string;
  private timeout: number;
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(options: SeedKeyOptions) {
    this.backendUrl = options.backendUrl;
    this.timeout = options.timeout || 60000;

    // Enable debug if specified in options
    if (options.debug) {
      enableDebug();
    }

    log.info(`SDK v${SDK_VERSION} initialized`, { backendUrl: this.backendUrl, timeout: this.timeout });

    // Listen for responses from the extension via CustomEvent
    if (typeof document !== 'undefined') {
      document.addEventListener(RESPONSE_EVENT, this.handleResponse as EventListener);
      log.debug('CustomEvent listener added:', RESPONSE_EVENT);
    }
  }

  /**
   * Cleanup resources on shutdown
   */
  destroy(): void {
    log.info('Destroying SDK', { pendingRequests: this.pendingRequests.size });
    if (typeof document !== 'undefined') {
      document.removeEventListener(RESPONSE_EVENT, this.handleResponse as EventListener);
    }
    // Cancel all pending requests
    for (const [requestId, { reject, timeoutId }] of this.pendingRequests) {
      clearTimeout(timeoutId);
      reject(new SeedKeyError(ERROR_CODES.TIMEOUT, 'SDK destroyed'));
      log.debug('Cancelled pending request', { requestId });
    }
    this.pendingRequests.clear();
  }

  // ============================================================================
  // Extension API - Status checks
  // ============================================================================

  /**
   * Check whether the extension is installed
   * → Extension: check_available
   */
  async isAvailable(): Promise<boolean> {
    log.debug('Checking extension availability...');
    try {
      const response = await this.sendToExtension('check_available', {}, 3000) as { available?: boolean };
      const available = response.available === true;
      log.info('Extension available:', available);
      return available;
    } catch (error) {
      log.warn('Extension not found', error);
      return false;
    }
  }

  /**
   * Check whether the extension is initialized (has an identity)
   * → Extension: is_initialized
   */
  async isInitialized(): Promise<boolean> {
    log.debug('Checking extension initialization...');
    try {
      const response = await this.sendToExtension('is_initialized', {}, 3000) as { initialized?: boolean };
      const initialized = response.initialized === true;
      log.info('Extension initialized:', initialized);
      return initialized;
    } catch (error) {
      log.warn('Initialization check error', error);
      return false;
    }
  }

  /**
   * Full extension check: installed + configured
   * 
   * @returns Extension status
   * @throws ExtensionNotFoundError - if the extension is not installed
   * @throws ExtensionNotConfiguredError - if the extension is not configured
   * 
   * @example
   * ```ts
   * try {
   *   const status = await sdk.checkExtension();
   *   console.log('Extension ready:', status);
   * } catch (error) {
   *   if (error instanceof ExtensionNotFoundError) {
   *     console.log('Install from:', error.downloadUrl);
   *   }
   * }
   * ```
   */
  async checkExtension(): Promise<ExtensionStatus> {
    log.debug('Full extension check...');
    
    // Check installation
    const installed = await this.isAvailable();
    if (!installed) {
      log.error('Extension is not installed');
      throw new ExtensionNotFoundError();
    }
    
    // Check configuration
    const initialized = await this.isInitialized();
    if (!initialized) {
      log.error('Extension is not configured');
      throw new ExtensionNotConfiguredError();
    }
    
    log.info('Extension is ready');
    return {
      installed: true,
      initialized: true,
    };
  }

  /**
   * Get extension status without throwing errors
   * 
   * @returns Extension status with downloadUrl if not installed
   */
  async getExtensionStatus(): Promise<ExtensionStatus> {
    log.debug('Getting extension status...');
    
    const installed = await this.isAvailable();
    if (!installed) {
      return {
        installed: false,
        initialized: false,
        downloadUrl: EXTENSION_DOWNLOAD_URL,
      };
    }
    
    const initialized = await this.isInitialized();
    return {
      installed: true,
      initialized,
    };
  }

  /**
   * Get extension download URL
   */
  getDownloadUrl(): string {
    return EXTENSION_DOWNLOAD_URL;
  }

  /**
   * Get public key for the current domain
   * → Extension: get_public_key
   */
  async getPublicKey(): Promise<string> {
    log.debug('Requesting public key...');
    const response = await this.sendToExtension('get_public_key', {
      domain: window.location.hostname
    }) as PublicKeyResult;
    
    log.info('Public key received', { publicKey: `${response.publicKey.slice(0, 16)}...` });
    return response.publicKey;
  }

  /**
   * Sign an arbitrary message
   * → Extension: sign_message
   */
  async signMessage(message: string): Promise<SignMessageResult> {
    log.debug('Requesting message signature...', { messageLength: message.length });
    const response = await this.sendToExtension('sign_message', {
      message,
      domain: window.location.hostname
    }) as SignMessageResult;
    
    log.info('Message signed', { signatureLength: response.signature.length });
    return response;
  }

  /**
   * Get SDK version
   */
  getVersion(): string {
    return SDK_VERSION;
  }

  // ============================================================================
  // Extension API - Low-level methods for custom authentication
  // ============================================================================

  /**
   * Sign challenge via Extension
   * 
   * Use this method for custom authentication implementation.
   * 
   * → Extension: sign_challenge
   * 
   * @param challenge - Challenge from backend
   * @returns Signature and public key
   * 
   * @example
   * ```ts
   * // Custom authentication
   * const publicKey = await sdk.getPublicKey();
   * const { challenge } = await sdk.requestChallenge(publicKey, 'authenticate');
   * const { signature } = await sdk.signChallenge(challenge);
   * // Send signature to your backend
   * ```
   */
  async signChallenge(challenge: Challenge): Promise<SignChallengeResult> {
    log.debug('Requesting challenge signature...', { action: challenge.action });
    const response = await this.sendToExtension('sign_challenge', {
      challenge,
      domain: window.location.hostname
    }) as SignChallengeResult;
    
    log.info('Challenge signed', { signatureLength: response.signature.length });
    return response;
  }

  // ============================================================================
  // HTTP API Methods 
  // ============================================================================

  /**
   * Register a new account
   * 
   * Flow:
   * 1. SDK → Extension: getPublicKey()
   * 2. SDK → Backend:   POST /challenge {publicKey, action: 'register'}
   * 3. SDK → Extension: signChallenge()
   * 4. SDK → Backend:   POST /register
   */
  async register(opts?: AuthOptions): Promise<AuthResult> {
    log.group('User registration');
    
    try {
      // Get public key from Extension
      log.info('Get public key from Extension');
      const publicKey = await this.getPublicKey();
      
      // Request challenge from backend
      log.info('Request challenge from backend');
      const { challenge } = await this.requestChallenge(publicKey, 'register');
      
      // Pass challenge to Extension for signing
      log.info('Sign challenge via Extension');
      const { signature } = await this.signChallenge(challenge);
      
      // Send registration request to backend
      log.info('Send registration request to backend');
      const result = await this.httpPost<AuthResult>('/api/v1/seedkey/register', {
        publicKey,
        challenge,
        signature,
        metadata: {
          deviceName: opts?.metadata?.deviceName || this.getDeviceName(),
          sdkVersion: SDK_VERSION
        }
      });
      
      log.info('Registration successful', { userId: result.user.id });
      log.groupEnd();
      
      return {
        ...result,
        action: 'register'
      };
    } catch (error) {
      log.error('Registration error', error);
      log.groupEnd();
      throw error;
    }
  }

  /**
   * Authenticate an existing account
   * 
   * Flow:
   * 1. SDK → Extension: getPublicKey()
   * 2. SDK → Backend:   POST /challenge {publicKey, action: 'authenticate'}
   * 3. SDK → Extension: signChallenge()
   * 4. SDK → Backend:   POST /verify
   */
  async authenticate(): Promise<AuthResult> {
    log.group('User authentication');
    
    try {
      // Get public key from Extension
      log.info('Get public key from Extension');
      const publicKey = await this.getPublicKey();
      
      // Request challenge from backend
      log.info('Request challenge from backend');
      const { challenge, challengeId } = await this.requestChallenge(publicKey, 'authenticate');
      
      // Pass challenge to Extension for signing
      log.info('Sign challenge via Extension');
      const { signature } = await this.signChallenge(challenge);
      
      // Send verification request to backend
      log.info('Send verification request to backend');
      const result = await this.httpPost<AuthResult>('/api/v1/seedkey/verify', {
        challengeId,
        challenge,
        signature,
        publicKey
      });
      
      log.info('Authentication successful', { userId: result.user.id });
      log.groupEnd();
      
      return {
        ...result,
        action: 'login'
      };
    } catch (error) {
      log.error('Authentication error', error);
      log.groupEnd();
      throw error;
    }
  }

  /**
   * Smart authentication: register if user doesn't exist, authenticate if user exists
   */
  async auth(opts?: AuthOptions): Promise<AuthResult> {
    log.info('Smart authentication (auth): try login; if user not found, register');
    try {
      return await this.authenticate();
    } catch (error) {
      if (error instanceof SeedKeyError && error.code === ERROR_CODES.USER_NOT_FOUND) {
        log.info('User not found, switching to registration');
        return await this.register(opts);
      }
      throw error;
    }
  }

  // ============================================================================
  // HTTP API Methods - Token management
  // ============================================================================

  /**
   * Get user information
   * → Backend: GET /api/v1/seedkey/user
   */
  async getUser(accessToken: string): Promise<UserProfile> {
    log.debug('Requesting user information...');
    const response = await this.httpGet<{ user: UserProfile }>('/api/v1/seedkey/user', {
      'Authorization': `Bearer ${accessToken}`
    });
    log.info('User information received', { userId: response.user.id });
    return response.user;
  }

  /**
   * Logout (invalidate token)
   * → Backend: POST /api/v1/seedkey/logout
   */
  async logout(accessToken: string): Promise<void> {
    log.debug('Logging out...');
    await this.httpPost<{ success: boolean }>('/api/v1/seedkey/logout', {}, {
      'Authorization': `Bearer ${accessToken}`
    });
    log.info('Logged out successfully');
  }

  /**
   * Refresh token
   * → Backend: POST /api/v1/seedkey/refresh
   */
  async refreshToken(refreshToken: string): Promise<TokenInfo> {
    log.debug('Refreshing token...');
    const result = await this.httpPost<TokenInfo>('/api/v1/seedkey/refresh', {
      refreshToken
    });
    log.info('Token refreshed', { expiresIn: result.expiresIn });
    return result;
  }

  /**
   * Request challenge from backend
   * 
   * Use this method for custom authentication implementation.
   * 
   * @param publicKey - Public key from getPublicKey()
   * @param action - Action: 'register' or 'authenticate'
   * @returns Challenge and its ID
   * 
   * @example
   * ```ts
   * // Custom authentication
   * const publicKey = await sdk.getPublicKey();
   * const { challenge, challengeId } = await sdk.requestChallenge(publicKey, 'authenticate');
   * const { signature } = await sdk.signChallenge(challenge);
   * // Send to your backend: { challengeId, signature, publicKey }
   * ```
   */
  async requestChallenge(publicKey: string, action: 'register' | 'authenticate'): Promise<ChallengeResponse> {
    log.debug('POST /api/v1/seedkey/challenge', { action });
    return await this.httpPost<ChallengeResponse>('/api/v1/seedkey/challenge', {
      publicKey,
      action
    });
  }

  // ============================================================================
  // HTTP Methods
  // ============================================================================

  private async httpGet<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    const url = `${this.backendUrl}${path}`;
    log.debug(`GET ${path}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        const error = new SeedKeyError(
          data.error || ERROR_CODES.SERVER_ERROR,
          data.message || 'Server error',
          data.hint
        );
        log.error(`HTTP Error ${response.status}`, { code: error.code, message: error.message });
        throw error;
      }
      
      log.debug(`GET ${path} succeeded`, { status: response.status });
      return data as T;
    } catch (error) {
      if (error instanceof SeedKeyError) {
        throw error;
      }
      log.error(`Network error: ${path}`, error);
      throw new SeedKeyError(
        ERROR_CODES.NETWORK_ERROR,
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async httpPost<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    const url = `${this.backendUrl}${path}`;
    log.debug(`POST ${path}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (!response.ok) {
        const error = new SeedKeyError(
          data.error || ERROR_CODES.SERVER_ERROR,
          data.message || 'Server error',
          data.hint
        );
        log.error(`HTTP Error ${response.status}`, { code: error.code, message: error.message });
        throw error;
      }
      
      log.debug(`POST ${path} succeeded`, { status: response.status });
      return data as T;
    } catch (error) {
      if (error instanceof SeedKeyError) {
        throw error;
      }
      log.error(`Network error: ${path}`, error);
      throw new SeedKeyError(
        ERROR_CODES.NETWORK_ERROR,
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // Extension Communication (CustomEvent)
  // ============================================================================

  private handleResponse = (event: Event): void => {
    const customEvent = event as CustomEvent<SeedKeyResponse>;
    const data = customEvent.detail;
    
    // Check message type
    if (!data || data.type !== 'SEEDKEY_RESPONSE') return;

    log.debug('← Response received from extension', { 
      requestId: data.requestId, 
      success: data.success,
      hasError: !!data.error 
    });

    const pending = this.pendingRequests.get(data.requestId);
    if (!pending) {
      log.warn('Received response for unknown request', { requestId: data.requestId });
      return;
    }

    // Clear timeout and remove from pending
    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(data.requestId);

    // Resolve promise
    if (data.success) {
      pending.resolve(data.result);
    } else {
      pending.reject(new SeedKeyError(
        data.error?.code || ERROR_CODES.SERVER_ERROR,
        data.error?.message || 'Extension error'
      ));
    }
  };

  private async sendToExtension(
    action: SeedKeyAction,
    payload: SeedKeyRequest['payload'],
    customTimeout?: number
  ): Promise<unknown> {
    const requestId = this.generateRequestId();
    const timeout = customTimeout || this.timeout;

    const request: SeedKeyRequest = {
      type: 'SEEDKEY_REQUEST',
      version: SDK_VERSION,
      action,
      requestId,
      origin: window.location.origin,
      payload,
    };

    log.debug('→ Sending request to extension', { action, requestId, timeout, version: SDK_VERSION });

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        log.error('Request timed out', { action, requestId, timeout });
        reject(new ExtensionNotFoundError(
          'Request timed out. Make sure SeedKey extension is installed.'
        ));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
      });

      // Dispatch via CustomEvent (visible to content script isolated world)
      const event = new CustomEvent(REQUEST_EVENT, {
        detail: request,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private getDeviceName(): string {
    const ua = navigator.userAgent;
    const browser = ua.includes('Chrome') ? 'Chrome' : 
                   ua.includes('Firefox') ? 'Firefox' : 
                   ua.includes('Safari') ? 'Safari' : 'Browser';
    const os = ua.includes('Windows') ? 'Windows' :
              ua.includes('Mac') ? 'macOS' :
              ua.includes('Linux') ? 'Linux' : 'Unknown';
    return `${browser} on ${os}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultInstance: SeedKey | null = null;

/**
 * Get or create singleton SDK instance
 */
export function getSeedKey(options?: SeedKeyOptions): SeedKey {
  if (!defaultInstance && options) {
    defaultInstance = new SeedKey(options);
  }
  
  if (!defaultInstance) {
    throw new Error('SeedKey SDK not initialized. Call getSeedKey with options first.');
  }
  
  return defaultInstance;
}

/**
 * Reset singleton instance
 */
export function resetSeedKey(): void {
  if (defaultInstance) {
    defaultInstance.destroy();
    defaultInstance = null;
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default SeedKey;
