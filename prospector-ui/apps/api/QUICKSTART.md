# Prospector API - Quick Start Guide

## What You Just Built

A FastAPI backend powered by DeepAgents that provides an AI-powered prospecting assistant for Wedi Pay. The agent can:
- Query and analyze contact data from Apollo export
- Perform semantic searches to find relevant prospects
- Generate insights and recommendations
- Help craft personalized outreach strategies

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│                  (localhost:3000)                       │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST API
                         ▼
┌─────────────────────────────────────────────────────────┐
│                FastAPI Backend (Port 8000)              │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Prospector DeepAgent                 │  │
│  │  - Planning & Reasoning                          │  │
│  │  - Tool Selection & Execution                    │  │
│  │  - Memory & Context Management                   │  │
│  └────────────┬──────────────────────────────────────┘  │
│               │                                          │
│    ┌──────────▼──────────┐                              │
│    │      Tools          │                              │
│    │  ┌─────────────┐   │                              │
│    │  │ Query       │   │                              │
│    │  │ Contacts    │   │                              │
│    │  └─────────────┘   │                              │
│    │  ┌─────────────┐   │                              │
│    │  │ Get Stats   │   │                              │
│    │  └─────────────┘   │                              │
│    │  ┌─────────────┐   │                              │
│    │  │ Vector      │   │                              │
│    │  │ Search      │   │                              │
│    │  └─────────────┘   │                              │
│    └─────────┬───────────┘                              │
└──────────────┼──────────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │  Apollo Contacts DB   │
    │  (CSV / SQLite)       │
    └──────────────────────┘
```

## Running the Server

### 1. Activate the virtual environment

```bash
cd api
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows
```

### 2. Start the server

```bash
python run.py
```

The server will start at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs (Interactive Swagger UI)
- **ReDoc**: http://localhost:8000/redoc (Alternative docs)

## Testing the API

### 1. Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "prospector-api",
  "version": "1.0.0"
}
```

### 2. Chat with the Agent

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What are the top 10 high-quality CFOs at SaaS companies in Colombia?"
      }
    ]
  }'
```

### 3. Example Queries

Try these queries with the agent:

```bash
# Get database statistics
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Give me an overview of the contact database"
      }
    ]
  }'

# Find specific prospects
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find executives in the travel industry who haven'\''t been contacted yet"
      }
    ]
  }'

# Semantic search
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find contacts similar to fintech payment companies"
      }
    ]
  }'
```

## Integrating with Next.js

### 1. Create an API client

```typescript
// lib/prospector-client.ts
const API_URL = process.env.NEXT_PUBLIC_PROSPECTOR_API || 'http://localhost:8000';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  thread_id?: string;
}

export interface ChatResponse {
  response: string;
  thread_id: string;
  messages: Message[];
  metadata?: Record<string, any>;
}

export async function chatWithProspector(
  request: ChatRequest
): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}
```

### 2. Use in a component

```typescript
// components/ProspectorChat.tsx
'use client';

import { useState } from 'react';
import { chatWithProspector } from '@/lib/prospector-client';

export function ProspectorChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatWithProspector({
        messages: [...messages, userMessage],
      });

      setMessages(response.messages);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-4 ${
              msg.role === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <div
              className={`inline-block p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div>Thinking...</div>}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about prospects..."
            className="flex-1 p-2 border rounded"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

### 3. Add environment variable

In your Next.js `.env.local`:

```env
NEXT_PUBLIC_PROSPECTOR_API=http://localhost:8000
```

## Deployment

### Production Setup

1. **Update environment variables** in `api/.env`:
   ```env
   API_HOST=0.0.0.0
   API_PORT=8000
   API_RELOAD=false
   LOG_LEVEL=info
   ```

2. **Run with production server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

3. **Deploy to cloud** (Vercel, Railway, Fly.io, etc.)

### Docker (Optional)

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t prospector-api .
docker run -p 8000:8000 --env-file .env prospector-api
```

## Next Steps

1. **Add more tools**: Extend `app/tools/contact_tools.py` with additional functionality
2. **Implement vector search**: Set up embeddings for semantic search
3. **Add authentication**: Protect the API with API keys or OAuth
4. **Set up logging**: Use LangSmith for observability
5. **Add caching**: Cache responses for common queries
6. **Rate limiting**: Add rate limits to prevent abuse

## Troubleshooting

### Server won't start

- Check if port 8000 is already in use
- Verify virtual environment is activated
- Ensure all dependencies are installed
- Check `.env` file exists with correct API keys

### Agent not responding

- Check Anthropic API key is valid
- Verify CSV data file exists at `../data/apollo-contacts-export.csv`
- Check server logs for errors

### CORS errors

- Add your Next.js origin to `CORS_ORIGINS` in `.env`
- Restart the server after changing `.env`

## Need Help?

- Check the full [README.md](./README.md) for detailed documentation
- Open an issue on GitHub
- Review the [DeepAgents documentation](https://github.com/langchain-ai/deepagents)
