# Frontend — Components

All components use React 18 functional components with hooks. Styling via Tailwind CSS classes.

## `Layout.tsx`

**File**: `frontend/components/Layout.tsx`

Sidebar layout wrapper for authenticated pages.

**Props**: `{ children: React.ReactNode }`

**Structure**:
- Sidebar (fixed left):
  - Brain logo/branding
  - Nav links: Dashboard, History
  - User email display
  - Sign-out button
- Main content area (right)
- Active route highlighting
- Responsive: sidebar collapsible via `AppContext`

**Contexts used**: `AuthContext` (user + signOut), `AppContext` (sidebarOpen + toggle)

## `KBCard.tsx`

**File**: `frontend/components/KBCard.tsx`

**Props**: `{ kb: KB, onDelete: (id: string) => void }`

Displays a knowledge base in a glass-dark card:
- KB name
- Status badge (ACTIVE = green, CREATING = yellow, FAILED = red)
- Document count
- Two action buttons: Chat (→ `/chat/[kbId]`) and Manage (→ `/kb/[id]`)
- Delete button with confirmation

## `KBCreateModal.tsx`

**File**: `frontend/components/KBCreateModal.tsx`

**Props**: `{ isOpen: boolean, onClose: () => void, onCreated: () => void }`

- Modal dialog with name input
- Calls `createKB(name)` API
- Loading state during creation
- Validation: name cannot be empty

## `FileUpload.tsx`

**File**: `frontend/components/FileUpload.tsx`

**Props**: `{ kbId: string, onUploadComplete: () => void }`

**Validation**:
- Max file size: 50 MB
- Allowed types: PDF, TXT, MD, HTML, CSV, DOC, DOCX, XLS, XLSX
- Checks both MIME type (`f.type`) and file extension (`f.name`)
- Rejected files show red error: `"image.png: PNG files are not supported. Allowed: PDF, TXT, MD, HTML, CSV, DOC, DOCX, XLS, XLSX"`

**Flow**:
1. User selects files (drag-and-drop or click)
2. Validate each file (size + type). Reject invalid files with per-file error messages
3. Call `getUploadUrls(kbId, filesPayload)` for batch presigned URLs
4. Parallel upload to S3 via `Promise.allSettled`
5. Per-file success/error display
6. Call `onUploadComplete()` on any success to refresh

## `FileList.tsx`

**File**: `frontend/components/FileList.tsx`

**Props**: `{ kbId: string }`

- Fetches and displays list of files in the KB's S3 prefix
- Each file shows: name, size, last modified
- Delete button per file (calls `deleteFile` API)
- Refreshes on upload completion

## `ChatPanel.tsx`

**File**: `frontend/components/ChatPanel.tsx`

**Props**: `{ kbId: string, agentId?: string }`

- Message list (scrollable)
- Input field + send button
- Calls `sendChat(kbId, message, agentId, conversationId)`
- Renders responses using `MarkdownRenderer`
- Displays sources after each response
- Tracks `conversationId` for continuation
- Auto-scroll to bottom

## `AgentSelector.tsx`

**File**: `frontend/components/AgentSelector.tsx`

**Props**: `{ kbId: string, agentId: string | null, onSelect: (agentId: string | null) => void }`

- Dropdown to select/switch agents
- "None" option for direct KB chat

## `InstructionsEditor.tsx`

**File**: `frontend/components/InstructionsEditor.tsx`

**Props**: `{ instructions: string, onChange: (text: string) => void }`

- Collapsible textarea for editing agent system prompt
- Appears when agent is selected

## `SyncStatus.tsx`

**File**: `frontend/components/SyncStatus.tsx`

**Props**: `{ kbId: string }`

- Shows current sync status
- Retry button on failure
- Polls `getSyncStatus` during IN_PROGRESS

## `HistorySearch.tsx`

**File**: `frontend/components/HistorySearch.tsx`

**Props**: `{ onSelect: (conversationId: string) => void }`

- Left sidebar in history page
- Search input with debounce
- Conversation list with titles and timestamps
- Delete button per conversation

## `MarkdownRenderer.tsx`

**File**: `frontend/components/MarkdownRenderer.tsx`

**Props**: `{ content: string }`

Wraps `react-markdown` with `remark-gfm` plugin.

**Custom renderers**:
- **Headings** (h1-h6): Large bold text
- **Lists**: Bullet/numbered with proper indentation
- **Tables**: `border-collapse` with alternating row colors
- **Code blocks**: `pre` with `code` inner, monospace
- **Inline code**: `bg-gray-800` background
- **Links**: Open in new tab (`target="_blank"`, `rel="noopener noreferrer"`)
- **Horizontal rules**: `border-dark-500`
- **Blockquotes**: Left border accent
- **Mermaid blocks**: Delegates to `MermaidDiagram` component
- **Paragraphs**: `mb-2` spacing

## `MermaidDiagram.tsx`

**File**: `frontend/components/MermaidDiagram.tsx`

**Props**: `{ chart: string }`

- Client-side mermaid rendering (dynamic import, `{ ssr: false }`)
- Dark theme configuration
- Error handling: renders raw chart text in red on failure
- Wraps output in a centered div
