-- MRD Embeddings: storage for RAG retrieval
-- Migration 004: Vector embeddings for semantic search
-- Supports both pgvector (preferred) and JSONB fallback

-- Try to enable pgvector if available
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  RAISE NOTICE 'pgvector extension enabled';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available - using JSONB fallback';
END;
$$;

-- Create embeddings table with appropriate type
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- pgvector is available - use vector type
    EXECUTE 'CREATE TABLE IF NOT EXISTS mrd_item_embeddings (
      id SERIAL PRIMARY KEY,
      guidance_id INTEGER REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
      chunk_index INTEGER DEFAULT 0,
      chunk_text TEXT NOT NULL,
      embedding vector(1536),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(guidance_id, chunk_index)
    )';

    -- Create IVFFlat index for approximate nearest neighbor search
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_embedding_vector ON mrd_item_embeddings
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';

    RAISE NOTICE 'Created embedding table with pgvector support';
  ELSE
    -- Fallback: use JSONB to store embedding array
    CREATE TABLE IF NOT EXISTS mrd_item_embeddings (
      id SERIAL PRIMARY KEY,
      guidance_id INTEGER REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
      chunk_index INTEGER DEFAULT 0,
      chunk_text TEXT NOT NULL,
      embedding JSONB,  -- Store as JSON array [0.1, 0.2, ...]
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(guidance_id, chunk_index)
    );

    RAISE NOTICE 'Created embedding table with JSONB fallback (no vector search)';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_embedding_guidance ON mrd_item_embeddings(guidance_id);

-- Track whether pgvector is available
CREATE TABLE IF NOT EXISTS mrd_system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO mrd_system_config (key, value)
VALUES (
  'pgvector_available',
  to_jsonb(EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector'))
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
