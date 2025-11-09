"""Chat endpoints for the prospector agent."""

import uuid
from typing import AsyncIterator
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.schemas import ChatRequest, ChatResponse, StreamChunk
from app.agents import create_prospector_agent, create_prospector_agent_async


router = APIRouter(prefix="/chat", tags=["chat"])

# Global agent instance (singleton)
_agent = None
_agent_with_mcp = None


def get_agent():
    """Get or create the prospector agent (basic version without MCP tools)."""
    global _agent
    if _agent is None:
        _agent = create_prospector_agent()
    return _agent


async def get_agent_async():
    """Get or create the prospector agent with MCP tools (async version)."""
    global _agent_with_mcp
    if _agent_with_mcp is None:
        _agent_with_mcp = await create_prospector_agent_async()
    return _agent_with_mcp


def convert_to_langchain_messages(messages: list):
    """Convert API messages to LangChain format."""
    lc_messages = []
    for msg in messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))
        elif msg.role == "system":
            lc_messages.append(SystemMessage(content=msg.content))
    return lc_messages


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with the prospector agent.

    This endpoint accepts a list of messages and returns the agent's response.
    The agent has access to tools for querying contacts, getting stats, and
    performing semantic search.

    Example request:
    ```json
    {
        "messages": [
            {
                "role": "user",
                "content": "Find me 10 high-quality CFOs at SaaS companies in Colombia"
            }
        ]
    }
    ```
    """
    try:
        # Use async agent to get MCP tools
        agent = await get_agent_async()

        # Generate thread ID if not provided
        thread_id = request.thread_id or str(uuid.uuid4())

        # Convert messages to LangChain format
        lc_messages = convert_to_langchain_messages(request.messages)

        # Invoke the agent
        response = await agent.ainvoke({
            "messages": lc_messages
        })

        # Extract the response message
        output_messages = response.get("messages", [])
        if not output_messages:
            raise HTTPException(status_code=500, detail="No response from agent")

        # Get the last message (agent's response)
        last_message = output_messages[-1]
        response_content = last_message.content if hasattr(last_message, 'content') else str(last_message)

        # Build response
        all_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        all_messages.append({
            "role": "assistant",
            "content": response_content
        })

        return ChatResponse(
            response=response_content,
            thread_id=thread_id,
            messages=all_messages,
            metadata={
                "model": "anthropic/claude-sonnet-4-5",
                "steps": len(output_messages),
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat request: {str(e)}"
        )


async def stream_agent_response(request: ChatRequest) -> AsyncIterator[str]:
    """Stream the agent's response."""
    try:
        # Use async agent to get MCP tools
        agent = await get_agent_async()

        # Convert messages to LangChain format
        lc_messages = convert_to_langchain_messages(request.messages)

        # Stream the agent's response
        async for chunk in agent.astream({
            "messages": lc_messages
        }):
            # Extract content from chunk
            if isinstance(chunk, dict) and "messages" in chunk:
                messages = chunk["messages"]
                if messages:
                    last_msg = messages[-1]
                    content = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)

                    stream_chunk = StreamChunk(
                        content=content,
                        done=False
                    )
                    yield f"data: {stream_chunk.model_dump_json()}\n\n"

        # Send final chunk
        final_chunk = StreamChunk(content="", done=True)
        yield f"data: {final_chunk.model_dump_json()}\n\n"

    except Exception as e:
        error_chunk = StreamChunk(
            content=f"Error: {str(e)}",
            done=True,
            metadata={"error": True}
        )
        yield f"data: {error_chunk.model_dump_json()}\n\n"


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """Stream chat responses from the prospector agent.

    This endpoint streams the agent's response in real-time using Server-Sent Events (SSE).
    Each chunk is sent as a JSON object with the content and a 'done' flag.
    """
    return StreamingResponse(
        stream_agent_response(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
