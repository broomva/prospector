# Vector Search for Contacts

This document explains the semantic vector search capability added to the Prospector agent, enabling AI-powered natural language search over the contact database.

## Overview

Vector search allows the agent to find contacts based on **semantic similarity** rather than exact keyword matches. This means queries like:

- "Find CFOs at cross-border payment companies"
- "Show me prospects working on travel booking platforms"
- "Get contacts similar to fintech infrastructure companies"

...will return relevant results even if the exact keywords don't appear in the contact data.

## How It Works

1. **Embedding Generation**: Each contact's information (title, company, industry, keywords, technologies) is converted into a 384-dimensional vector using the `BAAI/bge-small-en-v1.5` embedding model
2. **Vector Storage**: Embeddings are stored in LibSQL with vector extensions (SQLite-compatible)
3. **Semantic Search**: Query text is embedded using the same model, then similar contacts are found using cosine similarity

## Setup

### Step 0: Set OpenAI API Key

Vector search uses OpenAI's `text-embedding-3-small` model. Ensure your `.env` file contains:

```bash
OPENAI_API_KEY=sk-...
```

**Cost**: ~$0.02 per 1,000 contacts (very affordable)

### Step 1: Generate Embeddings

Before using vector search, you must generate embeddings for all contacts:

```bash
# Using npm script
bun run embeddings:generate

# Or directly
bun run src/mastra/scripts/generate-embeddings.ts
```

This process:
- Loads all contacts from the CSV
- Converts each contact to searchable text
- Generates embeddings in batches of 50 using OpenAI API
- Stores them in `data/contacts-vectors.db`

**Time**: ~1-2 minutes for 1,500 contacts (depends on API rate limits)

**Cost**: ~$0.02-0.03 for 1,500 contacts

**Storage**: ~45MB for 1,500 contacts (1536-dimensional vectors)

### Step 2: Use Vector Search

The agent now has access to the `vectorSearchContacts` tool:

```typescript
// Example agent query
"Find contacts similar to fintech payment companies"

// The agent will use:
vectorSearchContacts({
  query: "fintech payment companies",
  topK: 20,
  minScore: 0.3,
  fieldPreset: "summary",
  additionalFilters: {
    minQualityScore: 70,
    isExecutive: true,
    country: "Colombia"
  }
})
```

## Architecture

### Files Created

```
src/mastra/
├── lib/
│   └── vector-store.ts          # Vector store initialization and helpers
├── scripts/
│   └── generate-embeddings.ts   # Script to generate and upsert embeddings
└── tools/
    └── contact.ts               # vectorSearchContactsTool added

data/
└── contacts-vectors.db          # LibSQL database with vector index
```

### Key Components

#### 1. Vector Store (`src/mastra/lib/vector-store.ts`)

```typescript
// Initialize vector store
const vectorStore = getVectorStore();

// Configuration
const CONTACT_VECTOR_CONFIG = {
  indexName: 'contacts_embeddings',
  dimension: 384,
  metric: 'cosine'
};

// Convert contact to searchable text
const text = contactToText(contact);
```

#### 2. Embedding Generation (`src/mastra/scripts/generate-embeddings.ts`)

- Processes contacts in batches of 50
- Uses `@mastra/fastembed` for local, lightweight embeddings
- No API calls required - runs entirely offline
- Creates/updates the vector index automatically

#### 3. Vector Search Tool (`vectorSearchContactsTool`)

**Input Parameters:**
- `query` (string): Natural language search query
- `topK` (number, default 20): Number of results to return
- `minScore` (number, default 0.3): Minimum similarity threshold (0-1)
- `fieldPreset` (enum): Fields to return (minimal/summary/detailed/full)
- `additionalFilters` (object): Post-search filters
  - `minQualityScore`: Filter by quality score
  - `isExecutive`: Filter executives only
  - `country`: Filter by country
  - `contactState`: Filter by contact state

