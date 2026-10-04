# Edura — Complete Architecture Overview

## 1. FOLDER STRUCTURE (2 levels deep)

```
edura_geminihack-main/
├── public/                    # Static assets served by Vite
│   ├── audio/                 # Ambient sounds for Focus Room (rain.mp3, forest.mp3, cafe.mp3, oceanwaves.mp3)
│   ├── placeholder.svg        # Default placeholder image
│   ├── robots.txt             # SEO robots file
│   ├── edura-architecture.png # Architecture diagram images
│   └── final_architecture.png
├── server/                    # Express.js backend (port 3001)
│   └── index.js               # External courses API + health check
├── src/                       # React SPA source
│   ├── lib/                   # Core libraries: Supabase client, Gemini AI, auth helpers, utils
│   ├── services/              # Business logic layer: DB operations, API wrappers, AI orchestration
│   ├── pages/                 # Route-level page components (17 files)
│   ├── components/            # Shared UI components + 3D scenes
│   │   ├── 3D/                # Three.js components (HeroScene, BrainModel, CrystalShard, etc.)
│   │   └── ui/                # 49 shadcn/ui primitives (button, card, dialog, tabs, etc.)
│   ├── hooks/                 # Custom React hooks (mobile detection, translation, Classroom, sound)
│   ├── store/                 # Zustand state stores (userStore, themeStore)
│   ├── types/                 # TypeScript type definitions (classroom.ts)
│   ├── utils/                 # Utility scripts (generateSchedule.js — fallback scheduler)
│   ├── App.tsx                # Router, providers, ProtectedRoute wrapper
│   ├── main.tsx               # React entry point
│   └── index.css              # Global Tailwind styles
├── *.sql                      # Database migration files (6 files)
├── package.json               # Dependencies + scripts
├── vite.config.ts             # Vite config (proxy /api → :3001, port 8080)
├── tailwind.config.ts         # Tailwind CSS configuration
├── components.json            # shadcn/ui configuration
└── .env.example               # Environment variable template
```

---

## 2. DATA FLOW

```
User Action (click/submit)
    │
    ▼
┌─────────────────┐
│   Page Component │  (src/pages/*.tsx)
│   - state mgmt   │  - useState, useEffect
│   - event handler │  - calls service OR lib directly
└────────┬────────┘
         │
    ┌────┴────────────────────┐
    │                         │
    ▼                         ▼
┌──────────────┐     ┌──────────────┐
│   Service    │     │  Lib (direct)│  (some pages bypass services)
│ src/services │     │  src/lib/    │
│  - validates │     │  gemini.ts   │
│  - orchestr. │     │  auth.ts     │
└──────┬───────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
┌──────────────────────────────────┐
│         src/lib/                  │
│  supabase.ts → Supabase (DB/Auth/Storage)
│  gemini.ts   → Google Gemini API │
└──────────────┬───────────────────┘
               │
    ┌──────────┼──────────┬───────────┐
    ▼          ▼          ▼           ▼
 Supabase   Gemini    RapidAPI    Judge0
 (Postgres  (AI gen)  (Deep       (Code
  + Auth     embed)   Translate)   exec)
  + Storage)

State updates flow back:
  External API → lib → service → page setState
  Also: Zustand stores (userStore, themeStore) for cross-component state
  Also: localStorage for caching (quotes, translations, forum fallback)
```

**Concrete example — user creates a note with AI summary:**
```
Notes.tsx → extractTextFromFile() [notesService]
         → createNote()           [notesService → supabase.from('notes').insert]
         → generateSummary()      [lib/gemini.ts → Gemini API]
         → generateNoteSummary()  [notesService → supabase.from('notes').update]
```

---

## 3. EVERY FILE IN src/lib/

| File | Lines | Key Exports | Purpose |
|------|-------|-------------|---------|
| `supabase.ts` | 191 | `supabase` (client), `Database` (type) | Initializes Supabase client with env vars; declares TS types for users, courses, study_sessions, notes, roadmaps tables |
| `gemini.ts` | 979 | 13 functions + 24 types (see Section 7) | All Gemini AI integrations: chat, roadmaps, summaries, flashcards, quizzes, translation, course plans, motivation, schedules, embeddings, time-aware recommendations |
| `auth.ts` | 28 | `getCurrentUserId()`, `getCurrentUser()` | Helper functions to get the authenticated user from Supabase session |
| `utils.ts` | 7 | `cn(...inputs)` | Merges Tailwind CSS classes via clsx + tailwind-merge |

