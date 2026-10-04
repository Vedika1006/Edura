// EMBEDDING GENERATION (Gemini API)
const embeddingModelName = import.meta.env.VITE_GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

export async function generateEmbedding(text: string): Promise<number[]> {
  ensureApiReady();
  const response = await ai.models.embedContent({
    model: embeddingModelName,
    contents: text,
    config: { outputDimensionality: 768 },
  });
  const embedding = response?.embeddings?.[0];
  if (!embedding?.values || !Array.isArray(embedding.values)) {
    throw new Error('No embedding returned from Gemini.');
  }
  return embedding.values;
}
import { GoogleGenAI } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3-flash-preview';

if (!apiKey) {
  console.warn('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file');
}

const ai = new GoogleGenAI({
  apiKey: apiKey,
});

export type GeminiMessage = { role: 'user' | 'assistant'; content: string };
export type RoadmapDifficulty = 'easy' | 'medium' | 'hard';

export interface RoadmapQuestionnaire {
  topic: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  durationUnit: 'days' | 'weeks' | 'months';
  hoursPerDay?: number;
  hoursPerWeek?: number;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  difficulty: RoadmapDifficulty;
  estimatedHours: number;
  completed: boolean;
}

export interface RoadmapResourceItem {
  type: string;
  title: string;
  url: string;
  description: string;
}

export interface DetailedRoadmapStage {
  id: string;
  stage: string;
  title: string;
  description: string;
  topics: string[];
  exercises: string[];
  projects?: string[];
  resources: RoadmapResourceItem[];
  difficulty: RoadmapDifficulty;
  estimatedHours: number;
  completed: boolean;
}

export interface DetailedRoadmap {
  title: string;
  userSummary: {
    skill: string;
    level: string;
    timeline: string;
    commitment: string;
  };
  stages: DetailedRoadmapStage[];
  finalProject: {
    title: string;
    description: string;
    requirements: string[];
    complexity: RoadmapDifficulty;
  };
  resourceList: Array<{
    category: string;
    items: Array<{ title: string; url: string; description: string }>;
  }>;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface CourseGeneratorInput {
  topic: string;
  outcome: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredFormat: 'project' | 'balanced' | 'theory';
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'read-write';
  timePerWeek: number;
  durationWeeks: number;
  supportNeeds: string;
  codingFocus: boolean;
}

export interface CoursePlanResource {
  type: string;
  title: string;
  url?: string;
  description: string;
}

export interface CoursePlanModule {
  id: string;
  title: string;
  description: string;
  focus: string;
  durationWeeks: number;
  learningObjectives: string[];
  practiceIdeas: string[];
  resources: CoursePlanResource[];
  includeMiniProject: boolean;
  hasCodingLab: boolean;
  sampleCode?: string;
}

export interface CoursePlanVideoRecommendation {
  title: string;
  url: string;
  channel: string;
  duration: string;
  reason: string;
  videoId?: string;
}

export interface GeneratedCoursePlan {
  title: string;
  summary: string;
  audience: string;
  deliveryStyle: string;
  weeklyCommitment: string;
  totalDuration: string;
  codingFocus: boolean;
  modules: CoursePlanModule[];
  capstone: {
    title: string;
    brief: string;
    deliverables: string[];
    evaluation: string;
  };
  tools: string[];
  studyTips: string[];
  videoRecommendations: CoursePlanVideoRecommendation[];
  sampleIdeSnippet: {
    language: string;
    starter: string;
    instructions: string;
  };
}

function ensureApiReady() {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
  }
}

async function generateText(prompt: string, retries = 3): Promise<string> {
  ensureApiReady();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      const raw = (() => {
        const candidate: any = response;
        if (typeof candidate.text === 'function') return candidate.text();
        if (typeof candidate.text === 'string') return candidate.text;
        if (typeof candidate.response?.text === 'function') return candidate.response.text();
        if (typeof candidate.response?.text === 'string') return candidate.response.text;
        return '';
      })();

      return (raw || '').trim();
    } catch (err: any) {
      const is503 = err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE');
      if (is503 && attempt < retries - 1) {
        const delay = (attempt + 1) * 3000;
        console.warn(`Gemini 503, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('generateText: exhausted retries');
}

function parseJsonResponse<T>(text: string): T {
  if (!text) {
    throw new Error('Empty response from Gemini.');
  }

  const cleaned = text.replace(/```json/gi, '```').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) {
      throw new Error('Failed to parse JSON from Gemini response.');
    }
    return JSON.parse(match[0]);
  }
}

