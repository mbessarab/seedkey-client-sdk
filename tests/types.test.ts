import { describe, it, expect } from 'vitest';
import {
    SeedKeyError,
    ERROR_CODES,
    ExtensionNotFoundError,
    ExtensionNotConfiguredError,
    EXTENSION_DOWNLOAD_URL, SDK_VERSION,
} from '../src/types';

describe('SeedKeyError', () => {
  describe('constructor', () => {
    it('should create an error with code and message', () => {
      const error = new SeedKeyError('TEST_CODE', 'Test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SeedKeyError);
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('SeedKeyError');
      expect(error.hint).toBeUndefined();
    });

    it('should create an error with hint', () => {
      const error = new SeedKeyError('TEST_CODE', 'Test message', 'Test hint');

      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.hint).toBe('Test hint');
    });

    it('should work correctly with call stack', () => {
      const error = new SeedKeyError('TEST_CODE', 'Test message');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('SeedKeyError');
    });
  });

  describe('with codes from ERROR_CODES', () => {
    it('EXTENSION_NOT_FOUND', () => {
      const error = new SeedKeyError(
        ERROR_CODES.EXTENSION_NOT_FOUND,
        'Extension not installed'
      );

      expect(error.code).toBe('EXTENSION_NOT_FOUND');
    });

    it('NOT_INITIALIZED', () => {
      const error = new SeedKeyError(
        ERROR_CODES.NOT_INITIALIZED,
        'Identity not created'
      );

      expect(error.code).toBe('NOT_INITIALIZED');
    });

    it('USER_NOT_FOUND', () => {
      const error = new SeedKeyError(
        ERROR_CODES.USER_NOT_FOUND,
        'User does not exist',
        'Try registering first'
      );

      expect(error.code).toBe('USER_NOT_FOUND');
      expect(error.hint).toBe('Try registering first');
    });

    it('NETWORK_ERROR', () => {
      const error = new SeedKeyError(
        ERROR_CODES.NETWORK_ERROR,
        'Failed to connect'
      );

      expect(error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('throw and catch', () => {
    it('should be caught correctly', () => {
      const throwError = () => {
        throw new SeedKeyError(ERROR_CODES.TIMEOUT, 'Request timed out');
      };

      expect(throwError).toThrow(SeedKeyError);
      expect(throwError).toThrow('Request timed out');
    });

    it('can be checked with instanceof', () => {
      try {
        throw new SeedKeyError(ERROR_CODES.USER_REJECTED, 'User rejected');
      } catch (error) {
        expect(error instanceof SeedKeyError).toBe(true);
        expect(error instanceof Error).toBe(true);
        if (error instanceof SeedKeyError) {
          expect(error.code).toBe('USER_REJECTED');
        }
      }
    });
  });
});

describe('ERROR_CODES', () => {
  it('should contain all extension error codes', () => {
    expect(ERROR_CODES.EXTENSION_NOT_FOUND).toBe('EXTENSION_NOT_FOUND');
    expect(ERROR_CODES.NOT_INITIALIZED).toBe('NOT_INITIALIZED');
    expect(ERROR_CODES.EXTENSION_LOCKED).toBe('LOCKED');
    expect(ERROR_CODES.TIMEOUT).toBe('TIMEOUT');
  });

  it('should contain all user action codes', () => {
    expect(ERROR_CODES.USER_REJECTED).toBe('USER_REJECTED');
    expect(ERROR_CODES.BIOMETRIC_FAILED).toBe('BIOMETRIC_FAILED');
  });

  it('should contain all validation error codes', () => {
    expect(ERROR_CODES.DOMAIN_MISMATCH).toBe('DOMAIN_MISMATCH');
    expect(ERROR_CODES.INVALID_CHALLENGE).toBe('INVALID_CHALLENGE');
  });

  it('should contain all network error codes', () => {
    expect(ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ERROR_CODES.SERVER_ERROR).toBe('SERVER_ERROR');
  });

  it('should contain all challenge error codes', () => {
    expect(ERROR_CODES.CHALLENGE_EXPIRED).toBe('CHALLENGE_EXPIRED');
    expect(ERROR_CODES.NONCE_REUSED).toBe('NONCE_REUSED');
  });

  it('should contain all authentication error codes', () => {
    expect(ERROR_CODES.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
    expect(ERROR_CODES.USER_EXISTS).toBe('USER_EXISTS');
    expect(ERROR_CODES.INVALID_SIGNATURE).toBe('INVALID_SIGNATURE');
    expect(ERROR_CODES.INVALID_TOKEN).toBe('INVALID_TOKEN');
  });

  it('should be a readonly object', () => {
    // Ensure all values are strings
    const allValues = Object.values(ERROR_CODES);
    expect(allValues.every((v) => typeof v === 'string')).toBe(true);

    // Ensure code count (EXTENSION_NOT_CONFIGURED was added)
    expect(allValues.length).toBe(17);
  });

  it('should contain EXTENSION_NOT_CONFIGURED', () => {
    expect(ERROR_CODES.EXTENSION_NOT_CONFIGURED).toBe('EXTENSION_NOT_CONFIGURED');
  });
});

describe('ExtensionNotFoundError', () => {
  it('should be created with correct parameters', () => {
    const error = new ExtensionNotFoundError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SeedKeyError);
    expect(error).toBeInstanceOf(ExtensionNotFoundError);
    expect(error.name).toBe('ExtensionNotFoundError');
    expect(error.code).toBe(ERROR_CODES.EXTENSION_NOT_FOUND);
    expect(error.downloadUrl).toBe(EXTENSION_DOWNLOAD_URL);
    expect(error.hint).toBe('Install SeedKey browser extension');
  });

  it('should accept a custom message', () => {
    const error = new ExtensionNotFoundError('Custom message');

    expect(error.message).toBe('Custom message');
    expect(error.downloadUrl).toBe(EXTENSION_DOWNLOAD_URL);
  });
});

describe('ExtensionNotConfiguredError', () => {
  it('should be created with correct parameters', () => {
    const error = new ExtensionNotConfiguredError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SeedKeyError);
    expect(error).toBeInstanceOf(ExtensionNotConfiguredError);
    expect(error.name).toBe('ExtensionNotConfiguredError');
    expect(error.code).toBe(ERROR_CODES.EXTENSION_NOT_CONFIGURED);
    expect(error.hint).toBe('Open SeedKey extension and create your identity');
  });

  it('should accept a custom message', () => {
    const error = new ExtensionNotConfiguredError('Please configure');

    expect(error.message).toBe('Please configure');
  });
});

