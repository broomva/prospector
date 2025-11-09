"""Composio MCP Client for Python/LangChain integration.

This module provides integration with Composio's MCP (Model Context Protocol) server,
allowing the agent to access external tools like Google Sheets, Slack, Gmail, etc.

Setup:
1. Go to https://mcp.composio.dev
2. Select the tools/apps you want to integrate
3. Authenticate with the service
4. Copy the SSE URL provided
5. Add it to your .env file as COMPOSIO_MCP_SSE_URL

Note: The SSE URL contains authentication tokens and should be kept secure.
"""

import os
from typing import List, Optional
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_mcp_adapters.sessions import create_session
from app.core import settings


# Cache for MCP tools to avoid reconnecting on every request
_cached_tools: Optional[List[BaseTool]] = None


async def get_composio_tools() -> List[BaseTool]:
    """Get tools from Composio MCP server via SSE.

    This function connects to the Composio MCP server using Server-Sent Events (SSE)
    and retrieves all available tools. The tools are cached after the first fetch.

    Returns:
        List of LangChain tools available from Composio MCP server.

    Raises:
        ValueError: If COMPOSIO_MCP_SSE_URL is not set in environment.
        Exception: If connection to MCP server fails.
    """
    global _cached_tools

    # Return cached tools if available
    if _cached_tools is not None:
        return _cached_tools

    # Get SSE URL from environment
    sse_url = os.getenv("COMPOSIO_MCP_SSE_URL")
    if not sse_url:
        # Return empty list if not configured (optional integration)
        return []

    try:
        # Create session to MCP server using SSE transport
        async with create_session(sse_url, "sse") as session:
            # Load all tools from the MCP server
            tools = await load_mcp_tools(session)

            # Cache the tools for future requests
            _cached_tools = tools

            return tools

    except Exception as e:
        # Log error but don't fail - MCP is optional
        print(f"Warning: Could not connect to Composio MCP server: {e}")
        print("Continuing without Composio tools. Check COMPOSIO_MCP_SSE_URL in .env")
        return []


async def create_user_composio_client(user_sse_url: str) -> List[BaseTool]:
    """Create a per-user Composio MCP client for multi-tenant scenarios.

    Use this when each user has their own Composio credentials/SSE URL.

    Args:
        user_sse_url: The user-specific SSE URL from Composio

    Returns:
        List of LangChain tools for this specific user.
    """
    try:
        async with create_session(user_sse_url, "sse") as session:
            tools = await load_mcp_tools(session)
            return tools
    except Exception as e:
        print(f"Error creating user Composio client: {e}")
        return []


async def refresh_composio_tools() -> List[BaseTool]:
    """Force refresh of Composio tools from MCP server.

    Use this if you've added new tools/apps in Composio and want to refresh
    without restarting the server.

    Returns:
        Updated list of tools from Composio.
    """
    global _cached_tools
    _cached_tools = None  # Clear cache
    return await get_composio_tools()
