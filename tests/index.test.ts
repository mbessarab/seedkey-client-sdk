/**
 * Tests for index.ts
 *
 * Ensure all exports are available
 */

import { describe, it, expect } from 'vitest';
import * as sdk from '../src/index';

describe('SDK exports', () => {
  describe('SeedKey class and functions', () => {
    it('should export SeedKey class', () => {
      expect(sdk.SeedKey).toBeDefined();
      expect(typeof sdk.SeedKey).toBe('function');
    });

    it('should export getSeedKey function', () => {
      expect(sdk.getSeedKey).toBeDefined();
      expect(typeof sdk.getSeedKey).toBe('function');
    });

    it('should export resetSeedKey function', () => {
      expect(sdk.resetSeedKey).toBeDefined();
      expect(typeof sdk.resetSeedKey).toBe('function');
    });
  });

  describe('ApiClient', () => {
    it('should export ApiClient class', () => {
      expect(sdk.ApiClient).toBeDefined();
      expect(typeof sdk.ApiClient).toBe('function');
    });

    it('should export getApiClient function', () => {
      expect(sdk.getApiClient).toBeDefined();
      expect(typeof sdk.getApiClient).toBe('function');
    });

    it('should export resetApiClient function', () => {
      expect(sdk.resetApiClient).toBeDefined();
      expect(typeof sdk.resetApiClient).toBe('function');
    });
  });

  describe('Storage functions', () => {
    it('should export saveTokens', () => {
      expect(sdk.saveTokens).toBeDefined();
      expect(typeof sdk.saveTokens).toBe('function');
    });

    it('should export clearTokens', () => {
      expect(sdk.clearTokens).toBeDefined();
      expect(typeof sdk.clearTokens).toBe('function');
    });

    it('should export getAccessToken', () => {
      expect(sdk.getAccessToken).toBeDefined();
      expect(typeof sdk.getAccessToken).toBe('function');
    });

    it('should export getRefreshToken', () => {
      expect(sdk.getRefreshToken).toBeDefined();
      expect(typeof sdk.getRefreshToken).toBe('function');
    });

    it('should export getUserId', () => {
      expect(sdk.getUserId).toBeDefined();
      expect(typeof sdk.getUserId).toBe('function');
    });

    it('should export isTokenExpired', () => {
      expect(sdk.isTokenExpired).toBeDefined();
      expect(typeof sdk.isTokenExpired).toBe('function');
    });

    it('should export hasToken', () => {
      expect(sdk.hasToken).toBeDefined();
      expect(typeof sdk.hasToken).toBe('function');
    });

    it('should export getSession', () => {
      expect(sdk.getSession).toBeDefined();
      expect(typeof sdk.getSession).toBe('function');
    });
  });

  describe('Logger functions', () => {
    it('should export createLogger', () => {
      expect(sdk.createLogger).toBeDefined();
      expect(typeof sdk.createLogger).toBe('function');
    });

    it('should export enableDebug', () => {
      expect(sdk.enableDebug).toBeDefined();
      expect(typeof sdk.enableDebug).toBe('function');
    });

    it('should export disableDebug', () => {
      expect(sdk.disableDebug).toBeDefined();
      expect(typeof sdk.disableDebug).toBe('function');
    });

    it('should export pre-created loggers', () => {
      expect(sdk.sdkLogger).toBeDefined();
      expect(sdk.authLogger).toBeDefined();
      expect(sdk.apiLogger).toBeDefined();
      expect(sdk.storageLogger).toBeDefined();
      expect(sdk.uiLogger).toBeDefined();
    });
  });

  describe('Errors & Constants', () => {
    it('should export SeedKeyError class', () => {
      expect(sdk.SeedKeyError).toBeDefined();
      expect(typeof sdk.SeedKeyError).toBe('function');
    });

    it('should export ExtensionNotFoundError class', () => {
      expect(sdk.ExtensionNotFoundError).toBeDefined();
      expect(typeof sdk.ExtensionNotFoundError).toBe('function');
    });

    it('should export ExtensionNotConfiguredError class', () => {
      expect(sdk.ExtensionNotConfiguredError).toBeDefined();
      expect(typeof sdk.ExtensionNotConfiguredError).toBe('function');
    });

    it('should export ERROR_CODES', () => {
      expect(sdk.ERROR_CODES).toBeDefined();
      expect(typeof sdk.ERROR_CODES).toBe('object');
    });

    it('ERROR_CODES should contain all codes', () => {
      expect(sdk.ERROR_CODES.EXTENSION_NOT_FOUND).toBeDefined();
      expect(sdk.ERROR_CODES.EXTENSION_NOT_CONFIGURED).toBeDefined();
      expect(sdk.ERROR_CODES.NOT_INITIALIZED).toBeDefined();
      expect(sdk.ERROR_CODES.TIMEOUT).toBeDefined();
      expect(sdk.ERROR_CODES.USER_NOT_FOUND).toBeDefined();
      expect(sdk.ERROR_CODES.NETWORK_ERROR).toBeDefined();
    });

    it('should export EXTENSION_DOWNLOAD_URL', () => {
      expect(sdk.EXTENSION_DOWNLOAD_URL).toBeDefined();
      expect(typeof sdk.EXTENSION_DOWNLOAD_URL).toBe('string');
    });
  });

  describe('Event name functions', () => {
    it('should export getRequestEventName', () => {
      expect(sdk.getRequestEventName).toBeDefined();
      expect(typeof sdk.getRequestEventName).toBe('function');
      expect(sdk.getRequestEventName()).toBe('seedkey:v1:request');
    });

    it('should export getResponseEventName', () => {
      expect(sdk.getResponseEventName).toBeDefined();
      expect(typeof sdk.getResponseEventName).toBe('function');
      expect(sdk.getResponseEventName()).toBe('seedkey:v1:response');
    });
  });

  describe('instance creation', () => {
    it('can create SeedKey instance', () => {
      const instance = new sdk.SeedKey({
        backendUrl: 'https://api.example.com',
      });

      expect(instance).toBeDefined();
      expect(instance.getVersion()).toBe('0.0.1');

      instance.destroy();
    });

    it('can create ApiClient instance', () => {
      const client = new sdk.ApiClient('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('can create Logger', () => {
      const logger = sdk.createLogger('TestModule');

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('can create SeedKeyError', () => {
      const error = new sdk.SeedKeyError(
        sdk.ERROR_CODES.USER_NOT_FOUND,
        'User not found',
        'Try registering first'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('USER_NOT_FOUND');
      expect(error.message).toBe('User not found');
      expect(error.hint).toBe('Try registering first');
    });
  });
});
