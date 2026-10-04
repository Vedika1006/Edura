# Edura - AI-Powered Learning Platform

Edura is a full-stack, AI-powered learning platform that personalizes education using Google Gemini AI. It combines intelligent tutoring, adaptive roadmaps, automated content generation, and collaborative features into a single unified experience for students and self-learners.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [AI Features in Detail](#ai-features-in-detail)
- [External Services](#external-services)
- [Screenshots](#screenshots)
- [License](#license)

---

## Features

### AI-Powered Learning
- **AI Tutor Chatbot** - Conversational study mentor powered by Gemini AI with full conversation context
- **Smart Roadmap Generator** - Creates personalized learning paths based on skill level, goals, and available time
- **Course Generator** - Builds complete week-by-week course curricula with modules, capstone projects, and video recommendations
- **AI Study Planner** - Deadline-aware schedule optimizer that distributes tasks across available days
- **Time-Aware Recommendations** - Suggests focused study activities based on available time slots

### Content Tools
- **Notes with AI Processing** - Upload documents (PDF, text) and generate:
  - Structured summaries (Overview, Key Concepts, Action Items)
  - Flashcards (8 Q&A pairs)
  - MCQ quizzes (5-8 questions with explanations)
- **Translation** - Multi-language translation via Deep Translate API
- **Daily Motivation** - Personalized motivational quotes based on learning progress

### Coding & Practice
- **Built-in IDE** - Monaco Editor with Judge0 code execution sandbox supporting multiple languages
- **Interactive Quizzes** - Auto-generated and course-embedded assessments with scoring

### Productivity
- **Focus Room** - Pomodoro timer with ambient sounds (rain, forest, cafe, ocean waves) and XP rewards
- **Study Planner** - Task management with Google Classroom import and AI-optimized scheduling
- **Analytics Dashboard** - Weekly study trends, focus scores, time blocks, and subject performance charts

### Community
- **Discussion Forum** - Post questions, reply, and like with threaded discussions
- **Study Groups** - Create or join groups with real-time group chat
- **Mentor Connections** - Browse and connect with mentors
- **Leaderboard** - Weekly, monthly, and all-time XP rankings

### Personalization
- **Gamification** - XP system, levels, and streaks to encourage consistent learning
- **Accessibility** - Dark mode, colorblind mode, dyslexia-friendly fonts, and adjustable font sizes
- **Multi-language UI** - Interface translation support
- **Voice Assistant** - Voice-activated AI interactions

### Integrations
- **Google Classroom** - Import courses and assignments via OAuth
- **Roadmap.sh Templates** - Browse curated developer roadmaps with AI-generated alternatives
- **External Course Discovery** - Search and browse courses from external platforms via backend proxy

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite 7 | Build tool and dev server |
| Tailwind CSS | Utility-first styling |
| shadcn/ui (Radix) | 49 accessible UI primitives |
| Zustand | Global state management |
| React Router v6 | Client-side routing |
| Framer Motion | Animations and transitions |
| Three.js / React Three Fiber | 3D landing page visuals |
| Monaco Editor | In-browser code editor |
| Recharts | Analytics charts and graphs |
| React Flow | Roadmap node visualizations |

### Backend
| Technology | Purpose |
|---|---|
| Express.js | API proxy server (port 3001) |
| Supabase | PostgreSQL database, authentication, file storage |
| pgvector | Vector similarity search for RAG |
| Row Level Security (RLS) | Data isolation per user |

### AI & APIs
| Service | Purpose |
|---|---|
| Google Gemini AI | Text generation (chat, roadmaps, courses, quizzes, summaries, schedules) |
| Gemini Embedding API | 768-dimensional text embeddings for RAG pipeline |
| RapidAPI Deep Translate | Multi-language text translation |
| Judge0 | Sandboxed code execution for the IDE |
| Google Classroom API | Course and assignment import via OAuth |

---

## Architecture

```
User Browser (React SPA)
    |
    +-- Pages (17 route components)
    |       |
    |       +-- Services Layer (business logic, validation, orchestration)
    |       |       |
    |       |       +-- src/lib/gemini.ts --> Google Gemini API
    |       |       +-- src/lib/supabase.ts --> Supabase (DB / Auth / Storage)
    |       |       +-- External APIs (RapidAPI, Judge0, Google Classroom)
    |       |
    |       +-- Zustand Stores (userStore, themeStore)
    |
    +-- Express Backend (port 3001)
            |
            +-- /api/courses/external --> Web scraping proxy for external courses
            +-- /health --> Health check endpoint
```

### Data Flow

1. **User action** triggers a page component event handler
2. Page calls a **service function** (or lib directly for simple cases)
3. Service validates input and calls **Gemini AI** or **Supabase**
4. Response flows back through service to page `setState`
5. **Zustand stores** handle cross-component state (auth, theme)
6. **localStorage** caches quotes, translations, and community data as fallbacks

### RAG Pipeline (Retrieval-Augmented Generation)

```
User Content --> Chunk Text --> Generate Embeddings (Gemini) --> Store in pgvector
                                                                      |
User Query --> Generate Query Embedding --> Cosine Similarity Search --+
                                                                      |
                                           Retrieved Context + Query --> Gemini --> Response
```

---

## Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **Supabase** project ([free tier](https://supabase.com) works)
- **Google AI Studio** API key for Gemini ([get one here](https://makersuite.google.com/app/apikey))
- **RapidAPI** account for Deep Translate ([rapidapi.com](https://rapidapi.com))
- **Judge0** sandbox - self-hosted via Docker or RapidAPI hosted
- **Google Cloud** project with Classroom API enabled (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/Vedika1006/Edura.git
cd Edura

# Install dependencies
npm install
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Gemini AI
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_GEMINI_MODEL=gemini-3-flash-preview

# RapidAPI (Deep Translate)
VITE_RAPIDAPI_KEY=your-rapidapi-key

# Judge0 Code Execution Sandbox
VITE_JUDGE0_URL=http://localhost:2358
VITE_JUDGE0_HOST=judge0-ce.p.rapidapi.com       # only if using RapidAPI Judge0
VITE_JUDGE0_KEY=your-rapidapi-judge0-key         # only if using RapidAPI Judge0

# Google Classroom OAuth (optional)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_CLASSROOM_PROXY_URL=                        # optional Supabase Edge Function proxy

# Backend API
VITE_API_URL=http://localhost:3001
```

> **Important:** Never commit your `.env` file. The `.gitignore` already excludes it.

---

## Database Setup

### 1. Create a Supabase Project

Sign up at [supabase.com](https://supabase.com) and create a new project.

### 2. Run Schema Migrations

Open the SQL Editor in your Supabase dashboard and run these scripts in order:

```
1. supabase-schema.sql          -- Core tables, RLS policies, storage bucket, triggers
2. supabase-rag.sql             -- pgvector extension, embeddings table, similarity search function
3. fix-rls-policy-complete.sql  -- Auth trigger for auto-creating user profiles
4. migrate-roadmap-templates.sql -- Roadmap templates table
5. migrate-courses-table.sql    -- Course table enhancements (if needed)
6. fix-roadmaps-rls.sql         -- Additional RLS policies for roadmaps
```

### 3. Verify Setup

After running migrations, verify in your Supabase dashboard:
- **Tables:** `users`, `courses`, `modules`, `user_course_progress`, `study_sessions`, `notes`, `roadmaps`, `embeddings`, `roadmap_templates`
- **Storage:** `notes` bucket exists and is public
- **Extensions:** `pgvector` is enabled
- **Auth:** Email/password provider is enabled

### Database Schema Overview

| Table | Purpose |
|---|---|
| `users` | User profiles with XP, level, and streak tracking |
| `courses` | Course metadata (AI-generated and manual) |
| `modules` | Course modules with content, flashcards, quizzes |
| `user_course_progress` | Per-user course completion tracking |
| `study_sessions` | Focus Room session logs (duration, XP earned) |
| `notes` | User notes with AI-generated summaries |
| `roadmaps` | Personalized learning roadmaps with milestones |
| `embeddings` | 768-dim vector embeddings for RAG search |
| `roadmap_templates` | Cached AI-generated roadmap templates |

---

## Running the App

```bash
# Start both frontend and backend together
npm run dev:all

# Or start them separately:
npm run dev          # Frontend on http://localhost:8080
npm run dev:server   # Backend API on http://localhost:3001
```

### Other Commands

```bash
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Judge0 (Self-Hosted)

To run the code execution sandbox locally:

```bash
docker run -d -p 2358:2358 judge0/api:latest
```

---

## Project Structure

```
Edura/
├── public/
│   ├── audio/                    # Ambient sounds for Focus Room
│   ├── edura-architecture.png    # Architecture diagrams
│   └── final_architecture.png
├── server/
│   └── index.js                  # Express backend (external course proxy + health check)
├── src/
│   ├── components/
│   │   ├── 3D/                   # Three.js scenes (HeroScene, BrainModel, etc.)
│   │   ├── ui/                   # 49 shadcn/ui primitives
│   │   ├── Navbar.tsx            # Navigation bar
│   │   ├── VoiceAssistant.tsx    # Voice-activated AI
│   │   ├── IDE.tsx               # Monaco Editor + Judge0 integration
│   │   ├── DiscussionForum.tsx   # Forum component
│   │   ├── StudyGroupChat.tsx    # Group chat component
│   │   └── MentorChat.tsx        # Mentor messaging
│   ├── hooks/                    # Custom React hooks
│   │   ├── useTranslation.ts     # Multi-language support
│   │   ├── useGoogleClassroom.ts # Classroom API integration
│   │   └── useSoundPlayer.ts     # Audio playback for Focus Room
│   ├── lib/
│   │   ├── gemini.ts             # All Gemini AI functions (13 functions, 979 lines)
│   │   ├── supabase.ts           # Supabase client initialization + types
│   │   ├── auth.ts               # Auth helper utilities
│   │   └── utils.ts              # Tailwind class merging
│   ├── pages/                    # 17 route-level page components
│   │   ├── Landing.tsx           # Marketing page with 3D visuals
│   │   ├── Dashboard.tsx         # Stats, courses, daily motivation
│   │   ├── AIBot.tsx             # AI chat interface
│   │   ├── Roadmap.tsx           # Roadmap browser + generator
│   │   ├── Notes.tsx             # Notes with AI processing
│   │   ├── Courses.tsx           # Course library + AI builder
│   │   ├── CourseDetail.tsx      # Course viewer with IDE + quizzes
│   │   ├── FocusRoom.tsx         # Pomodoro timer + ambient sounds
│   │   ├── StudyPlanner.tsx      # AI schedule + Classroom import
│   │   ├── Community.tsx         # Forum, groups, mentors, leaderboard
│   │   ├── Analytics.tsx         # Study analytics charts
│   │   └── Settings.tsx          # Profile and accessibility settings
│   ├── services/                 # Business logic layer (16 files)
│   │   ├── authService.ts        # Sign up, sign in, session management
│   │   ├── courseService.ts      # Course CRUD, progress, external courses
│   │   ├── notesService.ts       # Notes CRUD, file upload, PDF extraction
│   │   ├── roadmapService.ts     # Roadmap CRUD, milestone tracking
│   │   ├── ragService.ts         # RAG pipeline (chunk, embed, retrieve, generate)
│   │   ├── communityService.ts   # Forum, groups, mentors (with localStorage fallbacks)
│   │   ├── analyticsService.ts   # Study trend calculations
│   │   └── translateService.ts   # Translation with caching + rate limiting
│   ├── store/
│   │   ├── userStore.ts          # Auth state, XP, level, streak (Zustand)
│   │   └── themeStore.ts         # Theme, language, font preferences (Zustand)
│   ├── App.tsx                   # Router, providers, ProtectedRoute
│   └── main.tsx                  # React entry point
├── *.sql                         # 6 database migration files
├── .env.example                  # Environment variable template
├── package.json                  # Dependencies and scripts
├── vite.config.ts                # Vite config (proxy, port 8080)
└── tailwind.config.ts            # Tailwind CSS configuration
```

---

## AI Features in Detail

Edura uses **Google Gemini AI** for all intelligent features. Every AI function lives in `src/lib/gemini.ts`.

| Feature | Function | What It Does |
|---|---|---|
| AI Tutor | `chatWithGemini()` | Conversational study mentor with full chat history context |
| Simple Roadmap | `generateRoadmap()` | Generates 4-6 milestone learning path from a goal string |
| Detailed Roadmap | `generateDetailedRoadmap()` | Multi-stage roadmap based on skill level, timeline, and commitment |
| Roadmap Templates | `generateRoadmapTemplate()` | Creates roadmap.sh-style 10-20 node visual learning paths |
| Content Summary | `generateSummary()` | Structured summary with Overview, Key Concepts, Action Items |
| Flashcards | `generateFlashcards()` | 8 question-answer pairs from uploaded content |
| Quiz | `generateQuiz()` | 5-8 MCQ questions with explanations |
| Course Plan | `generateCoursePlan()` | Full curriculum with modules, capstone, videos, and starter code |
| Study Schedule | `generateAISchedule()` | Deadline-aware, priority-based schedule optimizer |
| Time-Aware Recs | `generateTimeAwareRecommendations()` | Study activity suggestions fitted to available time |
| Translation | `translateText()` | Fallback text translation when RapidAPI is unavailable |
| Daily Motivation | `generateDailyMotivation()` | Personalized 1-2 line motivational quotes |
| Embeddings | `generateEmbedding()` | 768-dim vectors for RAG similarity search |

### Prompt Engineering Approach

All AI functions use **zero-shot prompting** with strict JSON output schemas:
- Prompts include explicit JSON structure requirements
- Output is parsed and validated before use
- Conversation context is passed for the chat feature
- User profile data (skill level, goals, time) personalizes responses

---

## External Services

### Required
| Service | Free Tier | Purpose |
|---|---|---|
| [Supabase](https://supabase.com) | Yes | Database, auth, file storage |
| [Google AI Studio](https://makersuite.google.com/app/apikey) | Yes (rate limited) | Gemini AI for all intelligent features |

### Optional
| Service | Free Tier | Purpose |
|---|---|---|
| [RapidAPI Deep Translate](https://rapidapi.com) | Yes (limited) | UI translation |
| [Judge0](https://judge0.com) | Self-hosted free | Code execution for IDE |
| [Google Classroom API](https://console.cloud.google.com) | Yes | Import courses and assignments |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Supabase credentials not configured` | Check `.env` values and restart the dev server |
| `permission denied` on DB queries | Ensure all RLS policies from SQL files are applied |
| `Failed to get response from AI` | Verify Gemini API key and check quota limits |
| `429 Too Many Requests` | You've hit API rate limits - wait or upgrade your plan |
| `Failed to reach execution sandbox` | Ensure Judge0 Docker container is running |
| `popup_closed_by_user` (Classroom) | Allow pop-ups for `localhost:8080` |
| Community features show cached data | Forum/group tables may not exist in DB - creates localStorage fallback |

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
