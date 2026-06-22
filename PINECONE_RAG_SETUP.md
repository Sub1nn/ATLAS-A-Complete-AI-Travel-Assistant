# Pinecone RAG Setup

ATLAS stores document ownership, metadata and fallback chunks in MongoDB. Pinecone is optional and adds semantic retrieval inside a namespace derived from the authenticated user ID.

## Recommended setup

Add the following values to `backend/.env`:

```env
PINECONE_ENABLED=true
PINECONE_API_KEY=your_real_key
PINECONE_INDEX_NAME=atlas-documents
PINECONE_INDEX_MODE=inference
PINECONE_EMBEDDING_MODEL=llama-text-embed-v2
PINECONE_EMBEDDING_DIMENSIONS=1024
PINECONE_NAMESPACE_PREFIX=atlas-user
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
```

From `backend/`, create or inspect the index:

```bash
npm run pinecone:setup
```

The script creates a serverless cosine index in inference mode and waits until it is ready. Running it again is safe and reports the existing index.

## Integrated mode

`PINECONE_INDEX_MODE=integrated` expects an existing Pinecone index configured with a compatible embedding model and text field. Create that index in Pinecone first, then set:

```env
PINECONE_INDEX_MODE=integrated
PINECONE_TEXT_FIELD=text
PINECONE_INDEX_NAME=your-integrated-index
```

## Failure behavior

If Pinecone is disabled or unavailable, uploads remain usable through MongoDB-backed local retrieval. The document list reports whether each file is indexed, skipped or failed. Do not delete MongoDB document records after indexing; they remain the ownership and fallback source of truth.

## Production checks

- Restrict the Pinecone key to the intended project.
- Keep one namespace prefix per environment.
- Confirm the configured dimensions match the index.
- Monitor indexing failures and Pinecone usage.
- Test deletion so document vectors are removed with document metadata.
