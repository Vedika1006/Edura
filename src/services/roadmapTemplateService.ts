import { supabase } from '@/lib/supabase';
import { generateRoadmapTemplate, type RoadmapTemplate, type RoadmapNode } from '@/lib/gemini';

/**
 * Get or generate a roadmap template by slug
 * Generates only once, then caches in database
 */
export async function getRoadmapTemplate(slug: string, topic: string): Promise<{ roadmap: RoadmapTemplate | null; error: string | null }> {
  try {
    // First, check if roadmap template exists in database
    const { data: existing, error: fetchError } = await supabase
      .from('roadmap_templates')
      .select('*')
      .eq('slug', slug)
      .single();

    if (existing && !fetchError) {
      // Template exists, return it
      return {
        roadmap: {
          title: existing.title,
          description: existing.description || '',
          slug: existing.slug,
          nodes: existing.content.nodes || [],
        },
        error: null,
      };
    }

    // Template doesn't exist, generate it using Gemini
    console.log(`Generating roadmap template for slug: ${slug}, topic: ${topic}`);
    
    const generatedRoadmap = await generateRoadmapTemplate(topic, slug);

    // Save to database (this will fail gracefully if it already exists due to unique constraint)
    const { error: insertError } = await supabase
      .from('roadmap_templates')
      .insert({
        slug: generatedRoadmap.slug,
        title: generatedRoadmap.title,
        description: generatedRoadmap.description,
        content: {
          nodes: generatedRoadmap.nodes,
        },
      })
      .select()
      .single();

    // If insert fails due to race condition (another request created it), fetch the existing one
    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint violation - template was just created by another request
        const { data: raceConditionRoadmap } = await supabase
          .from('roadmap_templates')
          .select('*')
          .eq('slug', slug)
          .single();

        if (raceConditionRoadmap) {
          return {
            roadmap: {
              title: raceConditionRoadmap.title,
              description: raceConditionRoadmap.description || '',
              slug: raceConditionRoadmap.slug,
              nodes: raceConditionRoadmap.content.nodes || [],
            },
            error: null,
          };
        }
      }
      throw insertError;
    }

    return { roadmap: generatedRoadmap, error: null };
  } catch (error: any) {
    console.error('Error getting roadmap template:', error);
    return { roadmap: null, error: error.message || 'Failed to get roadmap template' };
  }
}

/**
 * Get roadmap template by slug (does not generate if missing)
 */
export async function getRoadmapTemplateBySlug(slug: string): Promise<{ roadmap: RoadmapTemplate | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('roadmap_templates')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      return { roadmap: null, error: error?.message || 'Roadmap template not found' };
    }

    return {
      roadmap: {
        title: data.title,
        description: data.description || '',
        slug: data.slug,
        nodes: data.content.nodes || [],
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Error fetching roadmap template:', error);
    return { roadmap: null, error: error.message || 'Failed to fetch roadmap template' };
  }
}

