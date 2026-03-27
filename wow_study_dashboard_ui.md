# WOW Study — Dashboard & Subject Detail UI Instructions
> Based on screenshots: Dashboard = Railway-style card grid | Subject Detail = roadmap/XP view

---

## Mental Model

```
/dashboard
  └── Grid of subject cards (one per tutor)     ← looks like Screenshot 2 (Railway)
        │
        └── click any card
              │
              └── /dashboard/[subject]           ← looks like Screenshot 1 (Aisha view)
                    Shows: today's focus, XP, badges, roadmap nodes, next session
```

---

## Page: `/dashboard` — Subject Card Grid

### Page Layout
```
background: var(--bg-base)        /* #0A0C0F */
min-height: 100vh
padding-top: 64px                 /* below fixed navbar */
```

### Content Area
```
max-width: 1200px
margin: 0 auto
padding: 40px 40px
```

### Page Header — above the grid
```
margin-bottom: 32px

TITLE: "Your subjects"
  font: Syne 700, 28px, var(--text-primary)

SUBTITLE: "Click a subject to start studying"
  font: DM Sans 400, 14px, var(--text-secondary)
  margin-top: 4px
```

### Card Grid
```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
gap: 16px;
```

---

### Subject Card (filled — existing tutor)

Mirrors Screenshot 2's "Double A" card: dark, rounded, has icon badges at bottom.

```
width: 100%
background: #111318          /* var(--bg-surface) */
border: 1px solid #1F2430    /* var(--bg-border) */
border-radius: 16px
padding: 20px 20px 16px
cursor: pointer
position: relative
overflow: hidden
transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s

hover:
  border-color: [subject accent, 50% opacity]
  transform: translateY(-2px)
  box-shadow: 0 8px 32px rgba(0,0,0,0.4)
```

**Top Row (card header):**
```
display: flex
justify-content: space-between
align-items: flex-start
margin-bottom: 16px

LEFT — Subject icon + title group:
  display: flex, align-items: center, gap: 12px

  ICON CONTAINER:
    width: 36px, height: 36px
    border-radius: 10px
    background: [accent color at 12% opacity]
    border: 1px solid [accent color at 30% opacity]
    display: flex, align-items: center, justify-content: center
    font-size: 18px (emoji or SVG icon)

    Subject map:
      Math        → icon: "∑"  accent: #8B5CF6 (purple)
      Physics     → icon: "⚛"  accent: #3B82F6 (blue)
      CS          → icon: "</>" accent: #22C55E (green)
      History     → icon: "📜"  accent: #F59E0B (gold)
      Geography   → icon: "🌍"  accent: #06B6D4 (cyan)
      Biology     → icon: "🧬"  accent: #10B981 (emerald)
      Chemistry   → icon: "⚗"  accent: #F43F5E (rose)
      Default     → icon: "📖"  accent: #F59E0B (gold)

  SUBJECT NAME:
    font: Syne 700, 17px, var(--text-primary)

RIGHT — 3-dot menu button:
  width: 28px, height: 28px
  border-radius: 6px
  background: transparent
  border: none
  cursor: pointer
  display: flex, align-items: center, justify-content: center
  color: var(--text-muted)
  font-size: 16px (•••)

  hover:
    background: var(--bg-elevated)   /* #181C23 */
    color: var(--text-secondary)
```

**Middle Row (meta tags):**
```
display: flex, gap: 8px, flex-wrap: wrap
margin-bottom: 20px

OWNER TAG:
  height: 24px, padding: 0 10px
  background: #1F2430
  border: 1px solid #2A3040
  border-radius: 100px
  font: DM Sans 500, 12px, var(--text-secondary)
  display: flex, align-items: center

  text: student's level e.g. "University"
  or: "Beginner" / "Intermediate" / "Advanced"

EXAM TAG (if exam date set):
  same pill style
  background: rgba(239, 68, 68, 0.08)
  border: 1px solid rgba(239, 68, 68, 0.25)
  font color: #EF4444

  text: "Exam Apr 17"

  if exam ≤ 7 days:
    background: rgba(239, 68, 68, 0.15)
    border-color: #EF4444
    add animated pulse dot:
      width: 6px, height: 6px
      background: #EF4444
      border-radius: 50%
      margin-right: 4px
      animation: pulse 1.5s ease-in-out infinite
```

