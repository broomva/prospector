# Prospector API - Integration Summary

## ✅ What Was Built

A complete FastAPI backend with DeepAgents framework and Composio MCP integration for your Prospector project.

### Core Features

1. **FastAPI Server** (Port 8000)
   - Health check endpoint
   - Chat endpoint with streaming support
   - CORS configured for Next.js integration
   - Async request handling

2. **DeepAgent Implementation**
   - Claude Sonnet 4.5 model
   - Autonomous planning and tool execution
   - Full prospector system prompt ported from TypeScript
   - Memory and context management

3. **Contact Management Tools**
   - `query_contacts_tool`: Filter by quality, role, industry, location
   - `get_contact_stats_tool`: Database statistics and insights
   - `vector_search_contacts_tool`: Semantic search for prospects

4. **Composio MCP Integration** 🆕
   - Connect to 100+ external tools (Google Sheets, Slack, Gmail, etc.)
   - Server-Sent Events (SSE) transport
   - Async tool loading with fallback
   - Multi-tenant support ready

## 📁 Project Structure

```
api/
├── app/
│   ├── agents/           # DeepAgent definitions
│   │   ├── prospector.py # Main agent with MCP integration
│   │   └── __init__.py
│   ├── tools/            # Contact management tools
│   │   ├── contact_tools.py
│   │   └── __init__.py
│   ├── mcp/              # Model Context Protocol integration 🆕
│   │   ├── composio_client.py  # Composio MCP client
│   │   └── __init__.py
│   ├── routes/           # API endpoints
│   │   ├── chat.py       # Chat & streaming
│   │   ├── health.py
│   │   └── __init__.py
│   ├── schemas/          # Pydantic models
│   │   ├── messages.py
│   │   └── __init__.py
│   ├── core/             # Configuration
│   │   ├── config.py
│   │   └── __init__.py
│   └── main.py           # FastAPI application
├── docs/
│   └── COMPOSIO_MCP_SETUP.md  # Full setup guide 🆕
├── venv/                 # Virtual environment (installed)
├── requirements.txt      # All dependencies including MCP
├── run.py                # Server launcher
├── .env                  # Environment variables (configured)
├── README.md             # Full documentation
├── QUICKSTART.md         # Quick start guide
└── .gitignore
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# API Server
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=info

# CORS (Next.js integration)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# AI Model
ANTHROPIC_API_KEY=<configured>
OPENAI_API_KEY=<configured>
MODEL_NAME=anthropic/claude-sonnet-4-5

# Composio MCP (optional) 🆕
COMPOSIO_MCP_SSE_URL=<configured>

# Database
DATABASE_URL=file:../mastra.db
```

## 🚀 How to Run

### 1. Activate Virtual Environment

```bash
cd api
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate  # Windows
```

### 2. Start the Server

```bash
python run.py
```

Server will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 3. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Chat with agent
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find 10 high-quality CFOs at SaaS companies in Colombia"
      }
    ]
  }'
```

## 🔗 Next.js Integration

Add this to your Next.js project:

```typescript
// lib/prospector-api.ts
const API_URL = process.env.NEXT_PUBLIC_PROSPECTOR_API || 'http://localhost:8000';

export async function chatWithProspector(messages: Array<{role: string; content: string}>) {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  return response.json();
}
```

## 🔌 Composio MCP Setup

### Quick Setup

1. Go to https://mcp.composio.dev
2. Select tools (e.g., Google Sheets, Slack)
3. Authenticate with services
4. Copy SSE URL
5. Add to `.env`:
   ```env
   COMPOSIO_MCP_SSE_URL=your-sse-url
   ```
6. Restart server

### Available Tools

When configured, your agent gains access to:
- **Google Sheets**: Export contacts, create reports
- **Slack**: Send notifications
- **Gmail**: Send outreach emails
- **GitHub**: Create tasks
- **HubSpot/Salesforce**: CRM sync
- **And 95+ more tools**

See `docs/COMPOSIO_MCP_SETUP.md` for detailed instructions.

## 📊 Agent Capabilities

### Core Tools (Always Available)
1. Query and filter contacts
2. Get database statistics
3. Semantic search for prospects

### MCP Tools (When Configured)
100+ external integrations via Composio

### Example Queries

```bash
# Find prospects
"Find me 20 high-quality CFOs at SaaS companies in Colombia"

# Get insights
"What's the distribution of contacts by industry?"

# Semantic search
"Find contacts similar to fintech payment companies"

