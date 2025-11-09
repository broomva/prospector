# Composio MCP Integration Setup

This guide explains how to set up and use Composio's Model Context Protocol (MCP) integration with your Prospector API, enabling access to 100+ external tools like Google Sheets, Slack, Gmail, and more.

## What is Composio MCP?

Composio MCP is a managed MCP server that provides:
- **100+ Tool Integrations**: Google Workspace, Slack, GitHub, Notion, and more
- **Unified Authentication**: Single sign-on for all your tools
- **Real-time Access**: Tools are available instantly via Server-Sent Events (SSE)
- **Managed Infrastructure**: No need to host your own MCP servers

## Quick Setup

### 1. Get Your SSE URL

1. Go to [https://mcp.composio.dev](https://mcp.composio.dev)
2. Select the tools/apps you want to integrate (e.g., Google Sheets, Slack)
3. Authenticate with each service
4. Copy the SSE URL provided
5. Add it to your `.env` file:

```env
COMPOSIO_MCP_SSE_URL=https://backend.composio.dev/v3/mcp/<your-id>/mcp?user_id=<your-user-id>
```

### 2. Restart Your Server

```bash
# The server will automatically load Composio tools on startup
python run.py
```

That's it! Your agent now has access to all Composio tools.

## Verifying Integration

### Check Available Tools

When the server starts, it will log the tools it loaded:

```
INFO:     Starting Prospector API...
INFO:     Model: anthropic/claude-sonnet-4-5
INFO:     Loaded 3 contact tools
INFO:     Loaded 15 Composio MCP tools
INFO:     Total tools available: 18
```

### Test with a Query

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "List the available tools you have access to"
      }
    ]
  }'
```

The agent should list both contact tools and Composio tools.

## Available Composio Tools

Common tools available via Composio MCP:

### Google Workspace
- **Google Sheets**: Read, write, and manage spreadsheets
- **Gmail**: Send emails, read inbox, manage labels
- **Google Calendar**: Create events, check availability
- **Google Drive**: Upload, download, share files

### Communication
- **Slack**: Send messages, create channels, manage users
- **Discord**: Post to channels, manage servers
- **Telegram**: Send messages, manage bots

### Development
- **GitHub**: Create issues, manage PRs, commit code
- **GitLab**: Similar GitHub functionality
- **Jira**: Create tickets, manage sprints

### Productivity
- **Notion**: Create pages, update databases
- **Airtable**: Manage records, query tables
- **Trello**: Create cards, move between lists

### CRM & Sales
- **HubSpot**: Manage contacts, deals, tasks
- **Salesforce**: Access CRM data
- **Pipedrive**: Manage sales pipeline

And 80+ more...

## Example Use Cases

### 1. Export Prospects to Google Sheets

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find 20 high-quality CFOs at SaaS companies in Colombia and export them to a Google Sheet"
      }
    ]
  }'
```

The agent will:
1. Use `query_contacts_tool` to find CFOs
2. Use `google_sheets_create` to create a new sheet
3. Use `google_sheets_append` to add the contact data

### 2. Send Slack Notifications

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find prospects interested in fintech and send a summary to #sales-team on Slack"
      }
    ]
  }'
```

### 3. Create GitHub Issues from Prospects

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "For each executive at travel companies, create a GitHub issue with their contact info and suggested outreach"
      }
    ]
  }'
```

## Multi-Tenant Setup

If you need per-user Composio credentials (multi-tenant):

### 1. Get User-Specific SSE URLs

Each user should:
1. Go to https://mcp.composio.dev
2. Authenticate with their own credentials
3. Get their unique SSE URL

### 2. Pass SSE URL in Request

Modify your chat endpoint to accept user SSE URLs:

```python
# In your route handler
from app.mcp.composio_client import create_user_composio_client

# Get user's SSE URL from request headers or database
user_sse_url = request.headers.get("X-Composio-SSE-URL")

# Create user-specific tools
user_tools = create_user_composio_client(user_sse_url)

# Create agent with user's tools
agent = create_deep_agent(tools=base_tools + user_tools, ...)
```

## Refreshing Tools

If you add new tools in Composio without restarting the server:

```python
from app.mcp import refresh_composio_tools

# Force refresh tools
tools = await refresh_composio_tools()
```

Or create an API endpoint:

```python
# app/routes/admin.py
@router.post("/refresh-mcp")
async def refresh_mcp_tools():
    """Refresh Composio MCP tools without restarting."""
    tools = await refresh_composio_tools()
    return {"message": f"Refreshed {len(tools)} tools"}
```

## Troubleshooting

### "Could not connect to Composio MCP server"

**Cause**: Invalid or expired SSE URL

**Solution**:
1. Go to https://mcp.composio.dev
2. Re-authenticate with services
3. Get a fresh SSE URL
4. Update `.env` file
5. Restart server

### "No Composio tools loaded"

**Cause**: `COMPOSIO_MCP_SSE_URL` not set in `.env`

**Solution**:
```bash
# Check if variable is set
grep COMPOSIO_MCP_SSE_URL .env

# If not, add it
echo 'COMPOSIO_MCP_SSE_URL=your-sse-url' >> .env
```

### "Rate limit exceeded"

**Cause**: Too many MCP tool calls

**Solution**:
- Composio has rate limits per plan
- Upgrade plan at https://composio.dev/pricing
- Or implement caching for repeated calls

### Agent doesn't use Composio tools

**Cause**: Tools not visible or not relevant to query

**Solution**:
1. Ask agent to list available tools: "What tools do you have?"
2. Be explicit: "Use Google Sheets to export these contacts"
3. Check tool names in logs: some tools have specific names

## Security Best Practices

### 1. Secure SSE URLs

SSE URLs contain authentication tokens. **Never**:
- Commit them to Git
- Share them publicly
- Send them in plain text

**Always**:
- Store in `.env` files (git-ignored)
- Use environment variables
- Rotate regularly

### 2. Limit Tool Access

In Composio dashboard:
- Only enable tools you need
- Review permissions for each tool
- Use read-only access when possible

### 3. Monitor Usage

- Check Composio dashboard for usage
- Set up alerts for anomalies
- Review audit logs regularly

## Advanced: Custom MCP Servers

You can also connect to your own MCP servers:

```python
# app/mcp/custom_server.py
from langchain_mcp_adapters import create_tools_from_mcp

# Connect to local MCP server via stdio
tools = await create_tools_from_mcp(
    command="node",
    args=["path/to/your/mcp-server.js"],
    transport="stdio"
)

# Or remote HTTP/SSE server
tools = await create_tools_from_mcp(
    url="https://your-mcp-server.com/sse",
    transport="sse"
)
```

## Next Steps

1. ✅ Set up Composio MCP
2. 📊 Export contacts to Google Sheets
3. 💬 Send Slack notifications
4. 🔄 Create automation workflows
5. 📧 Integrate with email tools
6. 🎯 Build custom MCP servers

## Resources

- [Composio MCP Documentation](https://docs.composio.dev/mcp)
- [MCP Specification](https://modelcontextprotocol.io)
- [LangChain MCP Adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
- [Composio Dashboard](https://mcp.composio.dev)
- [Available Tools List](https://docs.composio.dev/tools)

## Support

Need help?
- Composio Discord: https://discord.gg/composio
- GitHub Issues: https://github.com/composio-dev/composio/issues
- Documentation: https://docs.composio.dev