---

## 4. EVERY FILE IN src/services/

| File | Lines | Purpose | DB Tables Touched | Lib Imports |
|------|-------|---------|-------------------|-------------|
| `authService.ts` | 221 | Sign up/in/out, session management, auth init | `users` (select, insert), `supabase.auth.*` | `supabase`, `userStore` |
| `userService.ts` | 108 | XP/level/streak updates, profile fetch | `users` (select, update) | `supabase`, `userStore` |
| `courseService.ts` | 420 | Course CRUD, module fetch, progress tracking, external courses, quiz submission | `courses`, `modules`, `user_course_progress`, `users` | `supabase`, `auth` |
| `courseGeneratorService.ts` | 38 | Wraps Gemini course plan generation | None (AI only) | `auth`, `gemini` |
| `notesService.ts` | 215 | Notes CRUD, file upload to Storage, PDF text extraction, AI summary | `notes` (table + storage bucket) | `supabase`, `gemini` |
| `roadmapService.ts` | 212 | Roadmap CRUD (simple + detailed), milestone toggle | `roadmaps` | `supabase`, `gemini` |
| `roadmapShService.ts` | 350 | Curated list of roadmap.sh roadmaps (static data) | None | None |
| `roadmapTemplateService.ts` | 110 | DB-cached AI roadmap templates (generate-once) | `roadmap_templates` | `supabase`, `gemini` |
| `analyticsService.ts` | 381 | Weekly trends, focus scores, time blocks, subject performance + fallback data | `study_sessions`, `users`, `user_course_progress`, `courses` | `supabase`, `auth` |
| `communityService.ts` | 1133 | Forum posts/replies/likes, study groups, mentors — all with localStorage fallbacks | `forum_posts`, `forum_post_likes`, `forum_replies`, `study_groups`, `study_group_members`, `mentors`, `mentor_connections`, `users` | `supabase`, `auth` |
| `leaderboardService.ts` | 135 | XP leaderboard (week/month/all) with localStorage fallback | `users`, `study_sessions` | `supabase`, `auth` |
| `classroomService.ts` | 136 | Google Classroom API: courses, assignments, submissions, user profile | None (external API) | `types/classroom` |
| `eventsService.ts` | 0 | Empty file — not implemented | None | None |
| `ragService.ts` | 91 | RAG pipeline: chunk → embed → store → retrieve → generate | `embeddings`, RPC `match_embeddings` | `supabase`, `gemini` |
| `translateService.ts` | 380 | Deep Translate API via RapidAPI with caching + rate limiting | None (external API + localStorage cache) | None |
| `timeAwareService.ts` | 80 | Time-boxed learning recommendations wrapper | None (AI only) | `gemini` |

---

## 5. EVERY FILE IN src/pages/

