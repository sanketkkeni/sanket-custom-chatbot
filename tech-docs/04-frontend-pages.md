# Frontend — Pages

**Framework**: Next.js 14 (Pages Router)
**Styling**: Tailwind CSS with custom dark theme
**Icons**: lucide-react

## Page Routes

| Route | File | Auth Required | Description |
|-------|------|---------------|-------------|
| `/` | `pages/index.tsx` | No | Landing page — redirects to `/dashboard` if authenticated |
| `/login` | `pages/login.tsx` | No | Email/password sign-in |
| `/signup` | `pages/signup.tsx` | No | Registration with email + password confirmation |
| `/confirm` | `pages/confirm.tsx` | No | Email verification code entry |
| `/dashboard` | `pages/dashboard.tsx` | Yes | KB grid with create/delete |
| `/kb/[id]` | `pages/kb/[id].tsx` | Yes | KB detail: upload, file list, sync, stats |
| `/chat/[kbId]` | `pages/chat/[kbId].tsx` | Yes | Chat interface |
| `/history` | `pages/history.tsx` | Yes | Conversation list + MD content viewer |

## Auth Guard Pattern

Pages requiring auth wrap their content with a check against `AuthContext`:

```tsx
const { user, loading } = useAuth();
const router = useRouter();

useEffect(() => {
    if (!loading && !user) router.push('/login');
}, [user, loading]);

if (loading || !user) return <LoadingSpinner />;
```

## Page Details

### `/` — Landing Page
- Shows app branding
- Redirects to `/dashboard` if already authenticated
- Links to `/login` and `/signup`

### `/login` — Sign In
- Email/password form
- Handles `UserNotConfirmedException` with redirect to `/confirm`
- Stores tokens in localStorage via `AuthContext`

### `/signup` — Registration
- Email + password + confirm password form
- Calls Cognito `signUp()`
- Redirects to `/confirm` on success

### `/confirm` — Email Verification
- Code input field
- Calls `confirmSignUp()`
- On success, redirects to `/login`
- Includes resend code button

### `/dashboard` — KB List
- Grid of `KBCard` components (name, status, doc count)
- Create KB button → `KBCreateModal`
- Click card to navigate to `/kb/[id]` or `/chat/[kbId]`
- Delete KB button with confirmation
- Sidebar with nav links (Dashboard, History)

### `/kb/[id]` — KB Detail (Manage)

Top section — stats cards:
| Card | Source |
|------|--------|
| Documents | `documentCount` from DynamoDB (S3 file count) |
| Indexed | `indexedCount` from Bedrock ingestion (scanned - failed) |
| Sync Status | `lastSyncStatus` from DynamoDB |
| Failed | `failedCount` from Bedrock ingestion (red if > 0) |

Middle section — file management:
- **FileUpload** component: drag-and-drop, multi-file, validation
- **Sync button**: starts ingestion, polls until COMPLETE/FAILED
- **File list**: per-file delete button with `Trash2` icon

### `/chat/[kbId]` — Chat Interface
- **ChatPanel**: message list + input
- **MarkdownRenderer**: renders assistant responses (headings, lists, tables, code blocks, mermaid diagrams)
- **AgentSelector**: optional agent dropdown
- **InstructionsEditor**: collapsible editor for agent instructions (expands to show textarea)
- Conversation ID tracked in state for continuation
- Auto-scroll to latest message
- Sources displayed after each assistant response

### `/history` — Conversations
- **HistorySearch**: left sidebar with conversation list
- Search by title keyword (client-side filter)
- Click conversation → load messages from S3
- Full markdown rendering with `MarkdownRenderer`
- Delete conversation button
