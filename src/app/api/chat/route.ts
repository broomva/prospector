import { mastra } from "@/mastra";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { requireOrganization } from "@/lib/organization";
import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // 🔒 SECURITY: Require authentication and organization context
    const { userId, orgId, orgRole } = await requireOrganization();

    // Parse request body
    const { messages } = await req.json();

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Get the prospector agent from Mastra
    const agent = mastra.getAgent("prospectorAgent");

    // TODO: In the future, you can inject organization context into the agent
    // This allows the agent to scope its operations to the organization
    // Example: agent.withContext({ organizationId: orgId, userId })

    // Stream the agent's response
    const stream = await agent.stream(messages);

    // Transform stream into AI SDK format and create UI messages stream
    const uiMessageStream = createUIMessageStream({
      execute: async ({ writer }) => {
        const transformedStream = toAISdkFormat(stream, { from: "agent" })!;
        const reader = transformedStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            writer.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      },
    });

    // Create a Response that streams the UI message stream to the client
    return createUIMessageStreamResponse({
      stream: uiMessageStream,
    });
  } catch (error) {
    console.error("Error in chat API:", error);

    // Handle authentication errors
    if (error instanceof Error) {
      if (error.message.includes("required")) {
        return NextResponse.json(
          { error: "Authentication or organization context required" },
          { status: 401 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
