---
title: Authentication architecture
description: How authentication, session storage, and token refresh work across the API and web client.
tags: [architecture, auth]
version: 1.2.0
status: stable
owner: '@platform'
createdAt: 2026-01-12T09:00:00Z
updatedAt: 2026-04-15T14:32:00Z
---

# Authentication architecture

Authentication uses short-lived access tokens (15 min) and rotating refresh tokens stored in HTTP-only cookies. The web client never sees the refresh token; refresh happens via a same-origin endpoint.

## Flow

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web client
  participant A as API
  participant DB as Postgres

  U->>W: enters credentials
  W->>A: POST /auth/login
  A->>DB: verify password
  DB-->>A: user row
  A-->>W: access token (15m) + Set-Cookie: refresh
  W-->>U: logged in
```

## Refresh

When the access token expires, the client calls `POST /auth/refresh`. The server validates the refresh cookie, rotates it, and returns a new access token. If the refresh cookie is missing or invalid, the user is logged out.

## Storage

| What             | Where                  | TTL               |
| ---------------- | ---------------------- | ----------------- |
| Access token     | In-memory (web client) | 15 min            |
| Refresh token    | HTTP-only cookie       | 30 days, rotating |
| Session metadata | `sessions` table       | Until logout      |

## Why short-lived access tokens?

Limits the blast radius of a leaked access token. Refresh tokens are server-side trackable and revocable individually.