| File | Lines | Purpose | Services Called | Lib Called Directly |
|------|-------|---------|----------------|---------------------|
| `Landing.tsx` | 193 | Marketing landing page with 3D hero scene | None | `utils.cn` |
| `Login.tsx` | 118 | Email/password sign-in form | `authService.signIn` | None |
| `Register.tsx` | 145 | Account registration form | `authService.signUp` | None |
| `Dashboard.tsx` | 606 | Stats dashboard (XP, courses, daily quote) | `userService.getUserProfile`, `courseService.getUserCourses/getCourseProgress` | `auth.getCurrentUserId`, `supabase` (raw query on `user_course_progress`), `gemini.generateDailyMotivation` |
| `AIBot.tsx` | 172 | AI chat interface | None | `gemini.chatWithGemini` |
| `Roadmap.tsx` | 1302 | Browse + generate learning roadmaps | `roadmapService.*`, `roadmapShService.*`, `roadmapTemplateService.*` | `auth.getCurrentUserId` |
| `Notes.tsx` | 754 | Notes with AI summary/flashcards/quiz/time-recs | `notesService.extractTextFromFile/createNote`, `timeAwareService.*` | `gemini.generateSummary/generateFlashcards/generateQuiz`, `auth.getCurrentUserId` |
| `FocusRoom.tsx` | 310 | Pomodoro timer with ambient sounds | None | None (uses `userStore.addXP` + `useSoundPlayer` hook) |
| `StudyVR.tsx` | 242 | External FrameVR link + info cards | None | None |
| `Courses.tsx` | 1195 | Course library + AI course builder | `courseService.getPublishedCourses/getUserCourses/getExternalCourses`, `courseGeneratorService.generatePersonalizedCourse` | None |
| `CourseDetail.tsx` | 1650 | Course viewer with modules/IDE/quizzes | `courseService.getCourseById/getCourseProgress/completeModule/updateCourseProgress`, `userService.updateUserXP/getUserProfile` | `auth.getCurrentUserId` |
| `Community.tsx` | 746 | Forum + study groups + mentors + leaderboard | `communityService.*`, `leaderboardService.getLeaderboard` | None |
| `Analytics.tsx` | 311 | Study analytics dashboard with charts | `analyticsService.getAnalyticsData/getFallbackAnalytics` | None |
| `StudyPlanner.tsx` | 516 | AI study schedule + Google Classroom sync | None | `gemini.generateAISchedule` (bypasses services) |
| `Settings.tsx` | 290 | Profile, accessibility, notifications, privacy | `translateService.SUPPORTED_LANGUAGES` (constant only) | None |
| `Events.tsx` | 1 | Empty file — not implemented, not routed | None | None |
| `NotFound.tsx` | 26 | 404 page | None | None |

---

## 6. DATABASE

### Tables with CREATE TABLE in SQL files (9 tables)

| Table | SQL File | Columns |
|-------|----------|---------|
| `users` | supabase-schema.sql:8 | `id` UUID PK (refs auth.users), `email` TEXT UNIQUE, `name` TEXT, `xp` INT(0), `level` INT(1), `streak` INT(0), `created_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ |
| `courses` | supabase-schema.sql:20 | `id` UUID PK, `owner_id` UUID FK→users, `title` TEXT, `description` TEXT, `primary_language` TEXT('en'), `translated_languages` JSONB, `level` TEXT(beginner/intermediate/advanced), `tags` TEXT[], `duration_days` INT, `cover_image_url` TEXT, `meta` JSONB, `published` BOOL, `is_ai_generated` BOOL, `category` TEXT, `total_modules` INT, `estimated_hours` INT, `rating` NUMERIC(3,1), `created_at`, `updated_at` |
| `modules` | supabase-schema.sql:43 | `id` UUID PK, `course_id` UUID FK→courses, `module_number` INT, `title` TEXT, `summary` TEXT, `content` JSONB, `time_required` INT, `flashcards` JSONB, `practice_tasks` JSONB, `quiz` JSONB, `created_at`, `updated_at`. UNIQUE(course_id, module_number) |
| `user_course_progress` | supabase-schema.sql:60 | `id` UUID PK, `course_id` UUID FK→courses, `user_id` UUID FK→users, `completed_modules` INT, `progress_percentage` NUMERIC(5,2), `quiz_scores` JSONB, `last_accessed` TIMESTAMPTZ, `created_at`, `updated_at`. UNIQUE(course_id, user_id) |
| `study_sessions` | supabase-schema.sql:74 | `id` UUID PK, `user_id` UUID FK→users, `duration_minutes` INT, `xp_earned` INT, `mode` TEXT(focus/break), `created_at` TIMESTAMPTZ |
| `notes` | supabase-schema.sql:84 | `id` UUID PK, `user_id` UUID FK→users, `title` TEXT, `content` TEXT, `summary` TEXT, `file_url` TEXT, `created_at`, `updated_at` |
| `roadmaps` | supabase-schema.sql:96 | `id` UUID PK, `user_id` UUID FK→users, `goal` TEXT, `milestones` JSONB, `progress_percentage` INT, `created_at`, `updated_at` |
| `embeddings` | supabase-rag.sql:5 | `id` UUID PK, `user_id` UUID FK→users, `content` TEXT, `embedding` VECTOR(768), `metadata` JSONB, `created_at` TIMESTAMPTZ |
| `roadmap_templates` | migrate-roadmap-templates.sql:5 | `id` UUID PK, `slug` TEXT UNIQUE, `title` TEXT, `description` TEXT, `content` JSONB, `created_at`, `updated_at` |

### Tables referenced in code but NO CREATE TABLE in SQL (9 tables)

| Table | Referenced In | Notes |
|-------|---------------|-------|
| `forum_posts` | communityService.ts | Falls back to localStorage |
| `forum_post_likes` | communityService.ts | Falls back to localStorage |
| `forum_replies` | communityService.ts | Falls back to localStorage |
| `forum_reply_likes` | communityService.ts (via join) | Falls back to localStorage |
| `study_groups` | communityService.ts | Falls back to localStorage |
| `study_group_members` | communityService.ts | Falls back to localStorage |
| `study_group_messages` | StudyGroupChat.tsx | Falls back to localStorage |
| `mentors` | communityService.ts | Falls back to localStorage |
| `mentor_connections` | communityService.ts | Falls back to localStorage |
| `mentor_messages` | MentorChat.tsx | Falls back to localStorage |

### SQL Functions

| Function | File | Purpose |
|----------|------|---------|
| `update_updated_at_column()` | supabase-schema.sql:256 | Trigger: sets `updated_at = NOW()` on UPDATE |
| `handle_new_user()` | fix-rls-policy-complete.sql:15 | Trigger (SECURITY DEFINER): auto-inserts `users` row on `auth.users` INSERT |
| `match_embeddings(query_embedding, match_count, match_user_id)` | supabase-rag.sql:22 | RPC: cosine similarity search on embeddings via `<#>` operator |