function normalizeDifficulty(value?: string): RoadmapDifficulty {
  const normalized = value?.toLowerCase() as RoadmapDifficulty | undefined;
  return normalized === 'easy' || normalized === 'medium' || normalized === 'hard' ? normalized : 'medium';
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return fallback;
}

export async function chatWithGemini(messages: GeminiMessage[]): Promise<string> {
  try {
    const conversationContext = messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const prompt = `You are Edura's friendly AI study mentor. Provide concise, encouraging, and structured answers.

Conversation so far:
${conversationContext}

Assistant:`;

    const reply = await generateText(prompt);
    return reply || 'I could not generate a response right now. Please try again.';
  } catch (error) {
    console.error('Error chatting with Gemini:', error);
    throw new Error('Failed to get AI response. Please try again.');
  }
}

export async function generateRoadmap(goal: string): Promise<RoadmapMilestone[]> {
  try {
    const prompt = `Create a concise learning roadmap for the goal "${goal}".
Return a JSON array with 4-6 milestones, each having:
{
  "id": "1",
  "title": "Milestone title",
  "description": "What this milestone covers",
  "difficulty": "easy|medium|hard",
  "estimatedHours": 6,
  "completed": false
}
Only return the JSON array.`;

    const text = await generateText(prompt);
    const milestones = parseJsonResponse<any[]>(text);

    if (!Array.isArray(milestones) || milestones.length === 0) {
      throw new Error('Gemini returned an empty roadmap.');
    }

    return milestones.map((milestone, index) => ({
      id: String(milestone.id ?? index + 1),
      title: milestone.title?.trim() || `Milestone ${index + 1}`,
      description: milestone.description?.trim() || 'Focus on tangible progress for this step.',
      difficulty: normalizeDifficulty(milestone.difficulty),
      estimatedHours: toNumber(milestone.estimatedHours ?? milestone.estimated_hours, 6),
      completed: false,
    }));
  } catch (error) {
    console.error('Error generating roadmap:', error);
    throw new Error('Failed to generate roadmap. Please try again.');
  }
}

export async function generateDetailedRoadmap(answers: RoadmapQuestionnaire): Promise<DetailedRoadmap> {
  try {
    const commitmentText = answers.hoursPerDay
      ? `${answers.hoursPerDay} hours per day`
      : answers.hoursPerWeek
      ? `${answers.hoursPerWeek} hours per week`
      : 'flexible schedule';

    const totalHours = answers.durationUnit === 'days'
      ? answers.duration * (answers.hoursPerDay || 2)
      : answers.durationUnit === 'weeks'
      ? answers.duration * (answers.hoursPerWeek || 10)
      : answers.duration * 4 * (answers.hoursPerWeek || 10);

    const stageType = answers.durationUnit === 'days' ? 'Day' : 'Week';
    const numStages = answers.durationUnit === 'days'
      ? answers.duration
      : answers.durationUnit === 'weeks'
      ? answers.duration
      : answers.duration * 4;

    const prompt = `You are an expert learning path designer. Create a detailed, personalized roadmap based on:
- Topic: ${answers.topic}
- Skill level: ${answers.skillLevel}
- Timeline: ${answers.duration} ${answers.durationUnit}
- Time commitment: ${commitmentText}
- Total hours: ${totalHours}

Requirements:
1. Break the plan into exactly ${numStages} ${stageType.toLowerCase()}s.
2. Each stage must include title, description, topics, exercises, projects, resources (type, title, url, description), difficulty, estimatedHours, completed flag.
3. Progress difficulty gradually and keep workload within the time commitment.
4. Include a final project and categorized resource list.
5. Return ONLY valid JSON matching this structure:
{
  "title": "Learning Roadmap: ...",
  "userSummary": { "skill": "", "level": "", "timeline": "", "commitment": "" },
  "stages": [ { ... } ],
  "finalProject": { "title": "", "description": "", "requirements": [], "complexity": "easy|medium|hard" },
  "resourceList": [ { "category": "", "items": [ { "title": "", "url": "", "description": "" } ] } ]
}`;

    const text = await generateText(prompt);
    const roadmap = parseJsonResponse<DetailedRoadmap>(text);

    roadmap.stages = (roadmap.stages || []).map((stage, index) => ({
      ...stage,
      id: stage.id ?? String(index + 1),
      completed: false,
      topics: stage.topics ?? [],
      exercises: stage.exercises ?? [],
      projects: stage.projects ?? [],
      resources: stage.resources ?? [],
      estimatedHours: toNumber(stage.estimatedHours ?? (stage as any).estimated_hours, 5),
      difficulty: normalizeDifficulty(stage.difficulty),
    }));

    return roadmap;
  } catch (error) {
    console.error('Error generating detailed roadmap:', error);
    throw new Error('Failed to generate detailed roadmap. Please try again.');
  }
}

