# 🔐 SeedKey Client SDK

![license](https://img.shields.io/badge/license-MIT-blue)

SeedKey Client SDK — a client library for passwordless authentication via a browser extension, part of the SeedKey open-source ecosystem.

## Table of Contents

- [🔍 Interaction architecture](#-interaction-architecture)
- [🧩 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick start](#-quick-start)
- [🔧 SDK methods](#-sdk-methods)
- [🔌 Backend integration](#-backend-integration)
- [🤝 Contributing](#-contributing)
- [🛡️ Vulnerability disclosure](#-vulnerability-disclosure)
- [📄 License](#-license)

## 🔍 Interaction architecture

![SeedKey Architecture](doc/SeedKeyArchitecture.png)

## 🧩 Features

The SDK provides:

- **Extension communication** — get `publicKey`, sign a `challenge`, or sign custom messages.
- **High-level API** — a ready authentication flow with your backend via the REST contract `auth()` / `register()` / `authenticate()`.
- **Low-level API** — flexible customization: `getPublicKey()` / `signChallenge()` / `requestChallenge()`.
- **Token storage helpers** in `localStorage`.

Important: your **backend** must implement the REST API (see [Backend integration](#-backend-integration) below).

The SDK also provides tools to simplify authentication integration into your service:

- **Protocol types** — interfaces for `Challenge`, `User`, `Token`, `Session`.
- **Cryptographic utilities** — Ed25519 signature verification.
- **Authentication services** — `AuthService` and `KeyService`.
- **Storage abstractions** — adapter interfaces for databases.
- **Error types** — `SeedKeyError` + `ERROR_CODES`.

## 📦 Installation

```bash
npm install @seedkey/sdk-client
```

```bash
yarn add @seedkey/sdk-client
```

```bash
pnpm add @seedkey/sdk-client
```

## 🚀 Quick start

```ts
import { getSeedKey, saveTokens, SeedKeyError } from '@seedkey/sdk-client';

// SDK initialization
const sdk = getSeedKey({
  backendUrl: 'https://api.example.com',
  timeout: 60000,
  debug: true, 
});

// Check extension availability
const available = await sdk.isAvailable();
if (!available) {
  console.log('Install the SeedKey extension');
  return;
}

// Check extension initialization (identity exists)
const initialized = await sdk.isInitialized();
if (!initialized) {
  console.log('Create an Identity in the SeedKey extension');
  return;
}

// Authentication (auto-register if user is new)
try {
  const result = await sdk.auth();
  console.log('User ID:', result.user.id);
  console.log('Access Token:', result.token.accessToken);

  // Save tokens to localStorage
  saveTokens(result.token, result.user.id);
} catch (error) {
  if (error instanceof SeedKeyError) {
    console.error('Code:', error.code, 'Message:', error.message);
  }
}
```

Token handling:

```ts
import {
  saveTokens,
  getAccessToken,
  getRefreshToken,
  getUserId,
  isTokenExpired,
  hasToken,
  clearTokens,
  getSession,
  getSeedKey,
} from '@seedkey/sdk-client';

const sdk = getSeedKey();

// Get access token
const token = getAccessToken();

// Check token expiration
if (isTokenExpired()) {
  const newTokens = await sdk.refreshToken(getRefreshToken()!);
  saveTokens(newTokens, getUserId() ?? undefined);
}

// Get full session
const session = getSession();
// { accessToken, refreshToken, userId, isExpired }

// Clear on logout
clearTokens();
```

Error handling:

```ts
import { getSeedKey, SeedKeyError, ERROR_CODES } from '@seedkey/sdk-client';

const sdk = getSeedKey();

try {
  await sdk.auth();
} catch (error) {
  if (error instanceof SeedKeyError) {
    switch (error.code) {
      // Extension errors
      case ERROR_CODES.EXTENSION_NOT_FOUND:
        // Extension is not installed
        break;
      case ERROR_CODES.NOT_INITIALIZED:
        // Identity is not configured
        break;
      case ERROR_CODES.EXTENSION_LOCKED:
        // Extension is locked
        break;
      case ERROR_CODES.TIMEOUT:
        // Operation timeout
        break;

      // User actions
      case ERROR_CODES.USER_REJECTED:
        // User rejected the request
        break;

      // Network errors
      case ERROR_CODES.NETWORK_ERROR:
        // Network error
        break;
      case ERROR_CODES.SERVER_ERROR:
        // Server error
        break;

      // Auth errors
      case ERROR_CODES.USER_NOT_FOUND:
        // User not found
        break;
      case ERROR_CODES.USER_EXISTS:
        // User already exists
        break;
      case ERROR_CODES.INVALID_SIGNATURE:
        // Invalid signature
        break;
      case ERROR_CODES.INVALID_TOKEN:
        // Invalid token
        break;
    }

    console.log('Code:', error.code);
    console.log('Message:', error.message);
    console.log('Hint:', error.hint);
  }
}
```

You can rely on the SDK and let it handle the routine for you, or implement the logic yourself using the library’s low-level API.

In the basic variant, the authentication flow looks like this:

1. Extension: `sdk.getPublicKey()`
2. Backend: `POST /api/v1/seedkey/challenge` `{ publicKey, action: "authenticate" }`
3. Extension: `sdk.signChallenge()`
4. Backend: `POST /api/v1/seedkey/verify` `{ challengeId, challenge, signature, publicKey }`

Registration flow:

1. Extension: `sdk.getPublicKey()`
2. Backend: `POST /api/v1/seedkey/challenge` `{ publicKey, action: "register" }`
3. Extension: `sdk.signChallenge()`
4. Backend: `POST /api/v1/seedkey/register` `{ publicKey, challenge, signature, metadata }`

## 🔧 SDK methods

| Method | Description | Returns |
|:--|:--|:--|
| `isAvailable()` | Check if the extension is installed | `Promise<boolean>` |
| `isInitialized()` | Check if the extension is initialized | `Promise<boolean>` |
| `getPublicKey()` | Get the public key for the current domain | `Promise<string>` |
| `signMessage(message)` | Sign a message (optional) | `Promise<SignMessageResult>` |
| `signChallenge(challenge: Challenge)` | Sign a `Challenge` | `Promise<SignChallengeResult>` |
| `register(opts?)` | Register a new account | `Promise<AuthResult>` |
| `authenticate()` | Authenticate an existing account | `Promise<AuthResult>` |
| `auth(opts?)` | Smart auth (register/login) | `Promise<AuthResult>` |
| `getUser(accessToken)` | Get the current user profile | `Promise<UserProfile>` |
| `logout(accessToken)` | Logout (invalidate access token) | `Promise<void>` |
| `refreshToken(refreshToken)` | Refresh token pair | `Promise<TokenInfo>` |
| `getVersion()` | Get SDK version | `string` |
| `destroy()` | Cleanup resources | `void` |

Important: your **backend** must support the request/response types sent by the SDK and/or implement full endpoints — depending on your chosen integration.

REST API used by the SDK:

| Route | Method | Purpose | Request (JSON / headers) | Response |
|:--|:--|:--|:--|:--|
| `/api/v1/seedkey/challenge` | `POST` | Get a challenge to sign in the extension | Body: `{ publicKey, action: "register" \| "authenticate" }` | `ChallengeResponse` |
| `/api/v1/seedkey/register` | `POST` | Create a new user by signed challenge | Body: `{ publicKey, challenge, signature, metadata }` | `AuthResult` |
| `/api/v1/seedkey/verify` | `POST` | Verify challenge signature and issue tokens | Body: `{ challengeId, challenge, signature, publicKey }` | `AuthResult` |
| `/api/v1/seedkey/user` | `GET` | Get current user profile | Header: `Authorization: Bearer <accessToken>` | `{ user: UserProfile }` |
| `/api/v1/seedkey/logout` | `POST` | Invalidate session | Header: `Authorization: Bearer <accessToken>`; Body: `{}` (or empty) | `{ success: boolean }` |
| `/api/v1/seedkey/refresh` | `POST` | Refresh token pair using refresh token | Body: `{ refreshToken }` | `TokenInfo` / `{ accessToken, refreshToken, expiresIn }` |

## 🔌 Backend integration

For efficient integration with your backend:

- use `seedkey-sdk-server` — a library to implement the authentication mechanism yourself;
- or deploy the ready self-hosted service `seedkey-auth-service`.

### 🔧 Related Projects
Also check out other repositories in the ecosystem:
- [seedkey-browser-extension](https://github.com/mbessarab/seedkey-browser-extension) — browser extension.
- [seedkey-db-migrations](https://github.com/mbessarab/seedkey-db-migrations) — migrations for `seedkey-auth-service`.
- [seedkey-auth-service](https://github.com/mbessarab/seedkey-auth-service) — self-hosted authentication service.
- [seedkey-server-sdk](https://github.com/mbessarab/seedkey-server-sdk) — server-side library for implementing the service yourself.
- [seedkey-auth-service-helm-chart](https://github.com/mbessarab/seedkey-auth-service-helm-chart) — Helm chart for deploying `seedkey-auth-service` + migrations.

## 🤝 Contributing

If you have ideas and want to contribute — feel free to open an issue or a pull request.

## 🛡️ Vulnerability disclosure

Please **do not publish** vulnerabilities in public issues. Report them privately via `maks@besssarab.ru` or open a private security advisory on GitHub.

## 📄 License

See `LICENSE`.