### Storage Buckets

| Bucket | Defined In | Purpose |
|--------|-----------|---------|
| `notes` | supabase-schema.sql:284 | Public bucket for uploaded note files |

---

## 7. AI FUNCTIONS (lib/gemini.ts)

| Function | Line | Purpose | Called By | Output Format |
|----------|------|---------|-----------|---------------|
| `chatWithGemini(messages)` | 240 | Conversational AI study mentor | AIBot.tsx, VoiceAssistant.tsx, ragService.ts | `string` (plain text reply) |
| `generateRoadmap(goal)` | 261 | Simple 4-6 milestone roadmap | roadmapService.createRoadmap | `RoadmapMilestone[]` (JSON array) |
| `generateDetailedRoadmap(answers)` | 296 | Multi-stage personalized roadmap from questionnaire | roadmapService.createDetailedRoadmap | `DetailedRoadmap` (JSON object with stages, finalProject, resourceList) |
| `generateSummary(content)` | 360 | Structured study material summary | notesService.generateNoteSummary, Notes.tsx | `string` (markdown-ish text) |
| `generateFlashcards(content)` | 371 | 8 Q&A flashcards from content | Notes.tsx | `Flashcard[]` (JSON array of {question, answer}) |
| `generateQuiz(content)` | 395 | 5-8 MCQ quiz questions | Notes.tsx | `QuizQuestion[]` (JSON array of {question, options, correctAnswer, explanation}) |
| `translateText(text, lang)` | 430 | Gemini-powered text translation | useTranslation.ts (fallback) | `string` |
| `generateCoursePlan(input)` | 441 | Full week-by-week course curriculum | courseGeneratorService | `GeneratedCoursePlan` (JSON: modules, capstone, videos, IDE snippet) |
| `generateDailyMotivation(input)` | 595 | Personalized motivational quote | Dashboard.tsx | `string` (1-2 line quote) |
| `generateRoadmapTemplate(topic, slug)` | 653 | roadmap.sh-style 10-20 node roadmap | roadmapTemplateService | `RoadmapTemplate` (JSON with nodes array) |
| `generateAISchedule(input)` | 759 | Deadline-aware study schedule optimizer | StudyPlanner.tsx | `{ schedule: DaySchedule[], warnings: string[] }` |
| `generateTimeAwareRecommendations(input)` | 878 | Time-boxed learning recommendations | timeAwareService | `TimeAwareRecommendation[]` (JSON array) |
| `generateEmbedding(text)` | 6 | Text → vector embedding (embedding-001) | ragService.generateEmbedding | `number[]` (768-dim vector) |

---

