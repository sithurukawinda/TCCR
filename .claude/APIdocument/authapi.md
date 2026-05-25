# TCCR — Auth API Reference
## The Christian Center Rathmalana · `auth-service`
### Base URL: `http://localhost:3000/api/v1` (local) · `https://api.tccr.lk/api/v1` (production)

**Version:** 1.0.0  
**Date:** 25 May 2026  
**Service Port:** `:3001` (proxied via gateway `:3000`)  
**Organisation:** Future CX Lanka (Pvt) Ltd

---

## Overview

The auth-service handles all authentication and identity operations for TCCR. It sits behind the gateway at `/api/v1/auth/*`.

**Login is client-side** — there is no `POST /auth/login` endpoint. Clients sign in directly with the Firebase SDK and receive a Firebase ID token. The backend only verifies tokens via `authenticate()` middleware.

### Authentication Header
```
Authorization: Bearer <firebase-id-token>
```
Firebase ID tokens expire after **1 hour**. Always call `user.getIdToken()` before each request.

### Email-Verification Gate
After registration, **all protected endpoints** return `403 EMAIL_NOT_VERIFIED` until the user submits their OTP via `POST /auth/verify-email`. Federated users (Google/Apple) are exempt — Firebase marks them as verified automatically.

---

## Endpoint Summary

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | POST | `/auth/register` | Public | Register new member account |
| 2 | POST | `/auth/federated/google` | Public | Sign in / register with Google |
| 3 | POST | `/auth/federated/apple` | Public | Sign in / register with Apple (mobile SDK) |
| 4 | POST | `/auth/logout` | Bearer | Revoke all refresh tokens |
| 5 | POST | `/auth/password-reset` | Public | Request 6-digit OTP for password reset |
| 6 | POST | `/auth/password-reset/verify` | Public | Verify OTP → dispatch Firebase reset email |
| 7 | POST | `/auth/track-failure` | Public | Record failed login attempt (lockout tracking) |
| 8 | POST | `/auth/resend-verification` | Public | Resend email verification OTP |
| 9 | POST | `/auth/verify-email` | Public | Verify email with OTP |
| 10 | GET | `/auth/apple/init` | Public | Apple Web OAuth — Step 1 (get state + auth URL) |
| 11 | POST | `/auth/apple/callback` | Public | Apple Web OAuth — Step 2 (exchange code) |
| 12 | POST | `/auth/apple/refresh` | Bearer | Apple Web OAuth — Validate stored session |
| 13 | POST | `/auth/apple/revoke` | Bearer | Apple Web OAuth — Revoke tokens (account deletion) |

---

## 1. `POST /auth/register`

Register a new account. Creates an **active Member** immediately — no admin approval needed.

**Authentication:** None (public)  
**Content-Type:** `application/json`

### Request Body

