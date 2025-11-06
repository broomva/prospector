import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
// import { financialModelingAgent } from './agents/financial-modeling';
// import { financialModelingAgentMcp } from './agents/financial-modeling-mcp';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { HTTPException } from 'hono/http-exception';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Composio } from '@composio/core';
import { MastraProvider } from '@composio/mastra';
import { prospectorAgent } from './agents/prospector';
import { LangfuseExporter } from "@mastra/langfuse";

export const mastra = new Mastra({
  agents: { prospectorAgent },
  storage: new LibSQLStore({
    url: 'file:../../mastra.db',
  }),
  vectors: {
    default: new LibSQLVector({
      connectionUrl: 'file:../../mastra.db',
    }),
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
  server: {
    build: {
      openAPIDocs: true,
      swaggerUI: true,
      apiReqLogs: true,
    },
    middleware: [
      async (c, next) => {
        const composio = new Composio({
          provider: new MastraProvider(),
        });

        const runtimeContext = c.get('runtimeContext') as RuntimeContext<string | undefined>;

        if (!process.env.COMPOSIO_AUTH_CONFIG_ID)
          throw new HTTPException(500, {
            message: 'COMPOSIO_AUTH_CONFIG_ID missing',
          });

        // TODO: Retrieve unique user id and set it on the runtime context
        // Consider using Authentication headers for user identification
        // e.g const bearerToken = c.get('Authorization')
        // https://mastra.ai/en/docs/server-db/middleware#common-examples
        const userId = 'pg-test-24bb244a-9a5e-4047-89e3-12e83f0b4f8d';
        runtimeContext.set('userId', userId);

        // check for active/intiated connection or initiate a new connection to composio
        const connectedAccounts = await composio.connectedAccounts.list({
          authConfigIds: [process.env.COMPOSIO_AUTH_CONFIG_ID],
          userIds: [userId],
        });

        // active connection
        const activeAccount = connectedAccounts.items.find(item => item.status === 'ACTIVE');
        if (activeAccount) {
          runtimeContext.set('activeAccount', activeAccount);
          console.log('Active account found:', activeAccount);
          console.log('Runtime context:', runtimeContext);
          return await next();
        }

        // initiated connection
        const initiatedAccount = connectedAccounts.items.find(item => item.status === 'INITIATED');
        if (initiatedAccount && initiatedAccount.data?.redirectUrl) {
          runtimeContext.set('redirectUrl', initiatedAccount.data.redirectUrl);
          return await next();
        }

        // initiate a new connection to composio
        const connectionRequest = await composio.connectedAccounts.initiate(
          userId,
          process.env.COMPOSIO_AUTH_CONFIG_ID,
        );
        if (connectionRequest.redirectUrl) {
          runtimeContext.set('redirectUrl', connectionRequest.redirectUrl);
          return await next();
        }

        throw new HTTPException(500, {
          message: 'Could not connect to composio',
        });
      },
    ],
  },
  observability: {
    configs: {
      langfuse: {
        serviceName: "my-service",
        exporters: [
          new LangfuseExporter({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
            secretKey: process.env.LANGFUSE_SECRET_KEY!,
            baseUrl: process.env.LANGFUSE_BASE_URL,
            options: {
              environment: process.env.NODE_ENV,
            },
          }),
        ],
      },
    },
  },
});
