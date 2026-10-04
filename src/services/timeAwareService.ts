import { generateTimeAwareRecommendations as generateRecommendations } from '@/lib/gemini';

export interface TimeAwareInput {
  availableTime: number; // in minutes (5-480)
  subject: string;
  goal?: string; // Optional learning goal
}

export interface TimeAwareResource {
  title: string;
  url?: string;
  type?: 'video' | 'article' | 'tutorial' | 'documentation';
}

export interface TimeAwareRecommendation {
  type: 'concept' | 'video' | 'practice' | 'revision';
  title: string;
  description: string;
  duration: number; // in minutes
  resources: TimeAwareResource[];
  tips: string[];
}

/**
 * Generate time-aware learning recommendations using Gemini AI
 */
export async function generateTimeAwareRecommendations(
  input: TimeAwareInput
): Promise<TimeAwareRecommendation[]> {
  try {
    if (!input.subject || input.subject.trim().length === 0) {
      throw new Error('Subject is required');
    }

    if (input.availableTime < 5 || input.availableTime > 480) {
      throw new Error('Available time must be between 5 and 480 minutes');
    }

    const recommendations = await generateRecommendations({
      availableTime: input.availableTime,
      subject: input.subject,
      goal: input.goal,
    });

    return recommendations;
  } catch (error: any) {
    console.error('Error generating time-aware recommendations:', error);
    throw new Error(error.message || 'Failed to generate recommendations. Please try again.');
  }
}

/**
 * Get time category based on available time
 */
export function getTimeCategory(availableTime: number): {
  category: 'quick' | 'good' | 'extended';
  label: string;
  description: string;
} {
  if (availableTime < 15) {
    return {
      category: 'quick',
      label: 'Quick Session',
      description: 'Perfect for a quick review or learning one key concept',
    };
  } else if (availableTime <= 60) {
    return {
      category: 'good',
      label: 'Good Window',
      description: 'Ideal for focused learning with multiple activities',
    };
  } else {
    return {
      category: 'extended',
      label: 'Extended Time',
      description: 'Great opportunity for comprehensive learning and practice',
    };
  }
}

