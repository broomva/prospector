"""Message schemas for the chat API."""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single chat message."""

    role: str = Field(..., description="Role of the message sender (user, assistant, system)")
    content: str = Field(..., description="Content of the message")


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""

    messages: List[ChatMessage] = Field(
        ...,
        description="List of messages in the conversation",
        min_length=1
    )
    thread_id: Optional[str] = Field(
        None,
        description="Optional thread ID for conversation continuity"
    )
    stream: bool = Field(
        False,
        description="Whether to stream the response"
    )
    max_tokens: Optional[int] = Field(
        None,
        description="Maximum tokens to generate",
        ge=1,
        le=100000
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "messages": [
                        {
                            "role": "user",
                            "content": "Find me 10 high-quality CFOs at SaaS companies in Colombia"
                        }
                    ],
                    "stream": False
                }
            ]
        }
    }


class ChatResponse(BaseModel):
    """Response from the chat endpoint."""

    response: str = Field(..., description="Agent's response text")
    thread_id: str = Field(..., description="Thread ID for this conversation")
    messages: List[ChatMessage] = Field(..., description="Full conversation history")
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional metadata about the response"
    )


class StreamChunk(BaseModel):
    """A chunk of streamed response."""

    content: str = Field(..., description="Content chunk")
    done: bool = Field(False, description="Whether this is the final chunk")
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional metadata"
    )
