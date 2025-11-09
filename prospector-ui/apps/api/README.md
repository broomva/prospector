# Prospector API - DeepAgent Backend

FastAPI backend for the Prospector DeepAgent, an AI-powered contact prospecting and outreach assistant built with [LangChain's DeepAgents](https://github.com/langchain-ai/deepagents) framework.

## Features

- **DeepAgent Architecture**: Autonomous agent with planning, tool use, and long-term memory
- **Contact Management Tools**: Query, filter, and analyze contacts from Apollo export
- **Semantic Search**: Vector-based search for finding relevant contacts
- **Composio MCP Integration**: Access 100+ external tools (Google Sheets, Slack, Gmail, etc.) 🆕
- **Streaming Responses**: Real-time streaming of agent responses via SSE
- **CORS Support**: Configured for Next.js frontend integration
- **Type-Safe**: Pydantic models for all API schemas

## Project Structure

```
api/
├── app/
│   ├── core/           # Configuration and settings
│   ├── agents/         # DeepAgent definitions
│   ├── tools/          # LangChain tools for contact management
│   ├── routes/         # FastAPI route handlers
│   ├── schemas/        # Pydantic models
│   └── main.py         # FastAPI application
├── requirements.txt    # Python dependencies
├── pyproject.toml      # Project configuration
├── run.py              # Server run script
└── README.md           # This file
```

## Prerequisites

- Python 3.11 or higher
- Anthropic API key (for Claude Sonnet 4.5)
- Access to the contacts database (mastra.db or CSV export)

## Installation

This project uses [uv](https://github.com/astral-sh/uv) - an extremely fast Python package manager (10-100x faster than pip).

### 1. Install UV (if not already installed)

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or with Homebrew
brew install uv
```

### 2. Create virtual environment and install dependencies

```bash
cd api

# Create venv
uv venv

# Activate venv (optional - uv can run without activation)
source .venv/bin/activate  # macOS/Linux
# or
.venv\Scripts\activate  # Windows

# Install dependencies
uv pip install -r requirements.txt
```

> **Note**: See [UV_SETUP.md](./UV_SETUP.md) for detailed UV usage and tips.

### 3. Configure environment variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true
LOG_LEVEL=info

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Anthropic API Key (required)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Model Configuration
MODEL_NAME=anthropic/claude-sonnet-4-5

# Composio MCP (optional - for external tool integrations)
# Get your SSE URL from: https://mcp.composio.dev
COMPOSIO_MCP_SSE_URL=your_composio_sse_url_here

# Database (uses the Next.js mastra.db by default)
DATABASE_URL=file:../mastra.db
```

## Running the Server

### Development mode (with auto-reload)

```bash
# Option 1: With activated venv
python run.py

# Option 2: Direct with uv (no activation needed) ⚡
uv run python run.py

# Option 3: Using uvicorn directly
uv run uvicorn app.main:app --reload
```

### Production mode

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Health Check

```bash
GET /health
```

Returns the API health status.

### Chat with Agent

```bash
POST /chat
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Find me 10 high-quality CFOs at SaaS companies in Colombia"
    }
  ],
  "thread_id": "optional-thread-id"
}
```

Response:
```json
{
  "response": "I found 12 high-quality CFOs...",
  "thread_id": "abc-123",
  "messages": [...],
  "metadata": {
    "model": "anthropic/claude-sonnet-4-5",
    "steps": 3
  }
}
```

### Streaming Chat

```bash
POST /chat/stream
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Find prospects in the travel industry"
    }
  ]
}
```

Returns Server-Sent Events (SSE) stream with real-time chunks.

## Usage Examples

### Using curl

```bash
# Health check
curl http://localhost:8000/health

# Chat request
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What are the top 20 never-contacted executives in the fintech industry?"
      }
    ]
  }'
```

### Using Python

```python
import requests

# Chat with the agent
response = requests.post(
    "http://localhost:8000/chat",
    json={
        "messages": [
            {
                "role": "user",
                "content": "Find CFOs at travel companies in Colombia"
            }
        ]
    }
)

print(response.json()["response"])
```

### Using JavaScript/TypeScript (Next.js)

```typescript
const response = await fetch('http://localhost:8000/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'Find high-quality prospects in the SaaS industry',
      },
    ],
  }),
});

const data = await response.json();
console.log(data.response);
```

## Agent Capabilities

The Prospector DeepAgent has access to the following tools:

### Core Contact Tools
1. **query_contacts_tool**: Filter contacts by quality score, executive status, country, industry, etc.
2. **get_contact_stats_tool**: Get database statistics and distributions
3. **vector_search_contacts_tool**: Semantic search for finding relevant contacts

### External Tools via Composio MCP (Optional)
When configured, the agent can also access 100+ external tools including:
- **Google Sheets**: Export contacts, create reports
- **Slack**: Send notifications, share insights
- **Gmail**: Send outreach emails
- **GitHub**: Create tasks, track prospects
- **HubSpot/Salesforce**: Sync CRM data
- And 95+ more tools...

See [Composio MCP Setup Guide](./docs/COMPOSIO_MCP_SETUP.md) for configuration instructions.

The agent automatically plans its approach, uses tools as needed, and tracks its progress.

## Example Queries

- "Find me 20 high-quality CFOs at SaaS companies in Colombia"
- "What's the distribution of contacts by industry?"
- "Show me executives at travel companies who haven't been contacted yet"
- "Find contacts similar to fintech payment companies"
- "Give me prospects in the proptech industry with high quality scores"

## Integration with Next.js

Add this to your Next.js app to call the API:

```typescript
// lib/prospector-api.ts
const PROSPECTOR_API_URL = process.env.NEXT_PUBLIC_PROSPECTOR_API_URL || 'http://localhost:8000';

export async function chatWithProspector(messages: Array<{role: string; content: string}>) {
  const response = await fetch(`${PROSPECTOR_API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error('Failed to chat with prospector');
  }

  return response.json();
}
```

## Development

### Adding New Tools

1. Create a new tool function in `app/tools/`:

```python
from langchain_core.tools import tool

@tool
def my_new_tool(param: str) -> dict:
    """Tool description."""
    # Implementation
    return {"result": "data"}
```

2. Add it to the agent in `app/agents/prospector.py`:

```python
from app.tools import my_new_tool

agent = create_deep_agent(
    tools=[
        query_contacts_tool,
        get_contact_stats_tool,
        vector_search_contacts_tool,
        my_new_tool,  # Add here
    ],
    ...
)
```

### Running Tests

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/
```

## Troubleshooting

### "Package not installed" errors

Make sure you've activated the virtual environment and installed dependencies:

```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### "API key not found" error

Ensure your `.env` file has the correct `ANTHROPIC_API_KEY`:

```bash
echo $ANTHROPIC_API_KEY  # Should not be empty
```

### "Database not found" error

Ensure the `DATABASE_URL` in `.env` points to the correct database file:

```env
DATABASE_URL=file:../mastra.db
```

### CORS errors from Next.js

Add your Next.js origin to `CORS_ORIGINS` in `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## License

Apache 2.0

## Learn More

- [DeepAgents Framework](https://github.com/langchain-ai/deepagents)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangChain Documentation](https://python.langchain.com/)
- [Mastra Documentation](https://mastra.ai/docs)
