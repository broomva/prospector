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
    const { messages, threadId } = await req.json();

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Get the prospector agent from Mastra
    const agent = mastra.getAgent("prospectorAgent");

    // 🎯 MEMORY CONTEXT INJECTION
    // Inject organization and user context into the agent's memory system
    // This enables:
    // 1. Thread-scoped memory: Each conversation thread maintains its own context
    // 2. Resource-scoped memory: Organization-level persistence across threads
    // 3. Working memory: Agent remembers user preferences, goals, and context
    // 4. Semantic recall: RAG-based retrieval of relevant past conversations
    //
    // Memory hierarchy:
    // - thread: Unique conversation ID (client-generated or default to userId)
    // - resource: Organization ID (all threads in org share this resource context)
    const memoryContext = {
      thread: threadId || `thread-${userId}-${Date.now()}`, // Unique per conversation
      resource: orgId, // Shared across org's conversations
    };

    // Stream the agent's response with memory context
    const stream = await agent.stream(messages, {
      memory: memoryContext,
    });

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
