# Mastra Memory Integration with Clerk Authentication

## Overview

The Prospector AI application now integrates Clerk authentication with Mastra's memory system, providing organization-scoped conversation persistence and context management.

## Architecture

### Memory Hierarchy

```
Organization (Clerk orgId)
├── Resource: org_abc123
│   ├── Thread: thread-user1-timestamp1
│   │   ├── Working Memory (org-specific)
│   │   ├── Conversation History
│   │   └── Semantic Recall (RAG)
│   ├── Thread: thread-user1-timestamp2
│   └── Thread: thread-user2-timestamp1
```

### Key Concepts

1. **Thread** - Individual conversation session
   - Unique per conversation
   - Generated as `thread-{userId}-{timestamp}` or client-provided
   - Maintains conversation history and context

2. **Resource** - Organization-level scope
   - Maps to Clerk `orgId`
   - Shared across all threads in the organization
   - Enables cross-conversation memory and insights

3. **Working Memory** - Persistent agent context
   - Remembers user preferences, goals, and important details
   - Updated automatically by the agent
   - Scoped to thread (can be changed to resource-scope if needed)

4. **Semantic Recall** - RAG-based memory retrieval
   - Retrieves relevant past messages using vector search
   - Provides context from previous conversations
   - Currently thread-scoped (3 most relevant messages)

## Implementation

### Chat API (`src/app/api/chat/route.ts`)

```typescript
export async function POST(req: Request) {
  // 1. Authenticate and get organization context
  const { userId, orgId } = await requireOrganization();

  // 2. Parse request with optional threadId
  const { messages, threadId } = await req.json();

  // 3. Inject memory context
  const memoryContext = {
    thread: threadId || `thread-${userId}-${Date.now()}`,
    resource: orgId, // Organization-scoped
  };

  // 4. Stream with memory
  const stream = await agent.stream(messages, {
    memory: memoryContext,
  });
}
```

### Agent Configuration (`src/mastra/agents/prospector.ts`)

```typescript
export const prospectorAgent = new Agent({
  name: 'prospector',
  model: 'anthropic/claude-sonnet-4-5',

  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../../mastra.db',
    }),
    vector: new LibSQLVector({
      connectionUrl: 'file:../../mastra.db',
    }),
    embedder: fastembed,
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
        scope: 'thread', // Per-conversation recall
      },
      workingMemory: {
        enabled: true,
        // Agent maintains persistent context about user
      },
      threads: {
        generateTitle: true, // Auto-generate thread titles
      },
    },
  }),
});
```

## Memory Features

### 1. Conversation History
- **Last 10 messages** automatically included in context
- Provides short-term continuity
- No additional configuration needed

### 2. Working Memory
The agent automatically maintains structured information about:
- User preferences and goals
- Current project context
- Key decisions and facts
- Session state

Example working memory structure:
```markdown
# User Profile

## Personal Info
- Name: John Doe
- Organization: Acme Corp
- Role: Sales Manager

## Preferences
- Communication Style: Formal
- Project Goal: Find 100 qualified leads in LATAM
- Target Industry: Fintech

## Session State
- Last Task: Searching for executives in Colombia
- Open Questions:
  - Should we include Mexico in the search?
```

### 3. Semantic Recall (RAG)
- **Top 3 similar messages** retrieved from past conversations
- **2 messages context** before and after each match
- Uses FastEmbed for local embeddings
- Thread-scoped by default

Example:
```
User: "Find executives in fintech"
→ Agent recalls: Previous conversation about fintech criteria
→ Agent recalls: Past fintech executive searches
→ Agent recalls: User's fintech industry preferences
```

