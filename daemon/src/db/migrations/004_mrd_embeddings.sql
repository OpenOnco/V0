-- MRD Embeddings: pgvector storage for RAG retrieval
-- Migration 004: Vector embeddings for semantic search

-- Enable pgvector extension (requires superuser or extension already installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Embeddings table for guidance items
CREATE TABLE mrd_item_embeddings (
  id SERIAL PRIMARY KEY,
  guidance_id INTEGER REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  chunk_index INTEGER DEFAULT 0,      -- For long items split into chunks
  chunk_text TEXT NOT NULL,           -- The text that was embedded
  embedding vector(1536),             -- OpenAI ada-002 dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guidance_id, chunk_index)
);

-- IVFFlat index for approximate nearest neighbor search
-- Note: lists parameter should be sqrt(n) where n is expected row count
-- Starting with 100, should be adjusted as data grows
CREATE INDEX idx_embedding_vector ON mrd_item_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_embedding_guidance ON mrd_item_embeddings(guidance_id);

-- Function to find similar items by embedding
CREATE OR REPLACE FUNCTION find_similar_guidance(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 10,
  min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  guidance_id INTEGER,
  chunk_text TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.guidance_id,
    e.chunk_text,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM mrd_item_embeddings e
  JOIN mrd_guidance_items g ON e.guidance_id = g.id
  WHERE g.is_superseded = FALSE
    AND 1 - (e.embedding <=> query_embedding) >= min_similarity
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check for duplicates before insert
CREATE OR REPLACE FUNCTION check_duplicate_embedding(
  new_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.92
)
RETURNS TABLE (
  guidance_id INTEGER,
  title TEXT,
  source_type VARCHAR(50),
  source_id VARCHAR(100),
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id AS guidance_id,
    g.title,
    g.source_type,
    g.source_id,
    1 - (e.embedding <=> new_embedding) AS similarity
  FROM mrd_item_embeddings e
  JOIN mrd_guidance_items g ON e.guidance_id = g.id
  WHERE 1 - (e.embedding <=> new_embedding) > similarity_threshold
  ORDER BY e.embedding <=> new_embedding
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;