```json
{
  "firstName":         "Sithuru",
  "lastName":          "Kawinda",
  "email":             "sithuru@example.com",
  "password":          "SecurePass1@",
  "preferredLanguage": "en"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `firstName` | string | ✅ | 1–100 chars |
| `lastName` | string | ✅ | 1–100 chars |
| `email` | string | ✅ | Valid RFC-5322 email · must be unique |
| `password` | string | ✅ | Min 10 chars · ≥1 uppercase · ≥1 lowercase · ≥1 digit · ≥1 special char |
| `preferredLanguage` | string | ❌ | `"en"` \| `"si"` \| `"ta"` — defaults to `"en"` |

### Side Effects

| Step | What happens |
|------|-------------|
| 1 | Firebase Auth account created |
| 2 | Firebase custom claims set: `{ role: "member", roles: ["member"] }` |
| 3 | Firestore user doc created: `status: "approved"`, `roles: ["member"]` |
| 4 | Welcome email sent to registrant (email + temp password + login link) |
| 5 | In-app notification sent to all admins: *"New Member Joined"* |

### Responses

**`201 Created`**
```json
{
  "uid": "Xf3aBC123xyz",
  "message": "Registration successful. You are now an active member."
}
```

**`400 Bad Request`** — Validation failure
```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "password: Password must be at least 10 characters." },
  "requestId": "7f3a1c2d-..."
}
```

| Rule violated | Error message |
|--------------|--------------|
| `firstName` empty | `firstName: Required` |
| `lastName` empty | `lastName: Required` |
| Invalid email format | `email: Invalid email` |
| Password < 10 chars | `password: Password must be at least 10 characters.` |
| No uppercase letter | `password: Password must contain an uppercase letter.` |
| No lowercase letter | `password: Password must contain a lowercase letter.` |
| No digit | `password: Password must contain a number.` |
| No special character | `password: Password must contain a special character.` |
| Invalid language | `preferredLanguage: Invalid enum value` |

**`409 Conflict`** — Email already registered
```json
{
  "error": { "code": "EMAIL_EXISTS", "message": "Email address already registered." },
  "requestId": "7f3a1c2d-..."
}
```

**`422 Unprocessable Entity`** — Disposable or unreachable email domain
```json
{
  "error": { "code": "DISPOSABLE_EMAIL", "message": "Disposable email addresses are not allowed." },
  "requestId": "7f3a1c2d-..."
}
```

> **Pre-registration email check:** Before any Firebase call, the system validates MX DNS records and checks a disposable domain blocklist. Fake/disposable emails never enter Firebase Auth.

---

## 2. `POST /auth/federated/google`

Sign in or register using a Google ID token. If the email is new, an active Member account is created automatically. The Google token is **never stored** — only the resulting Firebase session is kept.

**Authentication:** None (public)  
**Content-Type:** `application/json`

### Request Body

```json
{
  "idToken":           "<google-id-token>",
  "preferredLanguage": "en"
}
```

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `idToken` | string | ✅ | Google ID token from the client SDK |
| `preferredLanguage` | string | ❌ | `"en"` \| `"si"` \| `"ta"` — only used when creating a new account |

### Responses

**`200 OK`**
```json
{
  "firebaseToken": "<firebase-custom-token>",
  "uid": "Xf3aBC123xyz",
  "isNewUser": false
}
```

> Client exchanges `firebaseToken` via `signInWithCustomToken()` to get a proper Firebase ID token.

**`401 Unauthorized`**
```json
{
  "error": { "code": "FEDERATED_TOKEN_INVALID", "message": "Google token is invalid or expired." },
  "requestId": "7f3a1c2d-..."
}
```

> **Emulator testing:** When `FIREBASE_AUTH_EMULATOR_HOST` is set (non-production), pass a base64-encoded JSON payload instead of a real token:
> ```
> base64({ "email": "test@example.com", "sub": "uid123", "name": "Test User" })
> ```

---

## 3. `POST /auth/federated/apple`

Sign in or register using an Apple identity token (mobile SDK flow). Same semantics as Google. The Apple token is **never stored**.

**Authentication:** None (public)  
**Content-Type:** `application/json`

### Request Body

```json
{
  "idToken":           "<apple-identity-token>",
  "preferredLanguage": "en"
}
```

### Responses

**`200 OK`** — Same shape as `POST /auth/federated/google`:
```json
{
  "firebaseToken": "<firebase-custom-token>",
  "uid": "Xf3aBC123xyz",
  "isNewUser": true
}
```

**`401 Unauthorized`** → `FEDERATED_TOKEN_INVALID`

> **Private relay email:** When a user hides their email via Apple, the system synthesises `{sub}@privaterelay.appleid.com` as the email address. This is stored and treated as any other email.

> **Web OAuth flow:** For browser-based Apple sign-in use `GET /auth/apple/init` + `POST /auth/apple/callback` (endpoints 10–11 below) instead.

---

## 4. `POST /auth/logout`

Revoke all Firebase refresh tokens for the authenticated user. The user is signed out on all devices.

**Authentication:** Bearer required | **Roles:** Any (including unverified email)  
**Content-Type:** None

### Responses

**`204 No Content`** — Logged out successfully.

**`401 Unauthorized`** — Token missing, expired, or already revoked.

---

## 5. `POST /auth/password-reset`

Request a 6-digit OTP for password reset. The OTP is valid for **15 minutes** and sent to the registered email address.

**Always returns `204`** regardless of whether the email exists — prevents email enumeration.

**Authentication:** None (public)  
**Content-Type:** `application/json`

### Request Body

```json
{ "email": "sithuru@example.com" }
```

### Responses

**`204 No Content`** — OTP sent (or email not found — silent).

**`400 Bad Request`** — Invalid email format
```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "email: Invalid email" },
  "requestId": "7f3a1c2d-..."
}
```

> **SMTP required:** OTPs are only emailed when `SMTP_HOST` is configured in `.env`. Without SMTP, the OTP is stored in Firestore but not delivered. Check `passwordResetOtps` collection in the emulator to retrieve it during development.

---

## 6. `POST /auth/password-reset/verify`

Verify the 6-digit OTP from Step 5 and dispatch a Firebase password-reset email to the user.

**Authentication:** None (public)  
**Content-Type:** `application/json`

### Request Body

```json
{
  "email": "sithuru@example.com",
  "otp":   "482910"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `email` | string | ✅ | Valid RFC-5322 email |
| `otp` | string | ✅ | Exactly 6 digits |

### Responses

**`204 No Content`** — OTP verified; Firebase password-reset email dispatched.

**`400 Bad Request`**

| Code | Meaning |
|------|---------|
| `INVALID_OTP` | Wrong code — response includes `{ "remainingAttempts": 3 }` |
| `OTP_EXPIRED` | Code has expired — call `POST /auth/password-reset` again |
| `OTP_MAX_ATTEMPTS` | 5 failed attempts — OTP deleted, request a new one |

```json
{
  "error": { "code": "INVALID_OTP", "message": "Invalid OTP. 3 attempts remaining." },
  "requestId": "7f3a1c2d-..."
}
```

---

## 7. `POST /auth/track-failure`

Record a failed login attempt for account lockout tracking. Call this **client-side** after every failed Firebase sign-in.

After **10 consecutive failures within 15 minutes**, the account is locked. Further attempts return `{ "locked": true }` and the user receives a lock notification. Locks clear automatically after the 15-minute window expires.

**Authentication:** None (public)  
**Content-Type:** `application/json`

### Request Body

```json
{ "email": "sithuru@example.com" }
```

### Responses

**`200 OK`** — Attempt recorded.
```json
{ "locked": false, "attempts": 3 }
```

```json
{ "locked": true, "attempts": 10 }
```

| Field | Type | Description |
|-------|------|-------------|
| `locked` | boolean | `true` if the account is now locked |
| `attempts` | number | Total failed attempts in the current 15-minute window |

---

## 8. `POST /auth/resend-verification`

Resend the 6-digit email verification OTP. Use this when the user's original OTP has expired or been lost.

**Always returns `204`** regardless of whether the email exists — prevents enumeration.

**Authentication:** None (public)  
**Content-Type:** `application/json`

### Request Body

```json
{ "email": "sithuru@example.com" }
```

### Responses

| Response | Condition |
|----------|-----------|
| `204 No Content` | New OTP sent (or email not found — silent) |
| `400 EMAIL_ALREADY_VERIFIED` | Email is already verified — no OTP needed |
| `400 VALIDATION_ERROR` | Invalid email format |

```json
{
  "error": { "code": "EMAIL_ALREADY_VERIFIED", "message": "This email address is already verified." },
  "requestId": "7f3a1c2d-..."
}
```

---

## 9. `POST /auth/verify-email`

Verify email address using the 6-digit OTP received in the welcome email (or resent via endpoint 8). Sets `emailVerified = true` in Firebase Auth — all protected routes then become accessible.

**Authentication:** None (public)  
**Content-Type:** `application/json`

### Request Body

```json
{
  "email": "sithuru@example.com",
  "otp":   "748349"
}
```

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `email` | string | ✅ | Valid RFC-5322 email |
| `otp` | string | ✅ | Exactly 6 digits |

### OTP Rules

| Rule | Value |
|------|-------|
| TTL | 15 minutes |
| Max wrong attempts | 5 (then deleted — must resend) |
| On success | `emailVerified = true` set in Firebase Auth |

### Responses

| Response | Condition |
|----------|-----------|
| `204 No Content` | ✅ Email verified — all routes now accessible |
| `400 INVALID_OTP` | Wrong code — response includes remaining attempts |
| `400 OTP_EXPIRED` | OTP has expired — call `POST /auth/resend-verification` |
| `400 OTP_MAX_ATTEMPTS` | 5 failed attempts — call `POST /auth/resend-verification` |

```json
{
  "error": { "code": "INVALID_OTP", "message": "Invalid OTP. 2 attempts remaining." },
  "requestId": "7f3a1c2d-..."
}
```

---

## Apple Web OAuth Flow

The following 4 endpoints implement the **server-side Apple Web OAuth flow** for browser clients that cannot use the Apple SDK directly. Mobile apps using the Apple SDK should use `POST /auth/federated/apple` (endpoint 3) instead.

```
Frontend                    auth-service              Apple
   │                             │                       │
   │  GET /auth/apple/init       │                       │
   │ ─────────────────────────► │                       │
   │ ◄───────────────────────── │                       │
   │  { state, authorizeUrl }   │                       │
   │                             │                       │
   │  Redirect user to           │                       │
   │  authorizeUrl ──────────────────────────────────► │
   │                             │                       │
   │                             │ ◄─────────────────── │
   │                             │  POST /auth/apple/callback
   │                             │  (code + state)       │
   │ ◄───────────────────────── │                       │
   │  { firebaseToken, uid }    │                       │
```

---

## 10. `GET /auth/apple/init`

**Apple Web OAuth — Step 1.** Generate a CSRF state JWT and return the full Apple authorisation URL. Redirect the user's browser to `authorizeUrl`.

**Authentication:** None (public)

### Responses

**`200 OK`**
```json
{
  "state":        "eyJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3MTYwMDAwMDB9...",
  "authorizeUrl": "https://appleid.apple.com/auth/authorize?client_id=com.tccr.app&redirect_uri=...&state=...&response_type=code%20id_token&scope=name%20email"
}
```

| Field | Description |
|-------|-------------|
| `state` | CSRF state JWT — 10-minute TTL, signed with `JWT_SECRET`. **Pass this back unmodified** in `POST /auth/apple/callback`. Do not store or modify. |
| `authorizeUrl` | Complete Apple authorisation URL. Redirect the user's browser here. |

**`404 Not Found`** — `APPLE_CLIENT_ID` env var not configured (expected in dev/local stacks without Apple credentials).

---

## 11. `POST /auth/apple/callback`

**Apple Web OAuth — Step 2.** Apple redirects here after user consent with an auth code. Validates the CSRF state, exchanges the code for tokens, creates/signs in the user, and returns a Firebase token.

Accepts both:
- `application/x-www-form-urlencoded` — raw redirect from Apple
- `application/json` — when the frontend forwards the code itself

**Authentication:** None (public)

### Request Body

```json
{
  "code":  "c8f3a9b2...",
  "state": "eyJhbGciOiJIUzI1NiJ9..."
}
```

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `code` | string | ✅ | Apple authorisation code from the redirect |
| `state` | string | ✅ | The `state` value returned by `GET /auth/apple/init` — used for CSRF validation |

### Responses

**`200 OK`**
```json
{
  "firebaseToken": "<firebase-custom-token>",
  "uid":           "Xf3aBC123xyz",
  "isNewUser":     false
}
```

> Client exchanges `firebaseToken` via `signInWithCustomToken()` to get a proper Firebase ID token.

**`400 Bad Request`** → `INVALID_STATE` — CSRF state mismatch, expired, or tampered
```json
{
  "error": { "code": "INVALID_STATE", "message": "State token is invalid or has expired." },
  "requestId": "7f3a1c2d-..."
}
```

**`401 Unauthorized`** → `FEDERATED_TOKEN_INVALID` — Apple code exchange failed (invalid code, expired, already used)

---

## 12. `POST /auth/apple/refresh`

**Apple Web OAuth — Validate Session.** Check that the stored Apple refresh token is still valid (i.e. the user has not revoked TCCR's access in their Apple ID settings). Call this periodically to detect revocations proactively.

**Authentication:** Bearer required | **Roles:** Any

### Responses

**`200 OK`** — Apple session is active.
```json
{ "message": "Apple session is active." }
```

**`401 Unauthorized`** — Apple refresh token has been revoked. User must re-authenticate via the Apple OAuth flow.
```json
{
  "error": { "code": "APPLE_TOKEN_REVOKED", "message": "Apple session has been revoked. Please sign in again." },
  "requestId": "7f3a1c2d-..."
}
```

**`404 Not Found`** — This account has no stored Apple token (not an Apple user).

---

## 13. `POST /auth/apple/revoke`

**Apple Web OAuth — Revoke Tokens.** Revoke all Apple tokens associated with the authenticated user's account.

> ⚠️ **Required by Apple App Store guidelines.** Apps that allow users to delete their account **must** call this endpoint as part of the account-deletion flow. Apps that skip this step **fail App Store review.**

**Authentication:** Bearer required | **Roles:** Any (including unverified email)

### Responses

**`204 No Content`** — Apple tokens revoked successfully.

**`404 Not Found`** — No Apple token stored for this account (non-Apple user).
```json
{
  "error": { "code": "APPLE_TOKEN_NOT_FOUND", "message": "No Apple token found for this account." },
  "requestId": "7f3a1c2d-..."
}
```

---

## Error Response Format

All errors follow this envelope:

```json
{
  "error": {
    "code":    "ERROR_CODE",
    "message": "Human-readable explanation."
  },
  "requestId": "7f3a1c2d-4e5b-6f7a-8b9c-0d1e2f3a4b5c"
}
```

Use `requestId` to correlate failures with server logs via the `X-Request-Id` response header.

---

## Error Code Reference

| Code | HTTP | Endpoint(s) | Meaning |
|------|:----:|-------------|---------|
| `VALIDATION_ERROR` | 400 | All | Zod schema failure — check `message` for field details |
| `EMAIL_EXISTS` | 409 | `/auth/register` | Email already registered |
| `DISPOSABLE_EMAIL` | 422 | `/auth/register` | Disposable/blocked email domain |
| `EMAIL_DOMAIN_UNREACHABLE` | 422 | `/auth/register` | No MX records found for email domain |
| `FEDERATED_TOKEN_INVALID` | 401 | `/auth/federated/*`, `/auth/apple/callback` | OAuth token rejected by Google/Apple |
| `INVALID_OTP` | 400 | `/auth/password-reset/verify`, `/auth/verify-email` | Wrong OTP code |
| `OTP_EXPIRED` | 400 | `/auth/password-reset/verify`, `/auth/verify-email` | OTP has passed its 15-minute TTL |
| `OTP_MAX_ATTEMPTS` | 400 | `/auth/password-reset/verify`, `/auth/verify-email` | 5 wrong attempts — request a new OTP |
| `EMAIL_ALREADY_VERIFIED` | 400 | `/auth/resend-verification` | Email is already verified |
| `ACCOUNT_LOCKED` | 403 | (any sign-in) | 10 failed attempts in 15 min — auto-unlocks |
| `EMAIL_NOT_VERIFIED` | 403 | (any protected route) | Must verify email before accessing the API |
| `INVALID_STATE` | 400 | `/auth/apple/callback` | Apple CSRF state mismatch or expired |
| `APPLE_TOKEN_REVOKED` | 401 | `/auth/apple/refresh` | User revoked Apple access |
| `APPLE_TOKEN_NOT_FOUND` | 404 | `/auth/apple/refresh`, `/auth/apple/revoke` | No Apple session for this account |

---

## Account Lockout

| Setting | Value |
|---------|-------|
| Trigger | 10 failed login attempts within 15 minutes |
| Lock duration | 15 minutes (auto-clears — no admin action needed) |
| Tracking | Clients call `POST /auth/track-failure` after each failed Firebase sign-in |
| Counter storage | `loginAttempts` Firestore collection, keyed by email |

---

## Password Policy

| Rule | Requirement |
|------|-------------|
| Minimum length | 10 characters |
| Uppercase | At least 1 uppercase letter (A–Z) |
| Lowercase | At least 1 lowercase letter (a–z) |
| Digit | At least 1 number (0–9) |
| Special character | At least 1 special character (e.g. `@`, `!`, `#`, `$`) |

---

## Environment Variables (auth-service)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | ✅ | Firebase service account private key |
| `FIREBASE_WEB_API_KEY` | ✅ | Firebase web client key (password reset OTP dispatch) |
| `INTERNAL_SERVICE_KEY` | ✅ | Shared secret for `/internal/*` routes |
| `SMTP_HOST` | ❌ | SMTP server host (e.g. `smtp.gmail.com`). OTPs only emailed when set. |
| `SMTP_PORT` | ❌ | SMTP port — default `587` |
| `SMTP_USER` | ❌ | SMTP username |
| `SMTP_PASS` | ❌ | SMTP password |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth client ID for `POST /auth/federated/google` |
| `APPLE_CLIENT_ID` | ❌ | Apple OAuth client ID for Apple flows |
| `JWT_SECRET` | ❌ | Signs Apple CSRF state JWTs. Falls back to a plain UUID in non-production if absent. |
| `APP_URL` | ❌ | Login link in welcome emails. Default: `https://cms.bethelnet.au/login` |

---

## Quick-Start: Registration + Email Verification Flow

```
1. POST /auth/register          → 201 { uid }
                                   Welcome email sent with 6-digit OTP

2. POST /auth/verify-email      → 204
   { email, otp: "748349" }        emailVerified=true — all routes unlocked

3. (If OTP expires)
   POST /auth/resend-verification → 204  (new OTP sent)
   POST /auth/verify-email        → 204

4. Client signs in via Firebase SDK (client-side, no backend call)
   → Receives Firebase ID token

5. All subsequent API calls:
   Authorization: Bearer <firebase-id-token>
```

## Quick-Start: Password Reset Flow

```
1. POST /auth/password-reset      → 204
   { email }                         OTP emailed (6-digit, 15 min TTL)

2. POST /auth/password-reset/verify → 204
   { email, otp: "482910" }            Firebase reset email dispatched

3. User clicks link in Firebase reset email
   → Sets new password directly on Firebase

4. Client signs in with new password via Firebase SDK
```
