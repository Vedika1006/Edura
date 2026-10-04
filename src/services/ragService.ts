import { supabase } from '@/lib/supabase';
import { generateEmbedding as geminiGenerateEmbedding, chatWithGemini } from '@/lib/gemini';

// 1. TEXT CHUNKING
export function chunkText(text: string, maxTokens = 400): string[] {
  // Simple sentence-based chunking, ~300-500 tokens
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).split(' ').length > maxTokens) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// 2. EMBEDDING GENERATION
export async function generateEmbedding(text: string): Promise<number[]> {
  // Use Gemini embedding API (embedding-001 or latest)
  return geminiGenerateEmbedding(text);
}

// 3. STORE EMBEDDINGS
export async function storeEmbeddings(
  chunks: string[],
  userId: string,
  noteId: string,
  courseId?: string
): Promise<void> {
  // Embed chunks sequentially to avoid rate-limiting
  const toInsert = [];
  for (const content of chunks) {
    const embedding = await generateEmbedding(content);
    toInsert.push({
      user_id: userId,
      content,
      embedding: JSON.stringify(embedding),
      metadata: { note_id: noteId, course_id: courseId },
    });
  }
  const { error } = await supabase.from('embeddings').insert(toInsert);
  if (error) throw error;
}

// 4. RETRIEVE RELEVANT CHUNKS
export async function retrieveRelevantChunks(query: string, userId: string, matchCount = 8) {
  const queryEmbedding = await generateEmbedding(query);
  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: matchCount,
    match_user_id: userId,
  });
  if (error) {
    console.error('match_embeddings RPC error:', error);
    throw error;
  }
  console.log(`RAG: retrieved ${data?.length ?? 0} chunks for query`);
  return data as Array<{ id: string; content: string; metadata: any; similarity: number }>;
}

// 5. RAG RESPONSE GENERATION
export async function generateRAGResponse(query: string, userId: string) {
  try {
    const chunks = await retrieveRelevantChunks(query, userId, 8);
    if (!chunks || chunks.length === 0) {
      // fallback to default AI
      return { answer: await chatWithGemini([{ role: 'user', content: query }]), sourceChunks: [] };
    }
    const context = chunks.map((c, i) => `Chunk ${i + 1}:\n${c.content}`).join('\n\n');
    const prompt = `Answer the question using ONLY the context below. If not found, say you don’t know.\n\nContext:\n${context}\n\nQuestion: ${query}\nAnswer:`;
    const answer = await chatWithGemini([{ role: 'user', content: prompt }]);
    return { answer, sourceChunks: chunks };
  } catch (err: any) {
    // fallback
    return { answer: await chatWithGemini([{ role: 'user', content: query }]), sourceChunks: [] };
  }
}

// 6. BATCH INSERT, CACHE, ETC. (for production, add LRU/memory cache as needed)
// 7. HYBRID SEARCH (BONUS)
export async function retrieveHybridChunks(query: string, userId: string, matchCount = 8) {
  // Keyword + vector search (simple hybrid)
  const queryEmbedding = await generateEmbedding(query);
  const { data, error } = await supabase
    .from('embeddings')
    .select('*')
    .or(`content.ilike.%${query}%,embedding<->${JSON.stringify(queryEmbedding)}`)
    .eq('user_id', userId)
    .limit(matchCount);
  if (error) throw error;
  return data;
}
