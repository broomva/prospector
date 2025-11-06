import { mastra } from "@/mastra";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toAISdkFormat } from "@mastra/ai-sdk";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Get the prospector agent from Mastra
  const agent = mastra.getAgent("prospectorAgent");

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
}