**Output:**
- `contacts`: Array of matching contacts (with similarity scores)
- `totalMatched`: Number of contacts found
- `searchQuery`: The query used
- `avgSimilarityScore`: Average similarity across results

## Use Cases

### 1. Exploratory Search
When you don't know exact keywords:

```
"Find prospects working on payment orchestration for Latin America"
```

### 2. Semantic Similarity
Find contacts similar to known good prospects:

```
"Show me contacts similar to Stripe and Rappi"
```

### 3. Conceptual Queries
Search by concepts, not exact matches:

```
"CFOs at companies doing cross-border money movement"
```

### 4. Combined with Filters
Narrow results with structured filters:

```
vectorSearchContacts({
  query: "travel booking platforms",
  topK: 50,
  minScore: 0.4,
  additionalFilters: {
    country: "Colombia",
    minQualityScore: 70,
    isExecutive: true
  }
})
```

## Comparison with Other Search Tools

| Tool | Best For | Example |
|------|----------|---------|
| **vectorSearchContacts** | Semantic/exploratory queries | "Find fintech payment companies" |
| **searchByEnrichment** | Keyword matching across fields | "payments" OR "fintech" in keywords |
| **searchCompanies** | Batch company name search | Find contacts from ["Stripe", "Square"] |
| **queryContacts** | Complex structured filters | executives in Colombia with score >= 70 |

## Performance

- **Embedding generation**: ~1-2 minutes for 1,500 contacts (API rate limited)
- **Search query**: <1 second (includes real-time query embedding)
- **Storage**: ~30KB per contact (1536-dim embeddings + metadata)
- **Cost**: ~$0.02 for 1,500 contacts (generation) + ~$0.0001 per query

## Limitations

1. **Embedding regeneration**: If contact data changes, re-run the script
2. **Dimension mismatch**: Don't change the embedding model without regenerating all embeddings
3. **Query length**: Best results with 5-50 word queries
4. **Language**: Optimized for English text

## Technical Details

### Embedding Model

- **Model**: OpenAI `text-embedding-3-small`
- **Dimension**: 1536
- **Provider**: OpenAI (API-based)
- **Speed**: ~50-100 embeddings/second (rate limited)
- **Cost**: $0.02 per 1,000 contacts

### Vector Database

- **Storage**: LibSQL (SQLite fork with vector extensions)
- **Metric**: Cosine similarity
- **Index**: Automatically created on first run

### Text Preparation

Each contact is converted to text format:

```
John Doe. Title: CFO. Company: Stripe. Industry: Financial Services.
Seniority: Executive. Location: Colombia.
Keywords: payments, fintech, cross-border.
Technologies: Stripe, AWS, PostgreSQL.
```

## Troubleshooting

### "Vector index not found" Error

```bash
# Run the embedding generation script
bun run embeddings:generate
```

### Out of Date Embeddings

If you've updated contact data:

```bash
# Regenerate all embeddings
bun run embeddings:generate
```

The script will upsert (update or insert) embeddings, so it's safe to re-run.

### Low Similarity Scores

- Try lowering `minScore` (default 0.3)
- Use more descriptive queries
- Check if the concept exists in your contact data

### Slow Performance

- Reduce `topK` (fewer results = faster)
- Use `fieldPreset: 'minimal'` for smaller payloads
- Check database file isn't on network storage

## Future Enhancements

Potential improvements:

1. **Hybrid search**: Combine vector + keyword search
2. **Reranking**: Use a larger model to rerank top results
3. **Incremental updates**: Only embed new/changed contacts
4. **Multi-model**: Support different embedding models
5. **Query expansion**: Automatically expand queries for better recall

## Resources

- [LibSQL Vector Documentation](https://mastra.ai/reference/vectors/libsql)
- [FastEmbed Model Info](https://qdrant.github.io/fastembed/)
- [BAAI/bge-small-en-v1.5 on Hugging Face](https://huggingface.co/BAAI/bge-small-en-v1.5)
