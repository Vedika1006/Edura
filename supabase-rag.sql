-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Embeddings table
CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL, -- adjust dimension as per Gemini embedding size
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS: Only allow users to access their own embeddings
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own embeddings" ON public.embeddings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own embeddings" ON public.embeddings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own embeddings" ON public.embeddings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own embeddings" ON public.embeddings FOR DELETE USING (auth.uid() = user_id);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector,
  match_count int,
  match_user_id uuid
)
RETURNS TABLE(
  id uuid,
  content text,
  metadata jsonb,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT id, content, metadata, (embedding <#> query_embedding) AS similarity
  FROM public.embeddings
  WHERE user_id = match_user_id
  ORDER BY embedding <#> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;