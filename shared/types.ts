// shared/types.ts
// Single source of truth for all types used by both frontend and backend.
// NEVER duplicate these types elsewhere. Import from here.
// Only modify this file via PR with both people reviewing.

// ─── Student ─────────────────────────────────────────────────────────────────

export interface Student {
  studentId: string
  name: string
  subjects: string[]
  examDates: ExamDate[]
  goals: string
  studyHoursPerDay: number
  createdAt: string
}

export interface ExamDate {
  subject: string
  date: string // ISO 8601
}

// ─── Study Path ───────────────────────────────────────────────────────────────

export interface RoadmapNode {
  id: string
  subject: string
  topic: string
  status: 'locked' | 'available' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedMinutes: number
  dependsOn: string[] // node ids
  examDate?: string
}

export interface StudyPathResponse {
  studentId: string
  studyPath: RoadmapNode[]
  xp: number
  level: number
  streak: number
  nextExam: NextExam | null
  todaysFocus: TodaysFocus
  badges: Badge[]
}

export interface NextExam {
  subject: string
  date: string
  daysLeft: number
}

export interface TodaysFocus {
  subject: string
  topic: string
  reason: string
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export interface Badge {
  id: string
  name: string
  description: string
  icon: string // emoji or icon name
  earnedAt: string
  type: 'streak' | 'mastery' | 'speed' | 'consistency' | 'first'
}

// ─── Tutor / Agents ───────────────────────────────────────────────────────────

export interface TutorMessageRequest {
  studentId: string
  subject: string
  message: string
  voiceMode: boolean
  sessionHistory: OnboardChatMessage[]  // full conversation so far, empty on first message
  sessionId?: string
}

export interface TutorMessageResponse {
  reply: string
  sessionId: string
  agentActivity: AgentActivity[]
  memoryUpdated: boolean
  xpGained: number
  newBadge?: Badge
}

export interface AgentActivity {
  agent: 'orchestrator' | 'tutor' | 'assessment' | 'memory'
  action: string
  timestamp: string
}

// ─── Assessment ───────────────────────────────────────────────────────────────

export interface Problem {
  problemId: string
  subject: string
  topic: string
  question: string
  type: 'multiple_choice' | 'short_answer' | 'calculation'
  options?: string[] // only for multiple_choice
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface AssessmentStartRequest {
  studentId: string
  subject: string
  topic: string
}

export interface AssessmentStartResponse {
  sessionId: string
  problems: Problem[]
  estimatedMinutes: number
}

export interface AssessmentSubmitRequest {
  sessionId: string
  studentId: string
  answers: { problemId: string; answer: string }[]
}

export interface AssessmentSubmitResponse {
  score: number
  gaps: string[]
  feedback: ProblemFeedback[]
  xpGained: number
  memoryUpdated: boolean
  agentActivity: AgentActivity[]
}

export interface ProblemFeedback {
  problemId: string
  correct: boolean
  explanation: string
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export interface SubjectMemory {
  weak: string[]
  strong: string[]
  lastSession: string | null
  sessionsCount: number
  averageScore: number
}

export interface StudentMemory {
  studentId: string
  name: string
  subjects: Record<string, SubjectMemory>
  lastActive: string
  totalSessions: number
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

// Conversational onboarding — chat message
export interface OnboardChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// POST /api/onboard/chat — one turn of the interview
export interface OnboardChatRequest {
  name: string
  messages: OnboardChatMessage[]
}

export interface OnboardChatResponse {
  reply: string           // AI's next message to show the student
  done: boolean           // true when AI has collected enough info
  extracted?: ExtractedOnboardData  // only present when done: true
}

// Structured data Claude extracts from the conversation
export interface ExtractedOnboardData {
  subjects: {
    name: string          // e.g. "Calculus 1"
    level: string         // e.g. "university", "high school"
    currentStruggles: string
  }[]
  goals: string
  examDates: ExamDate[]   // empty array if no exams
  studyHoursPerDay: number
  learningStyle: 'examples' | 'theory' | 'mixed'
}

// POST /api/onboard/complete — finalizes onboarding, creates student + roadmap
export interface OnboardCompleteRequest {
  name: string
  extracted: ExtractedOnboardData
  syllabus?: string       // optional pasted syllabus text
}

export interface OnboardResponse {
  studentId: string
  studyPath: RoadmapNode[]
  xp: number
  streak: number
  nextFocus: string
}

// POST /api/tutor/add — existing student adds a new subject
export interface AddSubjectRequest {
  studentId: string
  extracted: ExtractedOnboardData
  syllabus?: string
}

export interface AddSubjectResponse {
  studyPath: RoadmapNode[]   // new subject nodes only
  nextFocus: string
}

// ─── Lesson ───────────────────────────────────────────────────────────────────

export interface LessonKeyPoint {
  title: string
  explanation: string
  example?: string
}

export interface LessonQuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface LessonContent {
  intro: string
  keyPoints: LessonKeyPoint[]
  quiz: LessonQuizQuestion[]
  summary: string
  xpReward: number
}

export interface LessonContentRequest {
  nodeId: string
  studentId: string
}

export interface LessonContentResponse {
  lesson: LessonContent
  node: RoadmapNode
}

export interface LessonCompleteRequest {
  nodeId: string
  studentId: string
  score: number
}

export interface LessonCompleteResponse {
  xpGained: number
  nodeUnlocked: string | null
  message: string
}

// ─── TTS ──────────────────────────────────────────────────────────────────────

export interface TTSRequest {
  text: string
  voice?: 'tutor' | 'assessment' | 'default'
}

// ─── API Errors ───────────────────────────────────────────────────────────────

export interface APIError {
  error: string
  code: 'STUDENT_NOT_FOUND' | 'INVALID_SUBJECT' | 'AGENT_ERROR' | 'VALIDATION_ERROR'
  status: number
}