## 8. EXTERNAL API CALLS

### Google Gemini API (`@google/genai`)
| File | Line | Call |
|------|------|------|
| `src/lib/gemini.ts:184` | `ai.models.generateContent({model, contents})` | All text generation (13 functions) |
| `src/lib/gemini.ts:13` | `ai.models.embedContent({model, content})` | Embedding generation |

### Supabase (PostgreSQL + Auth + Storage)
| File | Lines | Operations |
|------|-------|------------|
| `src/services/authService.ts:21,114,155,173` | `supabase.auth.signUp/signInWithPassword/signOut/getSession` |
| `src/services/authService.ts:43,58,123,194` | `supabase.from('users').select/insert` |
| `src/services/userService.ts:11,59,96` | `supabase.from('users').select/update` |
| `src/services/courseService.ts:71,116,141,150,183,230,253,302,344` | `supabase.from('courses'/'modules'/'user_course_progress'/'users').*` |
| `src/services/notesService.ts:23,137,163,184,201` | `supabase.from('notes').*`, `supabase.storage.from('notes').*` |
| `src/services/roadmapService.ts:45,103,134,158,176,200` | `supabase.from('roadmaps').*` |
| `src/services/roadmapTemplateService.ts:13,37` | `supabase.from('roadmap_templates').*` |
| `src/services/analyticsService.ts:73,83,89,102` | `supabase.from('study_sessions'/'users'/'user_course_progress'/'courses').*` |
| `src/services/communityService.ts:58,120,159,175,196,259,295,346,356,381,459` | `supabase.from('forum_posts'/'forum_post_likes'/'forum_replies'/'study_groups'/'study_group_members'/'mentors'/'mentor_connections'/'users').*` |
| `src/services/leaderboardService.ts:30,40` | `supabase.from('users'/'study_sessions').*` |
| `src/services/ragService.ts:44,50,83` | `supabase.from('embeddings').*`, `supabase.rpc('match_embeddings')` |
| `src/pages/Dashboard.tsx:133,246` | `supabase.from('user_course_progress').*` (raw query, bypassing service) |

### RapidAPI Deep Translate
| File | Line | Call |
|------|------|------|
| `src/services/translateService.ts:146` | `fetch('https://deep-translate1.p.rapidapi.com/language/translate/v2', {POST})` |

### Judge0 Code Execution
| File | Line | Call |
|------|------|------|
| `src/components/IDE.tsx:144` | `fetch('${judgeBaseUrl}/submissions?base64_encoded=false&wait=true', {POST})` |

### Google Classroom API
| File | Lines | Call |
|------|-------|------|
| `src/services/classroomService.ts:7` | `fetch('https://classroom.googleapis.com/v1/...', {GET})` — courses, courseWork, studentSubmissions |
| `src/services/classroomService.ts:132` | `fetch('https://www.googleapis.com/oauth2/v1/userinfo', {GET})` — user profile |

### Express Backend (self-hosted)
| File | Line | Call |
|------|------|------|
| `src/services/courseService.ts:395` | `fetch('${apiUrl}/courses/external', {GET})` — proxied to `server/index.js:353` |

---

## 9. STATE MANAGEMENT

### Zustand Stores

**`userStore.ts`** (`src/store/userStore.ts`, 51 lines)
- Persisted to localStorage key `edura-user`
- State: `isAuthenticated`, `user: { name, email, xp, level, streak }`
- Actions: `login(email, name)`, `logout()`, `addXP(amount)`
- Used by: App.tsx (ProtectedRoute), Dashboard.tsx, FocusRoom.tsx, Navbar.tsx, VoiceAssistant.tsx, authService.ts, userService.ts

**`themeStore.ts`** (`src/store/themeStore.ts`, 39 lines)
- Persisted to localStorage key `edura-theme`
- State: `mode` (light/dark/colorblind/dyslexia), `isDyslexia`, `isColorblind`, `language`, `fontSize`
- Actions: `setMode()`, `toggleDyslexia()`, `toggleColorblind()`, `setLanguage()`, `setFontSize()`
- Used by: ThemeProvider.tsx, Settings.tsx, useTranslation.ts