**Bottom Row (stats bar — mirrors Railway's icon badges):**
```
display: flex
justify-content: space-between
align-items: center
padding-top: 14px
border-top: 1px solid #1F2430

LEFT — icon stat badges:
  display: flex, gap: 12px

  Each badge:
    display: flex, align-items: center, gap: 5px
    font: DM Sans 500, 13px, var(--text-secondary)

    BADGE 1 — Sessions:
      icon: chat-bubble SVG 14px, color: var(--text-muted)
      text: "4 sessions"
      (show badge count like Railway: number in small circle)

      COUNT BUBBLE:
        min-width: 18px, height: 18px
        background: var(--bg-elevated)
        border: 1px solid var(--bg-border)
        border-radius: 100px
        font: DM Sans 600, 11px, var(--text-secondary)
        display: flex, align-items: center, justify-content: center
        padding: 0 5px

    BADGE 2 — Progress nodes:
      icon: roadmap/path SVG 14px, color: var(--text-muted)
      text: count bubble same style
      shows: completed node count e.g. "2"

RIGHT — XP indicator:
  font: DM Sans 600, 13px, [subject accent color]
  text: "+ 1 more" OR "650 XP"
  
  if subject has unseen progress:
    background: [accent at 10%]
    border: 1px solid [accent at 30%]
    border-radius: 100px
    padding: 2px 8px
```

**Card background decoration:**
```css
/* Subtle accent glow in bottom-right corner */
.card::after {
  content: '';
  position: absolute;
  bottom: -30px;
  right: -30px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(circle, [accent at 6%] 0%, transparent 70%);
  pointer-events: none;
}
```

---

### "Add New Subject" Card (dashed — matches Screenshot 2's "+ New project")

```
width: 100%
min-height: 140px
background: transparent
border: 2px dashed #1F2430
border-radius: 16px
cursor: pointer
display: flex
flex-direction: column
align-items: center
justify-content: center
gap: 10px
transition: all 0.2s

hover:
  border-color: #92610A      /* var(--gold-dim) */
  background: rgba(245, 158, 11, 0.05)

PLUS ICON:
  font-size: 22px
  color: var(--text-muted)       /* #4A4F5C */
  parent hover → color: var(--gold)   /* #F59E0B */
  transition: color 0.2s

TEXT: "+ New subject"
  font: Syne 600, 15px
  color: var(--text-muted)
  parent hover → color: var(--gold)
  transition: color 0.2s

→ onClick: router.push('/onboarding')
```

---

### Full Dashboard Code Structure

```tsx
// app/dashboard/page.tsx

export default function Dashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Load from GET /api/study-path/:studentId
  // subjects comes from student.memory.subjects object
  // Transform to array: Object.entries(memory.subjects).map(...)

  return (
    <div className="dashboard-page">
      <Navbar />
      <main>
        <header>
          <h1>Your subjects</h1>
          <p>Click a subject to start studying</p>
        </header>

        <div className="subject-grid">
          {subjects.map(subject => (
            <SubjectCard
              key={subject.name}
              subject={subject}
              onClick={() => router.push(`/dashboard/${slug(subject.name)}`)}
            />
          ))}
          <AddSubjectCard onClick={() => router.push('/onboarding')} />
        </div>
      </main>
    </div>
  );
}
```

---

## Page: `/dashboard/[subject]` — Subject Detail View

This is Screenshot 1 — the detailed roadmap + XP view after clicking a card.

### Page Layout
```
background: #F5E47A            /* warm yellow — exactly as shown in screenshot */
min-height: 100vh
padding: 48px 48px

Note: this page intentionally breaks from the dark theme.
The yellow background is the "active study session" feel.
It makes this page feel warm, focused, energetic.
```

### Page Header
```
display: flex
justify-content: space-between
align-items: flex-start
margin-bottom: 40px

LEFT:
  BACK BUTTON (above title):
    display: flex, align-items: center, gap: 6px
    font: DM Sans 400, 13px, #6B5B00
    margin-bottom: 12px
    cursor: pointer
    
    "← Back to subjects"
    
    hover: color: #3D3400

  GREETING: "Welcome back, {name}"
    font: Syne 800, 48px, #1A1500
    line-height: 1.1
    margin-bottom: 8px

  SUBTITLE: "Your study path is ready. Keep the streak going."
    font: DM Sans 400, 16px, #6B5B00

RIGHT — STREAK BADGE:
  height: 36px, padding: 0 16px
  background: #FFFFFF
  border-radius: 100px
  display: flex, align-items: center, gap: 8px
  box-shadow: 0 2px 8px rgba(0,0,0,0.08)

  DOT: width: 10px, height: 10px
       background: #22C55E
       border-radius: 50%

  TEXT: "Streak: {streak} days"
    font: DM Sans 500, 14px, #1A1500
```

### Two-Column Layout
```
display: grid
grid-template-columns: 280px 1fr
gap: 24px
align-items: start

@media (max-width: 900px):
  grid-template-columns: 1fr
```

---

### Left Column — "Today" Panel

```
background: #EDD94A            /* slightly darker yellow — matches screenshot */
border: 1px solid rgba(0,0,0,0.06)
border-radius: 16px
padding: 24px
```

**TODAY label:**
```
font: DM Sans 600, 11px, #6B5B00
letter-spacing: 0.08em
text-transform: uppercase
margin-bottom: 14px
```

**Focus title:**
```
font: Syne 700, 22px, #1A1500
margin-bottom: 4px
text: subjects being studied today e.g. "Math + Biology"
```

**Focus blocks:**
```
font: DM Sans 400, 14px, #6B5B00
margin-bottom: 24px
text: "{n} focus blocks"
```

**XP Section:**
```
XP LABEL:
  font: DM Sans 600, 11px, #6B5B00
  letter-spacing: 0.08em
  text-transform: uppercase
  margin-bottom: 10px

XP BAR CONTAINER:
  height: 8px
  background: rgba(0,0,0,0.12)
  border-radius: 100px
  margin-bottom: 8px
  overflow: hidden

  FILL:
    height: 100%
    background: #E67E00         /* orange, matches screenshot */
    border-radius: 100px
    width: [xp / 1000 * 100]%
    
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1)
    
    if animating (new XP gained):
      add shimmer sweep:
      background: linear-gradient(
        90deg, #E67E00 0%, #FBBF24 50%, #E67E00 100%
      )
      background-size: 200% 100%
      animation: shimmer 1.5s ease 1

XP TEXT:
  font: DM Sans 400, 13px, #6B5B00
  text: "{current} / {max} XP to Level {level}"
```

**Badges Section:**
```
BADGES LABEL:
  font: DM Sans 600, 11px, #6B5B00
  letter-spacing: 0.08em
  text-transform: uppercase
  margin-top: 20px
  margin-bottom: 10px

BADGES CONTAINER:
  display: flex, flex-wrap: wrap, gap: 8px

BADGE PILL:
  height: 28px, padding: 0 12px
  background: #FFFFFF
  border: 1px solid rgba(0,0,0,0.1)
  border-radius: 100px
  font: DM Sans 500, 13px, #3D3400
  display: flex, align-items: center
  
  Badges come from student data — show all earned badges
  Examples: "Focus 5", "Quiz Ace", "Week 1", "7-Day Streak"
```

---

### Right Column — Roadmap + Next Session

#### Roadmap Card
```
background: #EDD94A
border: 1px solid rgba(0,0,0,0.06)
border-radius: 16px
padding: 24px
margin-bottom: 20px
```

**Roadmap header:**
```
display: flex
justify-content: space-between
align-items: center
margin-bottom: 20px

LEFT: "Your roadmap"
  font: Syne 700, 20px, #1A1500

RIGHT: "Week {n} of {total}"
  font: DM Sans 400, 14px, #6B5B00
```

**Roadmap nodes grid:**
```
display: grid
grid-template-columns: repeat(3, 1fr)
gap: 12px

@media (max-width: 700px):
  grid-template-columns: 1fr 1fr
```

**Roadmap Node Card:**
```
background: #FEFCE8            /* near-white yellow */
border: 1px solid rgba(0,0,0,0.08)
border-radius: 12px
padding: 18px 16px

SUBJECT TAG:
  font: DM Sans 600, 11px, #6B5B00
  letter-spacing: 0.07em
  text-transform: uppercase
  margin-bottom: 8px

NODE TITLE:
  font: Syne 700, 18px, #1A1500
  margin-bottom: 12px

STATUS BADGE (bottom):
  height: 26px, padding: 0 10px
  border-radius: 100px
  display: inline-flex, align-items: center
  font: DM Sans 500, 12px

  "In progress":
    background: rgba(230, 126, 0, 0.12)
    border: 1px solid rgba(230, 126, 0, 0.3)
    color: #B45309

  "Up next":
    background: rgba(59, 130, 246, 0.1)
    border: 1px solid rgba(59, 130, 246, 0.3)
    color: #1D4ED8

  "Locked":
    background: rgba(0,0,0,0.05)
    border: 1px solid rgba(0,0,0,0.1)
    color: #6B5B00

  "Completed":
    background: rgba(34, 197, 94, 0.12)
    border: 1px solid rgba(34, 197, 94, 0.3)
    color: #15803D

Node status determines click behavior:
  "In progress" or "Up next" → clickable → router.push('/tutor/[subject]')
  "Locked" → show tooltip "Complete previous nodes first"
  "Completed" → clickable → opens review mode
```

#### Next Session Card
```
background: #EDD94A
border: 1px solid rgba(0,0,0,0.06)
border-radius: 16px
padding: 24px
display: flex
justify-content: space-between
align-items: center

@media (max-width: 600px):
  flex-direction: column
  gap: 16px
  align-items: flex-start

LEFT:
  NEXT SESSION LABEL:
    font: DM Sans 600, 11px, #6B5B00
    letter-spacing: 0.08em
    text-transform: uppercase
    margin-bottom: 8px

  SESSION TITLE: "25 min Focus Sprint"
    font: Syne 700, 24px, #1A1500
    margin-bottom: 4px
    
    Duration comes from student.memory.studyHoursPerDay:
      ≤1h/day → "25 min Focus Sprint"
      2–3h/day → "45 min Deep Dive"
      4+h/day  → "60 min Power Session"

  SUBTITLE: "Starts when you are ready"
    font: DM Sans 400, 14px, #6B5B00

RIGHT — "Start now" button:
  height: 48px, padding: 0 28px
  background: #E67E00            /* orange CTA — matches screenshot exactly */
  color: #FFFFFF
  font: Syne 700, 15px
  border-radius: 10px
  border: none
  cursor: pointer

  hover:
    background: #D97706
    transform: translateY(-1px)
    box-shadow: 0 4px 16px rgba(230, 126, 0, 0.4)
    transition: all 0.15s

  → onClick: router.push('/tutor/[subject]?mode=sprint&duration=25')
```

---

## Data Mapping — Backend → UI

```typescript
// GET /api/study-path/:studentId returns:
interface StudyPathResponse {
  studyPath: RoadmapNode[];
  xp: number;
  streak: number;
  nextFocus: string;    // "Math + Biology"
  subjects: SubjectMemory;
}

// Transform for dashboard grid:
const subjectCards = Object.entries(student.memory.subjects).map(([name, data]) => ({
  name,
  level: data.level,               // "university" | "high-school" etc
  weakTopics: data.weak,           // ["chain rule", ...]
  sessionsCount: data.sessionsCount,
  examDate: memory.examDates.find(e => e.subject === name)?.date,
  progress: {
    completed: data.sessionsCount,  // rough proxy until node tracking built
    total: 8                        // default roadmap length
  },
  accent: SUBJECT_COLORS[name.toLowerCase()] ?? '#F59E0B'
}));

// Transform for subject detail:
const roadmapNodes = student.memory.studyPath
  .filter(node => node.subject === selectedSubject)
  .map((node, i) => ({
    ...node,
    status: i === 0 ? 'In progress'
          : i === 1 ? 'Up next'
          : 'Locked'
    // Replace with real completion tracking once tutor sessions log progress
  }));
```

---

## Routing & State Flow

```
/dashboard
  ↓ click subject card
/dashboard/[subject]
  (loads subject detail — yellow page)
  ↓ click "Start now" or "In progress" node
/tutor/[subject]
  (the actual chat/voice session — not yet built)
  ↓ session ends
/dashboard/[subject]
  (back to detail, XP updated)
```

```typescript
// app/dashboard/[subject]/page.tsx
export default function SubjectDetail({ params }: { params: { subject: string } }) {
  const subjectName = decodeURIComponent(params.subject); // "math", "physics" etc
  const studentId = localStorage.getItem('studentId');

  // fetch /api/study-path/:studentId
  // filter nodes by subject
  // render yellow layout
}
```

---

## Animations

### Dashboard card entrance (on first load)
```css
.subject-card {
  animation: cardIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.subject-card:nth-child(1) { animation-delay: 0ms; }
.subject-card:nth-child(2) { animation-delay: 80ms; }
.subject-card:nth-child(3) { animation-delay: 160ms; }
.subject-card:nth-child(4) { animation-delay: 240ms; }

@keyframes cardIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Subject detail page entrance
```css
/* Left panel slides in from left */
.today-panel {
  animation: slideInLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* Right panel slides in from right */
.roadmap-panel {
  animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* XP bar fills on mount */
.xp-fill {
  animation: xpFill 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both;
}

@keyframes xpFill {
  from { width: 0%; }
  to   { width: var(--xp-pct); }  /* set as CSS var from JS */
}
```

### Roadmap node hover
```css
.roadmap-node:not(.locked) {
  transition: transform 0.15s, box-shadow 0.15s;
}

.roadmap-node:not(.locked):hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
}

.roadmap-node.locked {
  opacity: 0.55;
  cursor: not-allowed;
}
```

---

## File Structure (additions to previous guide)

```
app/
├── dashboard/
│   ├── page.tsx                    ← NEW: subject card grid (dark theme)
│   └── [subject]/
│       └── page.tsx                ← NEW: subject detail (yellow theme)

components/
├── dashboard/
│   ├── SubjectCard.tsx             ← NEW: Railway-style dark card
│   ├── AddSubjectCard.tsx          ← NEW: dashed + card
│   ├── SubjectGrid.tsx             ← NEW: grid wrapper with stagger
│   └── detail/
│       ├── TodayPanel.tsx          ← NEW: left column (today + XP + badges)
│       ├── RoadmapPanel.tsx        ← NEW: roadmap node grid
│       ├── RoadmapNode.tsx         ← NEW: individual node card
│       └── NextSessionCard.tsx     ← NEW: orange "Start now" CTA

lib/
└── subjectColors.ts                ← NEW: subject name → accent color map
```

---

## Color Constants File

```typescript
// lib/subjectColors.ts
export const SUBJECT_COLORS: Record<string, string> = {
  math:        '#8B5CF6',
  mathematics: '#8B5CF6',
  physics:     '#3B82F6',
  cs:          '#22C55E',
  'computer science': '#22C55E',
  history:     '#F59E0B',
  geography:   '#06B6D4',
  biology:     '#10B981',
  chemistry:   '#F43F5E',
  economics:   '#F97316',
  english:     '#EC4899',
  literature:  '#EC4899',
  default:     '#F59E0B',
};

export const SUBJECT_ICONS: Record<string, string> = {
  math:        '∑',
  mathematics: '∑',
  physics:     '⚛',
  cs:          '</>',
  'computer science': '</>',
  history:     '📜',
  geography:   '🌍',
  biology:     '🧬',
  chemistry:   '⚗',
  economics:   '📈',
  english:     '✍',
  literature:  '📚',
  default:     '📖',
};
```

---

*Updated: 2026-03-27 | Matches Screenshot 1 (subject detail) + Screenshot 2 (card grid)*
