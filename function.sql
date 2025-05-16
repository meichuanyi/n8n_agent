CREATE OR REPLACE FUNCTION search_similar_workflows(query_embedding VECTOR(1536), match_threshold FLOAT, match_count INT)
RETURNS TABLE(
  id INT,
  name TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.name,
    1 - (w.embedding <=> query_embedding) AS similarity
  FROM workflows w
  WHERE 1 - (w.embedding <=> query_embedding) > match_threshold
  ORDER BY w.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;