### TanStack Query
- `QueryClientProvider` wraps the app in `App.tsx:45` but **no `useQuery`/`useMutation` hooks are used anywhere**. All data fetching is done via `useEffect` + async functions + `useState`. TanStack Query is installed but effectively unused.

### localStorage Usage

| Key | File | Purpose |
|-----|------|---------|
| `edura-user` | userStore.ts (Zustand persist) | Auth state + user profile |
| `edura-theme` | themeStore.ts (Zustand persist) | Theme/language/font preferences |
| `edura-daily-quote` + `edura-daily-quote-date` | Dashboard.tsx:198-199 | Cached daily motivational quote |
| `translationCache` | translateService.ts:33 | Cached RapidAPI translations |
| `forum_posts` | communityService.ts:473 | Forum posts fallback when DB tables missing |
| `forum_replies_${postId}` | communityService.ts:611 | Forum replies fallback |
| `study_groups` | communityService.ts:713 | Study groups fallback |
| `mentors` | communityService.ts:911 | Mentors list fallback |
| `leaderboard` | leaderboardService.ts:112 | Leaderboard fallback |
| `study-planner-tasks` | StudyPlanner.tsx | Persisted study planner tasks |
| `study-planner-schedule` | StudyPlanner.tsx | Persisted generated schedule |
| `courseDetail_modules_${id}` | CourseDetail.tsx | Cached external course modules |
| `courseDetail_progress_${id}` | CourseDetail.tsx | Cached external course progress |

---

## 10. AUTH FLOW

### Step-by-step: Signup → Authenticated Request

```
1. User fills Register.tsx form (name, email, password)
       │
       ▼
2. authService.signUp() called
       │
       ├── 2a. supabase.auth.signUp({ email, password, options: { data: { name } } })
       │        → Creates row in auth.users (Supabase managed)
       │        → Returns JWT session (access_token + refresh_token)
       │        → Supabase client stores tokens in localStorage automatically
       │
       ├── 2b. Postgres trigger fires: handle_new_user() [fix-rls-policy-complete.sql:15]
       │        → SECURITY DEFINER function
       │        → INSERT INTO public.users (id, email, name) from auth.users metadata
       │
       ├── 2c. authService polls public.users up to 10 times (300ms intervals)
       │        waiting for trigger-created profile
       │
       └── 2d. If profile not found after polling:
                → Manual INSERT INTO public.users with id, email, name, xp=0, level=1, streak=0
       │
       ▼
3. Zustand userStore updated:
       useUserStore.getState().login(email, name)
       useUserStore.setState({ user: { name, email, xp, level, streak } })
       → Persisted to localStorage key 'edura-user'
       │
       ▼
4. Navigate to /dashboard
```

### JWT Handling

- **Storage:** Supabase JS client stores JWT in localStorage automatically (`persistSession: true` in `src/lib/supabase.ts:14`)
- **Auto-refresh:** `autoRefreshToken: true` — client refreshes before expiry
- **Every Supabase request:** The client attaches `Authorization: Bearer <jwt>` automatically. The anon key is also set as a default header (`src/lib/supabase.ts:20-22`)
- **RLS enforcement:** All tables have Row Level Security enabled. Policies use `auth.uid()` to scope data to the current user

### Session Restoration (App Load)

```
1. App.tsx useEffect → initializeAuth() [authService.ts:184]
       │
       ├── 2. supabase.auth.getSession() → checks localStorage for existing JWT
       │
       ├── 3. If valid session found:
       │      → Fetch profile from public.users WHERE id = session.user.id
       │      → Update Zustand userStore with profile data
       │      → isAuthenticated = true
       │
       └── 4. If no session or profile fetch fails:
              → useUserStore.getState().logout()
              → isAuthenticated = false
```

### ProtectedRoute (`src/App.tsx:33-36`)

```tsx
function ProtectedRoute({ children }) {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}
```

- Reads `isAuthenticated` from Zustand (persisted in localStorage)
- Wraps all authenticated routes: /dashboard, /ai-bot, /roadmap, /notes, /focus, /study-vr, /courses, /courses/:courseId, /community, /analytics, /study-planner, /settings
- Does NOT verify JWT validity — relies on Zustand state. If localStorage has `isAuthenticated: true` but JWT expired, page loads but Supabase calls will fail with auth errors
