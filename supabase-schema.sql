-- Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create workflows table with vector support
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  complexity TEXT,
  nodes JSONB,
  connections JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
CREATE INDEX IF NOT EXISTS idx_workflows_complexity ON workflows(complexity);
CREATE INDEX IF NOT EXISTS idx_workflows_tags ON workflows USING GIN(tags);

-- Create node_definitions table
CREATE TABLE IF NOT EXISTS node_definitions (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT,
  content JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for node_definitions
CREATE INDEX IF NOT EXISTS idx_node_definitions_name ON node_definitions(name);
CREATE INDEX IF NOT EXISTS idx_node_definitions_category ON node_definitions(category);
CREATE INDEX IF NOT EXISTS idx_node_definitions_type ON node_definitions(type);

-- Create a function to search for similar workflows using vector similarity
CREATE OR REPLACE FUNCTION search_similar_workflows(query_embedding VECTOR(1536), match_threshold FLOAT, match_count INT)
RETURNS TABLE(
  id INT,
  name TEXT,
  category TEXT,
  description TEXT,
  tags TEXT[],
  complexity TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.category,
    w.description,
    w.tags,
    w.complexity,
    1 - (w.embedding <=> query_embedding) AS similarity
  FROM workflows w
  WHERE 1 - (w.embedding <=> query_embedding) > match_threshold
  ORDER BY w.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create a function to search for similar node definitions using vector similarity
CREATE OR REPLACE FUNCTION search_similar_nodes(query_embedding VECTOR(1536), match_threshold FLOAT, match_count INT)
RETURNS TABLE(
  id INT,
  name TEXT,
  category TEXT,
  type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.name,
    n.category,
    n.type,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM node_definitions n
  WHERE 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create functions that we can call via RPC
CREATE OR REPLACE FUNCTION create_workflows_table()
RETURNS VOID AS $$
BEGIN
  -- Enable the pgvector extension
  CREATE EXTENSION IF NOT EXISTS vector;

  -- Create workflows table with vector support
  CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    complexity TEXT,
    nodes JSONB,
    connections JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
  );

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
  CREATE INDEX IF NOT EXISTS idx_workflows_complexity ON workflows(complexity);
  CREATE INDEX IF NOT EXISTS idx_workflows_tags ON workflows USING GIN(tags);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_node_definitions_table()
RETURNS VOID AS $$
BEGIN
  -- Enable the pgvector extension
  CREATE EXTENSION IF NOT EXISTS vector;

  -- Create node_definitions table
  CREATE TABLE IF NOT EXISTS node_definitions (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT,
    content JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
  );

  -- Create indexes for node_definitions
  CREATE INDEX IF NOT EXISTS idx_node_definitions_name ON node_definitions(name);
  CREATE INDEX IF NOT EXISTS idx_node_definitions_category ON node_definitions(category);
  CREATE INDEX IF NOT EXISTS idx_node_definitions_type ON node_definitions(type);
END;
$$ LANGUAGE plpgsql;