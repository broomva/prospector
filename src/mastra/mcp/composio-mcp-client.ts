import { MCPClient } from '@mastra/mcp';

/**
 * Composio MCP Client Configuration
 *
 * This client connects to Composio's MCP server via SSE (Server-Sent Events).
 *
 * SETUP:
 * 1. Go to https://mcp.composio.dev
 * 2. Select the tools/apps you want (e.g., Google Sheets)
 * 3. Authenticate with the service
 * 4. Copy the SSE URL provided
 * 5. Add it to your .env file as COMPOSIO_MCP_SSE_URL
 *
 * Note: The SSE URL contains authentication tokens and should be kept secure.
 * Each URL is typically tied to a single user account.
 */
export const composioMcpClient = new MCPClient({
  id: 'composio-mcp-client',
  servers: {
    googleSheets: {
      url: new URL(
        process.env.COMPOSIO_MCP_SSE_URL ||
        'https://backend.composio.dev/v3/mcp/c69416e3-cca8-4825-a67e-3ab8f35b00cc/mcp?user_id=pg-test-24bb244a-9a5e-4047-89e3-12e83f0b4f8d'
      ),
    },
    // You can add more Composio MCP servers here for different apps
    // gmail: {
    //   url: new URL(process.env.COMPOSIO_GMAIL_MCP_SSE_URL || ''),
    // },
    // slack: {
    //   url: new URL(process.env.COMPOSIO_SLACK_MCP_SSE_URL || ''),
    // },
  },
});

/**
 * For multi-tenant scenarios where each user has their own credentials,
 * you can create dynamic MCP clients per request:
 */
export function createUserComposioMcpClient(userSseUrl: string) {
  return new MCPClient({
    id: `composio-mcp-client-${Date.now()}`,
    servers: {
      composio: {
        url: new URL(userSseUrl),
      },
    },
  });
}