export async function generateSummary(content: string): Promise<string> {
  try {
    const prompt = `Summarize the following study material into clear sections: Overview, Key Concepts, Action Items, and Practice Ideas. Be concise and keep the user's tone encouraging. Content:\n\n${content}`;
    const summary = await generateText(prompt);
    return summary || 'No summary available.';
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error('Failed to generate summary. Please try again.');
  }
}

export async function generateFlashcards(content: string): Promise<Flashcard[]> {
  try {
    const prompt = `Create 8 flashcards from the following content. Return ONLY valid JSON array like [ { "question": "...", "answer": "..." } ]. Questions should be short and answers precise. Content:\n\n${content}`;
    const text = await generateText(prompt);
    const cards = parseJsonResponse<any[]>(text);

    const flashcards = cards
      .map((card) => ({
        question: card.question?.trim() || '',
        answer: card.answer?.trim() || '',
      }))
      .filter((card) => card.question && card.answer);

    if (!flashcards.length) {
      throw new Error('Gemini did not return flashcards.');
    }

    return flashcards;
  } catch (error) {
    console.error('Error generating flashcards:', error);
    throw new Error('Failed to generate flashcards. Please try again.');
  }
}

export async function generateQuiz(content: string): Promise<QuizQuestion[]> {
  try {
    const prompt = `Create a quiz based on the following content. Return ONLY JSON array with 5-8 items.
Each item must match:
{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": 0,
  "explanation": "..."
}
The correctAnswer is the zero-based index. Content:\n\n${content}`;

    const text = await generateText(prompt);
    const items = parseJsonResponse<any[]>(text);

    const quiz = items
      .map((item) => ({
        question: item.question?.trim() || '',
        options: Array.isArray(item.options) ? item.options.map((option: string) => option?.trim() || '').filter(Boolean) : [],
        correctAnswer: typeof item.correctAnswer === 'number' ? item.correctAnswer : Number(item.correct_answer ?? 0),
        explanation: item.explanation?.trim() || '',
      }))
      .filter((item) => item.question && item.options.length >= 2 && Number.isInteger(item.correctAnswer));

    if (!quiz.length) {
      throw new Error('Gemini did not return quiz questions.');
    }

    return quiz;
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw new Error('Failed to generate quiz. Please try again.');
  }
}

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  try {
    const prompt = `Translate the following text to ${targetLanguage}. Return only the translated sentence without extra commentary.\n\n${text}`;
    const translation = await generateText(prompt);
    return translation;
  } catch (error) {
    console.error('Error translating text:', error);
    throw new Error('Failed to translate text. Please try again.');
  }
}