# Export to tools (with MCP)
"Export these prospects to a Google Sheet"
"Send a summary to #sales-team on Slack"
```

## 📦 Installed Packages

```
fastapi==0.115.6
uvicorn==0.34.0
pydantic==2.12.4
deepagents==0.1.0
langchain==1.0.0
langchain-anthropic==1.0.0
langchain-openai==1.0.1
langgraph==1.0.2
langchain-mcp-adapters==0.1.12  🆕
mcp==1.21.0  🆕
python-dotenv==1.0.1
structlog==24.4.0
+ 40+ dependencies
```

## 🔐 Security Notes

### API Keys
- ✅ Stored in `.env` (git-ignored)
- ✅ Not committed to repository
- ✅ Used via environment variables

### Composio SSE URLs
- ⚠️ Contains authentication tokens
- ✅ Stored in `.env` (git-ignored)
- ✅ Never share publicly
- 🔄 Rotate regularly

### CORS
- ✅ Configured for localhost Next.js
- 🔧 Update for production domains

## 🧪 Testing

### Manual Testing

```bash
# 1. Health check
curl http://localhost:8000/health

# 2. Simple query
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How many contacts do we have?"}]}'

# 3. Complex query
curl -X POST http://localhost:8000/chat \
  -H "Content-Type": "application/json" \
  -d '{"messages":[{"role":"user","content":"Find executives at travel companies in Colombia"}]}'
```

### Unit Tests (TODO)

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest tests/
```

## 🐛 Troubleshooting

### Port 8000 already in use
```bash
# Find and kill process
lsof -i :8000
kill -9 <PID>

# Or use different port
API_PORT=8001 python run.py
```

### "Could not connect to Composio MCP server"
- Check `COMPOSIO_MCP_SSE_URL` in `.env`
- Re-authenticate at https://mcp.composio.dev
- Get fresh SSE URL
- Restart server

### "No such file: apollo-contacts-export.csv"
- Ensure CSV exists at `../data/apollo-contacts-export.csv`
- Or update `CSV_PATH` in `app/tools/contact_tools.py`

### Agent not using MCP tools
- Ask: "What tools do you have?"
- Be explicit: "Use Google Sheets to export..."
- Check logs for tool loading errors

## 📖 Documentation

- **README.md**: Complete API documentation
- **QUICKSTART.md**: Step-by-step setup guide
- **docs/COMPOSIO_MCP_SETUP.md**: Composio MCP integration guide (detailed)
- **API Docs**: http://localhost:8000/docs (interactive)
- **ReDoc**: http://localhost:8000/redoc (alternative)

## 🎯 Next Steps

### Immediate
1. ✅ FastAPI server running
2. ✅ DeepAgent operational
3. ✅ Composio MCP integrated
4. 🔄 Test with real queries
5. 🔄 Configure Composio tools
6. 🔄 Integrate with Next.js frontend

### Short Term
1. Add authentication (API keys / OAuth)
2. Set up LangSmith observability
3. Implement caching for common queries
4. Add rate limiting
5. Create unit tests
6. Deploy to cloud

### Long Term
1. Build custom MCP servers
2. Add more contact data sources
3. Implement workflow automation
4. Create dashboards and analytics
5. Multi-tenant support
6. Advanced personalization

## 🤝 Comparison: TypeScript vs Python

| Feature | TypeScript (Mastra) | Python (DeepAgents) |
|---------|---------------------|---------------------|
| Framework | Mastra | DeepAgents/LangChain |
| Model | Claude Sonnet 4.5 | Claude Sonnet 4.5 |
| Contact Tools | ✅ 7 tools | ✅ 3 core tools |
| MCP Integration | ✅ @mastra/mcp | ✅ langchain-mcp-adapters |
| Streaming | ✅ | ✅ |
| Memory | ✅ LibSQL | ✅ Built-in |
| Deployment | Vercel/Next.js | Any Python host |

Both implementations:
- Use same prospector system prompt
- Access same contact database
- Connect to Composio MCP
- Support streaming responses

## 📞 Support

Need help?
- Check documentation in `docs/`
- Review API docs at `/docs`
- Test with curl examples above
- Check logs for errors

## 🙏 Acknowledgments

- [DeepAgents](https://github.com/langchain-ai/deepagents) - LangChain
- [Composio](https://composio.dev) - MCP integration
- [FastAPI](https://fastapi.tiangolo.com) - Web framework
- [Pydantic](https://docs.pydantic.dev) - Data validation

---

Built with 🚀 for Wedi Pay prospecting automation
