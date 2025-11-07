import { MCPClient } from '@mastra/mcp';
import { PipedreamClient } from '@pipedream/sdk';

// Environment variables
const PIPEDREAM_CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID;
const PIPEDREAM_CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET;
const PIPEDREAM_PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID;
const PIPEDREAM_ENVIRONMENT = (process.env.PIPEDREAM_ENVIRONMENT || 'development') as 'development' | 'production';
const PIPEDREAM_EXTERNAL_USER_ID = process.env.PIPEDREAM_EXTERNAL_USER_ID || 'default-user';
const PIPEDREAM_APP_SLUG = process.env.PIPEDREAM_APP_SLUG || 'workflows';

/**
 * Pipedream MCP Client Configuration
 *
 * This client connects to Pipedream's MCP server for workflow automation tools.
 *
 * PIPEDREAM SETUP:
 * Required environment variables:
 * - PIPEDREAM_CLIENT_ID: Your OAuth client ID
 * - PIPEDREAM_CLIENT_SECRET: Your OAuth client secret
 * - PIPEDREAM_PROJECT_ID: Your project ID
 * - PIPEDREAM_ENVIRONMENT: 'development' or 'production' (default: development)
 * - PIPEDREAM_EXTERNAL_USER_ID: Your user ID (optional, default: 'default-user')
 * - PIPEDREAM_APP_SLUG: Integration name like 'notion', 'linear', 'workflows' (default: 'workflows')
 *
 * Get credentials at: https://pipedream.com/settings/account
 * Documentation: https://pipedream.com/docs/connect/mcp/developers
 *
 * Note: The MCP server URL format is:
 * https://remote.mcp.pipedream.net/<external-user-id>/<app-slug>
 */

/**
 * Initialize Pipedream MCP Client
 * This must be called asynchronously to obtain the access token
 */
async function createPipedreamMcpClient(): Promise<MCPClient | null> {
  if (!PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET || !PIPEDREAM_PROJECT_ID) {
    console.warn('Pipedream credentials not configured. Skipping Pipedream MCP server.');
    return null;
  }

  const pd = new PipedreamClient({
    projectEnvironment: PIPEDREAM_ENVIRONMENT,
    clientId: PIPEDREAM_CLIENT_ID,
    clientSecret: PIPEDREAM_CLIENT_SECRET,
    projectId: PIPEDREAM_PROJECT_ID,
  });

  const accessToken = await pd.rawAccessToken;
  const pipedreamUrl = `https://remote.mcp.pipedream.net/${PIPEDREAM_EXTERNAL_USER_ID}/${PIPEDREAM_APP_SLUG}`;

  return new MCPClient({
    id: 'pipedream-mcp-client',
    servers: {
      pipedream: {
        url: new URL(pipedreamUrl),
        requestInit: {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-pd-project-id': PIPEDREAM_PROJECT_ID,
            'x-pd-environment': PIPEDREAM_ENVIRONMENT,
          },
        },
      },
    },
  });
}

// Export the MCP client as a promise
export const pipedreamMcpClient = await createPipedreamMcpClient();

/**
 * For multi-tenant scenarios where each user has their own credentials,
 * you can create dynamic MCP clients per request
 */
export async function createUserPipedreamMcpClient(options: {
  clientId: string;
  clientSecret: string;
  projectId: string;
  environment?: 'development' | 'production';
  externalUserId?: string;
  appSlug?: string;
}): Promise<MCPClient> {
  const pd = new PipedreamClient({
    projectEnvironment: options.environment || 'development',
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    projectId: options.projectId,
  });

  const accessToken = await pd.rawAccessToken;
  const userId = options.externalUserId || 'default-user';
  const appSlug = options.appSlug || 'workflows';
  const pipedreamUrl = `https://remote.mcp.pipedream.net/${userId}/${appSlug}`;

  return new MCPClient({
    id: `user-pipedream-mcp-client-${Date.now()}`,
    servers: {
      pipedream: {
        url: new URL(pipedreamUrl),
        requestInit: {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-pd-project-id': options.projectId,
            'x-pd-environment': options.environment || 'development',
          },
        },
      },
    },
  });
}
