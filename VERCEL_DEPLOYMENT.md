# Vercel Deployment — Sanket Custom Chatbot

## Prerequisites

- GitHub repo: `sanketkkeni/sanket-custom-chatbot`
- Vercel account connected to GitHub

## Steps

### 1. Import project in Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `sanketkkeni/sanket-custom-chatbot`
3. Configure project:

| Setting | Value |
|---|---|
| **Root Directory** | `frontend/` |
| **Framework Preset** | Next.js (auto-detected) |
| **Build Command** | `next build` (default) |
| **Output Directory** | `.next` (default) |

### 2. Set environment variables

Add these in **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_AWS_REGION` | `us-east-1` |
| `NEXT_PUBLIC_USER_POOL_ID` | `us-east-1_RrVpLjc9u` |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | `4k8m2jcedhbq6imlrvpj9cjs1c` |
| `NEXT_PUBLIC_API_ENDPOINT` | `https://4rflw6v3y9.execute-api.us-east-1.amazonaws.com` |

### 3. Deploy

Click **Deploy**. Vercel auto-deploys on every push to `main` — no further setup needed.

### 4. Verify

Once deployed, check that:
- Login/signup works against Cognito
- Dashboard lists your KBs
- Chat returns answers from Bedrock
