import { mastra } from "@/mastra";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Get the prospector agent from Mastra
  const agent = mastra.getAgent("prospectorAgent");

  // Stream the agent's response with AI SDK v5 format for assistant-ui compatibility
  const result = await agent.stream(messages, {
    format: "aisdk",
  });

  return result.toUIMessageStreamResponse();
}