export async function generateCoursePlan(input: CourseGeneratorInput): Promise<GeneratedCoursePlan> {
  try {
    const prompt = `You are Edura's curriculum designer. Build a complete, week-by-week course outline.
Learner profile:
- Topic: ${input.topic}
- Desired outcome: ${input.outcome}
- Experience level: ${input.experienceLevel}
- Preferred format: ${input.preferredFormat}
- Learning style: ${input.learningStyle}
- Weekly commitment: ${input.timePerWeek} hours
- Total duration: ${input.durationWeeks} weeks
- Extra support: ${input.supportNeeds}
- Coding focus required: ${input.codingFocus ? 'yes' : 'no'}

Return ONLY JSON shaped as:
{
  "title": "",
  "summary": "",
  "audience": "",
  "deliveryStyle": "",
  "weeklyCommitment": "",
  "totalDuration": "",
  "codingFocus": true,
  "modules": [
    {
      "id": "1",
      "title": "",
      "description": "",
      "focus": "",
      "durationWeeks": 1,
      "learningObjectives": [""],
      "practiceIdeas": [""],
      "resources": [
        { "type": "article|video|tool", "title": "", "url": "https://...", "description": "" }
      ],
      "includeMiniProject": true,
      "hasCodingLab": true,
      "sampleCode": "// optional"
    }
  ],
  "capstone": {
    "title": "",
    "brief": "",
    "deliverables": [""],
    "evaluation": ""
  },
  "tools": [""],
  "studyTips": [""],
  "videoRecommendations": [
    { "title": "", "url": "https://www.youtube.com/watch?v=...", "channel": "", "duration": "", "reason": "", "videoId": "" }
  ],
  "sampleIdeSnippet": {
    "language": "javascript|python|...",
    "starter": "// short starter code",
    "instructions": ""
  }
}`;

    const text = await generateText(prompt);
    const plan = parseJsonResponse<GeneratedCoursePlan>(text);

    plan.modules = (plan.modules || []).map((module, index) => ({
      ...module,
      id: module.id ?? String(index + 1),
      durationWeeks: toNumber(module.durationWeeks ?? (module as any).duration_weeks ?? 1, 1),
      learningObjectives: Array.isArray(module.learningObjectives) ? module.learningObjectives : [],
      practiceIdeas: Array.isArray(module.practiceIdeas) ? module.practiceIdeas : [],
      resources: Array.isArray(module.resources)
        ? module.resources.map((resource) => ({
            type: resource.type || 'resource',
            title: resource.title || 'Suggested resource',
            url: resource.url,
            description: resource.description || '',
          }))
        : [],
      includeMiniProject: toBoolean((module as any).includeMiniProject ?? (module as any).include_mini_project, false),
      hasCodingLab: toBoolean((module as any).hasCodingLab ?? (module as any).has_coding_lab, false),
      sampleCode: module.sampleCode,
    }));

    if (!plan.videoRecommendations || !Array.isArray(plan.videoRecommendations) || plan.videoRecommendations.length === 0) {
      plan.videoRecommendations = [
        {
          title: `${input.topic} crash course`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${input.topic} tutorial`)}`,
          channel: 'YouTube Search',
          duration: '~15 min',
          reason: 'Fallback suggestion when AI video could not be generated',
        },
      ];
    }

    plan.codingFocus = toBoolean(plan.codingFocus, input.codingFocus);

    if (!plan.sampleIdeSnippet) {
      plan.sampleIdeSnippet = {
        language: input.codingFocus ? 'javascript' : 'markdown',
        starter: input.codingFocus
          ? `function practice${input.topic.replace(/\s+/g, '')}() {\n  console.log('Start experimenting with ${input.topic}');\n}`
          : `### ${input.topic}\nWrite your reflections here...`,
        instructions: input.codingFocus
          ? 'Use this function as a sandbox to test the concept you just learned.'
          : 'Capture key takeaways or action items for this lesson.',
      };
    }

    plan.studyTips = Array.isArray(plan.studyTips) ? plan.studyTips : [];
    plan.tools = Array.isArray(plan.tools) ? plan.tools : [];

    return plan;
  } catch (error) {
    console.error('Error generating course plan:', error);
    throw new Error('Failed to generate course plan. Please try again.');
  }
}

export interface DailyMotivationInput {
  xp: number;
  level: number;
  streak: number;
  coursesCount?: number;
  todayGoal?: number;
  todayProgress?: number;
}

export interface RoadmapNode {
  id: string;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  resources: Array<{
    type: 'documentation' | 'tutorial' | 'article' | 'video';
    title: string;
    url: string;
  }>;
  projects?: Array<{
    title: string;
    description: string;
    level: 'beginner' | 'intermediate' | 'advanced';
  }>;
  subtopics?: string[];
  prerequisites?: string[];
}

export interface RoadmapTemplate {
  title: string;
  description: string;
  slug: string;
  nodes: RoadmapNode[];
}

/**
 * Generate a personalized daily motivational quote
 */
