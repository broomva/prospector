# Troubleshooting Guide

Common issues and solutions for the Prospector API.

## 404 Error from Anthropic API ✅ FIXED

### Symptom
```
2025-11-09 07:31:51,217 - httpx - INFO - HTTP Request: POST https://api.anthropic.com/v1/messages "HTTP/1.1 404 Not Found"
INFO: 127.0.0.1:49235 - "POST /chat/ HTTP/1.1" 500 Internal Server Error
```

### Cause
Incorrect model name format in `.env` file.

### Solution
Update `MODEL_NAME` in `.env`:

```env
# ❌ WRONG - Don't use provider/model format
MODEL_NAME=anthropic/claude-sonnet-4-5

# ✅ CORRECT - Use actual Anthropic model name
MODEL_NAME=claude-sonnet-4-5-20250929
```

**Available model names:**
- `claude-sonnet-4-5-20250929` (latest Sonnet 4.5)
- `claude-3-5-sonnet-20241022` (Sonnet 3.5)
- `claude-3-opus-20240229` (Opus 3)
- `claude-3-sonnet-20240229` (Sonnet 3)
- `claude-3-haiku-20240307` (Haiku 3)

After changing `.env`, restart the server.

## 307 Temporary Redirect

### Symptom
```
INFO: 127.0.0.1:49975 - "POST /chat HTTP/1.1" 307 Temporary Redirect
```

### Cause
Missing trailing slash in URL.

### Solution
Use `/chat/` (with trailing slash) instead of `/chat`:

```bash
# ❌ WRONG
curl -X POST http://localhost:8000/chat

# ✅ CORRECT
curl -X POST http://localhost:8000/chat/
```

## Port 8000 Already in Use

### Symptom
```
ERROR: [Errno 48] Address already in use
```

### Solution

**Option 1: Kill existing process**
```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>
```

**Option 2: Use different port**
```bash
# In .env
API_PORT=8001

# Or with env variable
API_PORT=8001 uv run python run.py
```

## Module Not Found Errors

### Symptom
```
ModuleNotFoundError: No module named 'langchain_mcp_adapters'
```

### Cause
Dependencies not installed or wrong virtual environment.

### Solution
```bash
# Activate correct environment
source .venv/bin/activate

# Install dependencies
uv pip install -r requirements.txt

# Verify installation
pip list | grep langchain
```

## CORS Errors from Next.js

### Symptom
```
Access to fetch at 'http://localhost:8000/chat/' from origin 'http://localhost:3000' has been blocked by CORS policy
```

### Solution
Add your Next.js origin to `CORS_ORIGINS` in `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

Restart the server after changing.

## "Could not connect to Composio MCP server"

### Symptom
```
Warning: Could not connect to Composio MCP server: Connection refused
Continuing without Composio tools. Check COMPOSIO_MCP_SSE_URL in .env
```

### Cause
Invalid or missing Composio SSE URL.

### Solution
1. Go to https://mcp.composio.dev
2. Re-authenticate with services
3. Get fresh SSE URL
4. Update `.env`:
   ```env
   COMPOSIO_MCP_SSE_URL=https://backend.composio.dev/v3/mcp/...
   ```
5. Restart server

**Note**: This is optional - the API will work without Composio MCP.

## Invalid Anthropic API Key

### Symptom
```
anthropic.AuthenticationError: 401 Unauthorized
```

### Solution
Check your API key in `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Get a valid key from: https://console.anthropic.com/settings/keys

## Database/CSV Not Found

### Symptom
```
FileNotFoundError: Could not find contacts CSV. Tried: ...
```

### Solution
Ensure the Apollo contacts CSV exists at:
```
/Users/broomva/broomva.tech/wedi/prospector/data/apollo-contacts-export.csv
```

Or update the path in `app/tools/contact_tools.py`:
```python
CSV_PATH = Path("your/custom/path/to/contacts.csv")
```

## Agent Taking Too Long to Respond

### Symptom
Request times out or takes > 30 seconds.

### Possible Causes & Solutions

1. **Complex query with many tool calls**
   - Normal behavior for complex requests
   - Agent may be analyzing lots of data

2. **CSV file too large**
   - Use filters to limit results
   - Add pagination to queries

3. **MCP server slow**
   - Check Composio server status
   - Temporarily disable MCP by removing `COMPOSIO_MCP_SSE_URL`

## UV Installation Issues

### "uv: command not found"

**Solution**:
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Verify
uv --version
```

### Dependencies Taking Long Time

**Solution**: You're probably using pip instead of uv
```bash
# ✅ Use uv (seconds)
uv pip install -r requirements.txt

# ❌ Not pip (minutes)
pip install -r requirements.txt
```

## Server Logs Show No Errors But API Not Working

### Troubleshooting Steps

1. **Check if server is running**:
   ```bash
   curl http://localhost:8000/health
   # Should return: {"status":"healthy",...}
   ```

2. **Check correct endpoint**:
   ```bash
   # Use /chat/ with trailing slash
   curl -X POST http://localhost:8000/chat/ \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Hi"}]}'
   ```

3. **Check .env configuration**:
   ```bash
   cat .env | grep -E "API_PORT|MODEL_NAME|ANTHROPIC_API_KEY"
   ```

4. **Enable debug logging**:
   ```env
   # In .env
   LOG_LEVEL=debug
   ```
   Restart server to see detailed logs.

5. **Test with minimal query**:
   ```bash
   curl -X POST http://localhost:8000/chat/ \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Hi"}]}'
   ```

## Getting Help

If none of these solutions work:

1. Check server logs for detailed errors
2. Enable debug logging (`LOG_LEVEL=debug`)
3. Review [README.md](./README.md) for setup instructions
4. Check [UV_SETUP.md](./UV_SETUP.md) for environment issues
5. Review [COMPOSIO_MCP_SETUP.md](./docs/COMPOSIO_MCP_SETUP.md) for MCP issues

## Quick Diagnostics

Run these commands to check your setup:

```bash
# 1. Check Python version
python --version  # Should be 3.11+

# 2. Check UV
uv --version  # Should be 0.5.26+

# 3. Check packages
source .venv/bin/activate
pip list | grep -E "fastapi|langchain|deepagents|mcp"

# 4. Check environment
cat .env | grep -E "MODEL_NAME|ANTHROPIC_API_KEY|API_PORT"

# 5. Test server
curl http://localhost:8000/health

# 6. Test chat (with trailing slash!)
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hi"}]}'
```

## Common Mistakes

1. ❌ Using `/chat` instead of `/chat/` (missing trailing slash)
2. ❌ Wrong model name format: `anthropic/claude-sonnet-4-5`
3. ❌ Using `pip` instead of `uv` (much slower)
4. ❌ Not activating virtual environment
5. ❌ Forgetting to restart server after `.env` changes
6. ❌ Invalid CORS origins for Next.js frontend

---

**Most Common Fix**: Update `MODEL_NAME` in `.env` to `claude-sonnet-4-5-20250929` and restart! 🚀
