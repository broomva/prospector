import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
// import { financialModelingAgent } from './agents/financial-modeling';
// import { financialModelingAgentMcp } from './agents/financial-modeling-mcp';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { HTTPException } from 'hono/http-exception';
import { LibSQLStore } from '@mastra/libsql';
import { Composio } from '@composio/core';
import { MastraProvider } from '@composio/mastra';
import { prospectorAgent } from './agents/prospector';
import { LangfuseExporter } from "@mastra/langfuse";
import { researchAgent } from './agents/research';
import { reportAgent } from './agents/report';
import { webSummarizationAgent } from './agents/web-summary';
import { evaluationAgent } from './agents/evaluation';
import { learningExtractionAgent } from './agents/learning-extraction';

export const mastra = new Mastra({
  agents: { prospectorAgent, researchAgent, reportAgent, webSummarizationAgent, evaluationAgent, learningExtractionAgent },
  storage: new LibSQLStore({
    url: 'file:../../mastra.db',
  }),
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

        // 🔒 SECURITY: Get authenticated user ID from Clerk
        // The Clerk middleware in proxy.ts ensures this endpoint is protected
        // For Mastra server endpoints, we need to extract the user ID from Clerk session
        // TODO: When using Mastra server, implement proper Clerk session validation
        // For now, use a consistent userId format that matches our org-based approach
        const userId = 'mastra-server-user'; // Placeholder - Mastra server uses different auth flow
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
        serviceName: "prospector",
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