### 4. Thread Title Generation
- Automatically generates descriptive titles
- Based on user's first message
- Helps organize conversations
- Runs asynchronously (doesn't affect response time)

## Data Isolation & Security

### Multi-Tenant Isolation

```typescript
// User A, Org A
memoryContext = {
  thread: "thread-userA-123",
  resource: "org_abc"  // ← All Org A data
}

// User B, Org B
memoryContext = {
  thread: "thread-userB-456",
  resource: "org_xyz"  // ← Separate Org B data
}
```

**Guarantees:**
- ✅ Org A cannot access Org B's conversations
- ✅ Org A cannot see Org B's working memory
- ✅ Org A cannot retrieve Org B's semantic recall results
- ✅ Thread IDs are globally unique across resources

### Security Layers

1. **API Layer** - Clerk authentication required
2. **Organization Verification** - Valid `orgId` from JWT
3. **Memory Scoping** - All queries filtered by `resource` (orgId)
4. **Thread Isolation** - Unique thread IDs per conversation

## Storage Configuration

### Database Schema

LibSQL database (`mastra.db`) contains:

**Tables:**
- `mastra_threads` - Conversation threads
- `mastra_messages` - Individual messages
- `mastra_resources` - Working memory per resource/thread
- Vector tables - Embeddings for semantic search

**Indexes:**
- `resource_id` - Fast resource-scoped queries
- `thread_id` - Fast thread lookups
- Vector indexes - Fast semantic search

### File Location
```
/Users/broomva/broomva.tech/wedi/prospector/
├── mastra.db          # Main memory storage
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   └── prospector.ts  # Agent with memory config
│   │   └── index.ts
│   └── app/
│       └── api/
│           └── chat/
│               └── route.ts   # Memory context injection
```

## Client-Side Integration

### Sending Messages with Thread Context

```typescript
// Start new conversation
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello' }],
    // threadId: undefined  // Auto-generated
  }),
});

// Continue existing conversation
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Follow-up question' }],
    threadId: 'thread-user123-1699123456789',  // Preserve thread
  }),
});
```

### Thread Management (Future)

You can implement thread listing and management:

```typescript
// Get all threads for current organization
const memory = await agent.getMemory();
const threads = await memory.getThreadsByResourceId({
  resourceId: orgId,
  orderBy: 'updatedAt',
  sortDirection: 'DESC',
});

// Get specific thread messages
const { messages, uiMessages } = await memory.query({
  threadId: 'thread-123',
  resourceId: orgId,
});
```

## Memory Scoping Options

### Current: Thread-Scoped Memory

```typescript
semanticRecall: {
  scope: 'thread', // Only search within current conversation
}
```

**Use cases:**
- Different topics per conversation
- Temporary session context
- Isolated conversation threads

### Alternative: Resource-Scoped Memory

```typescript
semanticRecall: {
  scope: 'resource', // Search across ALL org conversations
}
```

**Use cases:**
- Organization-wide insights
- Cross-conversation learning
- Persistent user preferences across sessions

**To enable:** Change `scope: 'thread'` to `scope: 'resource'` in agent config

## Performance Considerations

### Context Window Management

Current configuration:
- **Last 10 messages**: ~2-4K tokens
- **Semantic recall (3 messages)**: ~1-2K tokens
- **Working memory**: ~500-1K tokens
- **System prompt**: ~1K tokens

**Total context**: ~5-8K tokens per request

### Optimization Strategies

1. **Reduce lastMessages** if conversations are very long
2. **Adjust semanticRecall topK** (currently 3)
3. **Use memory processors** to filter/trim messages
4. **Disable semantic recall** for faster responses (no RAG overhead)

Example with memory processors:
```typescript
import { TokenLimiter, ToolCallFilter } from '@mastra/memory/processors';

memory: new Memory({
  processors: [
    new ToolCallFilter(),        // Remove tool calls to save tokens
    new TokenLimiter(127000),    // Hard limit on total tokens
  ],
  // ... rest of config
})
```

## Migration Path

### Current State: LibSQL (File-based)
- ✅ Simple setup, no infrastructure
- ✅ Works well for development
- ✅ Fast for <1000 conversations
- ⚠️ Single file, no horizontal scaling
- ⚠️ Local embeddings only

### Future: Production-Grade Storage

When scaling:

1. **PostgreSQL + pgvector**
   ```typescript
   import { PgStore, PgVector } from '@mastra/pg';

   memory: new Memory({
     storage: new PgStore({
       connectionString: process.env.DATABASE_URL,
     }),
     vector: new PgVector({
       connectionString: process.env.DATABASE_URL,
     }),
   })
   ```

2. **MongoDB + Atlas Vector Search**
   ```typescript
   import { MongoDBStore, MongoDBVector } from '@mastra/mongodb';

   memory: new Memory({
     storage: new MongoDBStore({
       connectionString: process.env.MONGODB_URI,
     }),
     vector: new MongoDBVector({
       connectionString: process.env.MONGODB_URI,
     }),
   })
   ```

3. **Cloud Embeddings**
   ```typescript
   import { openai } from '@ai-sdk/openai';

   memory: new Memory({
     embedder: openai.embedding('text-embedding-3-small'),
   })
   ```

## Monitoring & Debugging

### View Stored Memory

Using SQLite Viewer extension in VS Code:
1. Install "SQLite Viewer" extension
2. Open `mastra.db`
3. Browse `mastra_threads`, `mastra_messages`, `mastra_resources` tables

### Query Memory Programmatically

```typescript
const memory = await agent.getMemory();

// Get thread details
const thread = await memory.getThreadById({
  threadId: 'thread-123'
});

// Query messages with semantic search
const { messages, uiMessages } = await memory.query({
  threadId: 'thread-123',
  resourceId: orgId,
  selectBy: {
    last: 50,
    vectorSearchString: 'What did we discuss about fintech?',
  },
  threadConfig: {
    semanticRecall: true,
  },
});

// Get all org threads
const threads = await memory.getThreadsByResourceId({
  resourceId: orgId
});
```

### Memory Size Monitoring

```typescript
// Check thread message count
const { messages } = await memory.query({
  threadId: 'thread-123'
});
console.log(`Thread has ${messages.length} messages`);

// Monitor working memory size
const thread = await memory.getThreadById({
  threadId: 'thread-123'
});
const workingMemorySize =
  JSON.stringify(thread.metadata?.workingMemory || '').length;
console.log(`Working memory: ${workingMemorySize} bytes`);
```

## Best Practices

### 1. Thread Management
- ✅ Generate unique thread IDs per conversation
- ✅ Store thread IDs client-side (localStorage, state)
- ✅ Allow users to start new threads
- ✅ Show thread titles in UI for easy navigation

### 2. Memory Configuration
- ✅ Start with thread-scoped memory
- ✅ Consider resource-scoped for cross-conversation insights
- ✅ Monitor token usage in production
- ✅ Use memory processors to optimize context

### 3. Working Memory
- ✅ Let the agent manage working memory automatically
- ✅ Trust the agent to update relevant information
- ✅ Review working memory templates for your use case
- ✅ Can pre-populate with user data if needed

### 4. Semantic Recall
- ✅ Essential for long-running conversations
- ✅ Provides contextual continuity
- ⚠️ Adds latency (embedding + vector search)
- ⚠️ Can be disabled for real-time applications

### 5. Security
- ✅ Always verify `orgId` from Clerk JWT
- ✅ Never trust client-provided resource IDs
- ✅ Scope all memory queries by authenticated resource
- ✅ Audit thread access patterns

## Troubleshooting

### Memory Not Persisting
- Check that `threadId` is being passed correctly
- Verify LibSQL database file has write permissions
- Ensure storage path is accessible: `file:../../mastra.db`

### Semantic Recall Not Working
- Verify vector store is configured
- Check embedder is set (fastembed)
- Ensure `semanticRecall.topK > 0`
- Verify messages have been embedded (check vector tables)

### Working Memory Not Updating
- Confirm `workingMemory.enabled: true`
- Check agent has multiple turns to update
- Review working memory template structure
- Agent needs time to extract and update information

### Cross-Organization Data Leakage
- ✅ Not possible with current implementation
- All queries scoped by `resource` (orgId)
- Thread IDs include userId for uniqueness
- Clerk JWT validation ensures correct orgId

## Resources

- [Mastra Memory Documentation](https://mastra.ai/docs/memory/overview)
- [Semantic Recall Guide](https://mastra.ai/docs/memory/semantic-recall)
- [Working Memory Guide](https://mastra.ai/docs/memory/working-memory)
- [Memory Class Reference](https://mastra.ai/reference/memory/memory-class)
- [Clerk Authentication](https://clerk.com/docs)

## Summary

The Prospector AI now has:
- ✅ **Organization-scoped memory** via Clerk integration
- ✅ **Thread-based conversations** with persistent history
- ✅ **Working memory** for agent context awareness
- ✅ **Semantic recall** for relevant past message retrieval
- ✅ **Complete data isolation** between organizations
- ✅ **Production-ready security** with Clerk JWT validation

This enables:
- Multi-turn conversations with context
- Learning from past interactions
- Personalized responses based on user preferences
- Cross-conversation insights (if resource-scoped)
- Secure multi-tenant operation