export async function generateDailyMotivation(input: DailyMotivationInput): Promise<string> {
  try {
    const context = [];
    if (input.streak > 0) {
      context.push(`${input.streak} day streak`);
    }
    if (input.xp > 0) {
      context.push(`level ${input.level} with ${input.xp} XP`);
    }
    if (input.coursesCount && input.coursesCount > 0) {
      context.push(`${input.coursesCount} ${input.coursesCount === 1 ? 'course' : 'courses'} in progress`);
    }
    if (input.todayProgress !== undefined && input.todayGoal) {
      context.push(`today's progress: ${input.todayProgress}/${input.todayGoal} modules`);
    }

    const contextText = context.length > 0 ? context.join(', ') : 'just getting started';

    const prompt = `Generate a short, personalized motivational quote (1-2 lines max) for a learner who is ${contextText}. 

IMPORTANT: Make each quote diverse and varied. Don't just focus on XP, levels, or streaks. Cover different themes:

- Learning and curiosity (exploring new ideas, asking questions, staying curious)
- Persistence and resilience (overcoming challenges, bouncing back from setbacks)
- Taking breaks and self-care (resting, finding balance, mental wellbeing)
- Growth mindset (embracing mistakes, learning from failure, trying new things)
- Time and rhythm (finding your pace, consistency without pressure, respecting your energy)
- Community and connection (learning with others, sharing knowledge, support)
- Personal reflection (knowing when to push, when to pause, trusting your journey)
- Life balance (study as part of life, not consuming everything, living fully)

Rotate through these themes naturally. Each quote should feel genuine and different from typical gamification language.

Tone: calm, encouraging, slightly cheesy but genuine. 
Style: conversational, human-sounding, like a supportive study buddy.
Length: 1-2 lines maximum.

Return ONLY the quote text, no extra commentary or quotes around it.`;

    const quote = await generateText(prompt);
    
    // Clean up the response - remove quotes if Gemini added them
    const cleaned = quote.replace(/^["']|["']$/g, '').trim();
    
    if (!cleaned) {
      throw new Error('Empty quote response');
    }

    return cleaned;
  } catch (error) {
    console.error('Error generating daily motivation:', error);
    throw new Error('Failed to generate motivational quote. Please try again.');
  }
}

/**
 * Generate a roadmap.sh-style structured roadmap for a given topic
 */
export async function generateRoadmapTemplate(topic: string, slug: string): Promise<RoadmapTemplate> {
  try {
    const prompt = `Generate a detailed learning roadmap for "${topic}" similar to roadmap.sh structure.

Requirements:
1. Create a vertical flow (top to bottom) with main learning nodes
2. Each node represents a major topic/concept (e.g., "Internet", "HTML", "CSS", "JavaScript", "Version Control")
3. Nodes should progress from beginner → intermediate → advanced
4. Order is recommended but not strictly enforced

Each node must include:
- title: Short, clear title (2-4 words)
- description: 1-2 line explanation of what this node covers
- level: beginner | intermediate | advanced
- resources: Array of learning resources with:
  * type: documentation | tutorial | article | video
  * title: Resource title
  * url: Valid URL (use real URLs if possible, or placeholder format https://example.com/resource-name)
- projects (optional): Array of practical project ideas with title, description, and level
- subtopics (optional): Array of key subtopics to learn within this node
- prerequisites (optional): Array of prerequisite node titles

Return ONLY valid JSON matching this structure:
{
  "title": "Learning Roadmap: ${topic}",
  "description": "Step by step guide to becoming proficient in ${topic}",
  "slug": "${slug}",
  "nodes": [
    {
      "id": "1",
      "title": "Node Title",
      "description": "Brief description",
      "level": "beginner",
      "resources": [
        {"type": "documentation", "title": "Official Docs", "url": "https://..."},
        {"type": "tutorial", "title": "Getting Started", "url": "https://..."}
      ],
      "projects": [
        {"title": "Project Name", "description": "Project description", "level": "beginner"}
      ],
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "prerequisites": []
    }
  ]
}

Make it comprehensive, practical, and similar to roadmap.sh in structure. Include 10-20 nodes for a complete learning path.`;

    const text = await generateText(prompt);
    const roadmap = parseJsonResponse<RoadmapTemplate>(text);

    // Validate and normalize the roadmap
    if (!roadmap.nodes || !Array.isArray(roadmap.nodes) || roadmap.nodes.length === 0) {
      throw new Error('Generated roadmap has no nodes');
    }

    roadmap.nodes = roadmap.nodes.map((node, index) => ({
      ...node,
      id: node.id || String(index + 1),
      level: (['beginner', 'intermediate', 'advanced'].includes(node.level) ? node.level : 'beginner') as 'beginner' | 'intermediate' | 'advanced',
      resources: Array.isArray(node.resources) ? node.resources : [],
      projects: Array.isArray(node.projects) ? node.projects : [],
      subtopics: Array.isArray(node.subtopics) ? node.subtopics : [],
      prerequisites: Array.isArray(node.prerequisites) ? node.prerequisites : [],
    }));

    return {
      title: roadmap.title || `Learning Roadmap: ${topic}`,
      description: roadmap.description || `Step by step guide to learning ${topic}`,
      slug: roadmap.slug || slug,
      nodes: roadmap.nodes,
    };
  } catch (error) {
    console.error('Error generating roadmap template:', error);
    throw new Error('Failed to generate roadmap template. Please try again.');
  }
}

export interface StudyTask {
  id: string;
  name: string;
  deadline: string; // ISO date string
  estimatedHours: number;
  priority: 'high' | 'medium' | 'low';
}

export interface ScheduledTask {
  task: string;
  duration: string;
  durationHours: number;
  priority: 'high' | 'medium' | 'low' | 'buffer';
}

export interface DaySchedule {
  date: string; // ISO date string (YYYY-MM-DD)
  tasks: ScheduledTask[];
}

export interface ScheduleGenerationInput {
  tasks: StudyTask[];
  maxHoursPerDay?: number;
}

/**
 * Generate an AI-optimized study schedule using Gemini
 */
export async function generateAISchedule(input: ScheduleGenerationInput): Promise<{ schedule: DaySchedule[]; warnings: string[] }> {
  try {
    const maxHours = input.maxHoursPerDay || 3;
    const today = new Date().toISOString().split('T')[0];
    
    // Validate tasks
    const validTasks = input.tasks.filter(task => {
      const deadline = new Date(task.deadline);
      const now = new Date();
      return !isNaN(deadline.getTime()) && deadline >= now && task.estimatedHours > 0;
    });

    if (validTasks.length === 0) {
      return { schedule: [], warnings: ['No valid tasks with future deadlines found.'] };
    }

    // Check for impossible deadlines
    const warnings: string[] = [];
    validTasks.forEach(task => {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const requiredDays = Math.ceil(task.estimatedHours / maxHours);
      
      if (daysUntilDeadline < requiredDays) {
        warnings.push(`${task.name}: ${daysUntilDeadline} days available but ${requiredDays.toFixed(1)} days needed at ${maxHours} hrs/day.`);
      }
    });

    // Build task summary for Gemini
    const taskSummary = validTasks.map((task, index) => {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return `${index + 1}. "${task.name}" - ${task.estimatedHours} hours, priority: ${task.priority}, deadline: ${task.deadline} (${daysUntilDeadline} days from today)`;
    }).join('\n');

    const prompt = `You are an AI study planner. Create a realistic, deadline-aware study schedule.

Tasks to schedule:
${taskSummary}

Constraints:
- Maximum ${maxHours} hours per day (can go up to ${maxHours + 1} hours for urgent high-priority tasks)
- Earlier deadlines should be scheduled first
- Respect priority: High > Medium > Low
- Distribute work evenly across available days before each deadline
- Do not schedule work on days after a task's deadline
- Today is ${today}

Return ONLY valid JSON in this exact format:
{
  "schedule": [
    {
      "date": "YYYY-MM-DD",
      "tasks": [
        {
          "task": "Task name",
          "durationHours": 1.5,
          "priority": "high|medium|low"
        }
      ]
    }
  ]
}

Rules:
- Each day's total hours should not exceed ${maxHours} hours (unless urgent)
- Split large tasks across multiple days if needed
- Ensure all estimated hours are distributed before deadlines
- Format durationHours as a number (e.g., 1.5, 2, 0.5)`;

    const text = await generateText(prompt);
    const result = parseJsonResponse<{ schedule: DaySchedule[] }>(text);

    // Normalize and validate the schedule
    const normalizedSchedule: DaySchedule[] = (result.schedule || []).map(day => ({
      date: day.date,
      tasks: day.tasks.map(task => ({
        task: task.task,
        duration: `${task.durationHours % 1 === 0 ? task.durationHours : task.durationHours.toFixed(1)} hrs`,
        durationHours: Number(task.durationHours) || 0,
        priority: (['high', 'medium', 'low', 'buffer'].includes(task.priority) ? task.priority : 'medium') as 'high' | 'medium' | 'low' | 'buffer',
      })),
    })).filter(day => day.tasks.length > 0);

    return { schedule: normalizedSchedule, warnings };
  } catch (error) {
    console.error('Error generating AI schedule:', error);
    // Fallback to basic scheduling algorithm
    throw new Error('Failed to generate AI-optimized schedule. Using fallback algorithm.');
  }
}

export interface TimeAwareInput {
  availableTime: number; // in minutes
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
    const { availableTime, subject, goal } = input;

    // Determine time category and strategy
    let timeStrategy = '';
    if (availableTime < 15) {
      timeStrategy = 'Quick Session (<15 min): Focus on ONE key concept or quick revision. Prioritize the most important learning point.';
    } else if (availableTime <= 30) {
      timeStrategy = 'Good Window (15-30 min): Include 2-3 focused segments mixing concept learning with brief practice.';
    } else if (availableTime <= 60) {
      timeStrategy = 'Extended Time (30-60 min): Mix concept learning, video content, hands-on practice, and review. Include multiple learning activities.';
    } else {
      timeStrategy = 'Comprehensive Session (>60 min): Full learning experience with modules, projects, multiple practice exercises, and thorough review.';
    }

    const goalContext = goal ? `\nLearning Goal: ${goal}` : '';

    const prompt = `You are Edura's time-aware learning assistant. Create a focused, practical study plan optimized for the available time and aligned with the learner's goal.

Subject/Topic: ${subject}
Available Time: ${availableTime} minutes${goalContext}

Strategy: ${timeStrategy}

Generate recommendations that:
- Total duration should closely match ${availableTime} minutes (within 5 minutes)
- Be practical and actionable
- Include diverse learning types (concept, video, practice, revision)
- Provide specific resources when possible
- Offer learning tips for each recommendation

Return ONLY valid JSON in this exact format:
{
  "recommendations": [
    {
      "type": "concept|video|practice|revision",
      "title": "Clear, descriptive title",
      "description": "What the learner will do in this activity",
      "duration": 10,
      "resources": [
        {
          "title": "Resource title",
          "url": "https://example.com (optional)",
          "type": "video|article|tutorial|documentation (optional)"
        }
      ],
      "tips": [
        "Actionable tip for this activity",
        "Another helpful tip"
      ]
    }
  ]
}

Rules:
- Total duration of all recommendations should be approximately ${availableTime} minutes
- Include 1-4 recommendations based on available time
- Each recommendation should have 1-3 resources (URLs optional but preferred)
- Each recommendation should have 2-4 actionable tips
- Make recommendations specific to "${subject}"${goal ? ` and aligned with the goal: "${goal}"` : ''}
- Prioritize practical, hands-on learning when time allows
- Tailor recommendations to help achieve the stated learning goal if provided`;

    const text = await generateText(prompt);
    const result = parseJsonResponse<{ recommendations: TimeAwareRecommendation[] }>(text);

    // Normalize and validate recommendations
    const recommendations = (result.recommendations || []).map((rec) => ({
      type: (['concept', 'video', 'practice', 'revision'].includes(rec.type)
        ? rec.type
        : 'concept') as 'concept' | 'video' | 'practice' | 'revision',
      title: rec.title || 'Untitled Activity',
      description: rec.description || '',
      duration: Math.max(1, Math.min(rec.duration || 10, 120)), // Clamp between 1-120 min
      resources: Array.isArray(rec.resources) ? rec.resources : [],
      tips: Array.isArray(rec.tips) ? rec.tips : [],
    })).filter((rec) => rec.title && rec.description);

    // Ensure recommendations don't exceed available time significantly
    const totalDuration = recommendations.reduce((sum, rec) => sum + rec.duration, 0);
    if (totalDuration > availableTime * 1.2) {
      // Scale down if significantly over
      const scale = availableTime / totalDuration;
      recommendations.forEach((rec) => {
        rec.duration = Math.round(rec.duration * scale);
      });
    }

    if (recommendations.length === 0) {
      throw new Error('No recommendations generated. Please try again.');
    }

    return recommendations;
  } catch (error) {
    console.error('Error generating time-aware recommendations:', error);
    throw new Error('Failed to generate time-aware recommendations. Please try again.');
  }
}

