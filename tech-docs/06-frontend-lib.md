# Frontend — Libraries & API Client

## Auth Library: `lib/auth.ts`

**File**: `frontend/lib/auth.ts`

Wraps AWS Cognito SDK (`@aws-sdk/client-cognito-identity-provider`) for browser-based authentication.

### Configuration

| Variable | Source |
|----------|--------|
| `region` | `NEXT_PUBLIC_AWS_REGION` |
| `UserPoolId` | `NEXT_PUBLIC_USER_POOL_ID` |
| `ClientId` | `NEXT_PUBLIC_USER_POOL_CLIENT_ID` |

### Functions

| Function | AWS SDK Command | Auth Flow |
|----------|----------------|-----------|
| `signUp(email, password)` | `SignUpCommand` | Creates user, returns userSub |
| `confirmSignUp(email, code)` | `ConfirmSignUpCommand` | Verifies with 6-digit code |
| `resendVerificationCode(email)` | `ResendConfirmationCodeCommand` | Re-sends code |
| `signIn(email, password)` | `InitiateAuthCommand` | `USER_PASSWORD_AUTH` → tokens |
| `getUser(accessToken)` | `GetUserCommand` | Fetch user attributes |
| `signOut(accessToken)` | `GlobalSignOutCommand` | Invalidate all tokens |
| `refreshTokens(refreshToken)` | `InitiateAuthCommand` | `REFRESH_TOKEN_AUTH` → new tokens |

### Token Storage (localStorage)

| Key | Token | Validity |
|-----|-------|----------|
| `accessToken` | Access token | 1 hour |
| `idToken` | ID token (used for API auth) | 1 hour |
| `refreshToken` | Refresh token | 30 days |
| `userId` | Cognito username | (stored separately) |

### Auth Flow

```
signIn()
  → InitiateAuth(USER_PASSWORD_AUTH)
  → { AuthenticationResult: { AccessToken, IdToken, RefreshToken } }
  → Store in localStorage
  → API calls include: Authorization: Bearer <idToken>

On page load:
  → Check localStorage for tokens
  → If accessToken exists: getUser(accessToken) to validate
  → If 401/expired: refreshTokens(refreshToken)
  → If refresh fails: clear tokens, redirect to /login
```

## API Client: `lib/api.ts`

**File**: `frontend/lib/api.ts`

### Core Function

```typescript
async function apiRequest(method: string, path: string, body?: any): Promise<any>
```

- Builds URL: `{NEXT_PUBLIC_API_ENDPOINT}{path}`
- Adds headers: `Authorization: Bearer <idToken>`, `Content-Type: application/json`
- Parses JSON response
- Throws on non-2xx status: `Error(response.message)`

### KB Endpoints

| Function | HTTP | Path |
|----------|------|------|
| `listKBs()` | `GET` | `/kbs` |
| `getKB(kbId)` | `GET` | `/kbs/{kbId}` |
| `createKB(name)` | `POST` | `/kbs` |
| `deleteKB(kbId)` | `DELETE` | `/kbs/{kbId}` |
| `getUploadUrl(kbId, filename, contentType)` | `POST` | `/kbs/{kbId}/upload` |
| `getUploadUrls(kbId, files[])` | `POST` | `/kbs/{kbId}/upload` |
| `listFiles(kbId)` | `GET` | `/kbs/{kbId}/files` |
| `deleteFile(kbId, fileKey)` | `DELETE` | `/kbs/{kbId}/files/{fileKey}` |
| `startSync(kbId)` | `POST` | `/kbs/{kbId}/sync` |
| `getSyncStatus(kbId)` | `GET` | `/kbs/{kbId}/sync` |
| `getKBStats(kbId)` | `GET` | `/kbs/{kbId}/stats` |

### Chat Endpoints

| Function | HTTP | Path |
|----------|------|------|
| `sendChat(kbId, message, agentId?, conversationId?)` | `POST` | `/chat` |

### History Endpoints

| Function | HTTP | Path |
|----------|------|------|
| `listConversations(search?)` | `GET` | `/history?search=...` |
| `getConversation(conversationId)` | `GET` | `/history/{conversationId}` |
| `deleteConversation(conversationId)` | `DELETE` | `/history/{conversationId}` |

### S3 Direct Upload

```typescript
async function uploadToS3(presignedUrl: string, file: File): Promise<void>
```

- `PUT` to presigned S3 URL (bypasses API Gateway entirely)
- Sets `Content-Type` header from `file.type`
- Throws on non-2xx

## Contexts

### `AuthContext` (`context/AuthContext.tsx`)

Provides global auth state to the component tree.

```typescript
interface AuthContextType {
    user: User | null;        // { username, email, email_verified }
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => void;
}
```

### `AppContext` (`context/AppContext.tsx`)

Provides app-level UI state.

```typescript
interface AppContextType {
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    refreshKBs: number;        // Counter for KB list refresh signal
    triggerRefresh: () => void;
}
```

## Configuration

Live values (from `.env.local`):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_AWS_REGION` | `us-east-1` |
| `NEXT_PUBLIC_USER_POOL_ID` | `us-east-1_RrVpLjc9u` |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | `4k8m2jcedhbq6imlrvpj9cjs1c` |
| `NEXT_PUBLIC_API_ENDPOINT` | `https://4rflw6v3y9.execute-api.us-east-1.amazonaws.com` |
