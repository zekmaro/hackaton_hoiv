# WOW Study — Lecture & Practice Mode Instructions
> Based on screenshot: top nav shows Lecture → Practice → Challenge → Complete

---

## Mental Model

```
/dashboard/[subject]
  └── click roadmap node (e.g. "Limits")
        │
        └── /lesson/[nodeId]              ← MODE SELECTION screen
              │
              ├── "Lecture" button
              │     └── /lesson/[nodeId]/lecture
              │           ├── Written mode  (default)
              │           └── Voice mode    (toggle via "Voice" button top-right)
              │
              └── "Practice" button
                    └── /lesson/[nodeId]/practice
                          └── Tasks, problems, exercises
```

Each mode is a **separate route** with its own phases:

```
LECTURE route:  Intro → Content → Quiz → Complete
PRACTICE route: Intro → Task 1 → Task 2 → Task 3 → Results → Complete
```

Both share the same top progress bar from the screenshot:
```
✓ Lecture  ——  Practice  ——  Challenge  ——  Complete
```

---

## Route Structure

```
app/
└── lesson/
    └── [nodeId]/
        ├── page.tsx               ← MODE SELECTION (new — see below)
        ├── lecture/
        │   └── page.tsx           ← written lecture + voice toggle
        └── practice/
            └── page.tsx           ← practical tasks
```

---

## Page: `/lesson/[nodeId]` — Mode Selection

This is the **first screen** after clicking a roadmap node. Student chooses how they want to learn this topic.

### Layout
```
background: #F8F7F4              ← off-white, matches screenshot bg
min-height: 100vh
display: flex, flex-direction: column
```

### Top Bar
```
height: 52px
background: #FFFFFF
border-bottom: 1px solid #EBEBEB
padding: 0 32px
display: flex, align-items: center, justify-content: space-between

LEFT — back link:
  "← {node.title} ({node.subject} {node.level})"
  e.g. "← Limits (University Calculus)"
  font: DM Sans 400, 14px, #6B7280
  cursor: pointer
  hover: color: #1A1500

CENTER — phase progress (inactive on selection screen):
  show 4 steps: Lecture · Practice · Challenge · Complete
  all gray/inactive since no mode chosen yet
  (same component as lesson pages, just none active)

RIGHT — empty on selection screen
```

### Phase Progress Component (shared across all lesson pages)
```
display: flex, align-items: center, gap: 0

For each step:
  STEP:
    display: flex, align-items: center, gap: 8px

    BADGE:
      height: 28px, padding: 0 14px
      border-radius: 100px
      font: DM Sans 600, 13px
      display: flex, align-items: center, gap: 5px

      States:
        DONE:
          background: #DCFCE7
          border: 1px solid #86EFAC
          color: #15803D
          prepend: "✓ " checkmark

        ACTIVE:
          background: #F59E0B        ← orange, matches screenshot
          color: #FFFFFF
          font: Syne 700, 13px
          no border

        UPCOMING:
          background: transparent
          color: #9CA3AF
          no border

    CONNECTOR LINE (between steps, not after last):
      width: 40px, height: 1px
      background: #D1D5DB
      margin: 0 4px
```

### Mode Selection Content
```
flex: 1
display: flex
flex-direction: column
align-items: center
justify-content: center
padding: 48px 24px
gap: 16px

NODE LABEL (above title):
  font: DM Sans 600, 11px, #9CA3AF
  letter-spacing: 0.08em, text-transform: uppercase
  margin-bottom: 8px
  text: "{node.subject} — {node.topic}"

NODE TITLE:
  font: Syne 800, 38px, #111827
  text-align: center
  max-width: 600px
  margin-bottom: 12px

NODE DESCRIPTION:
  font: DM Sans 400, 16px, #6B7280
  text-align: center
  max-width: 480px
  margin-bottom: 48px
  line-height: 1.6

MODE CARDS ROW:
  display: flex, gap: 20px
  max-width: 680px, width: 100%

  @media (max-width: 640px):
    flex-direction: column
```

### Mode Card — "Lecture"
```
flex: 1
background: #FFFFFF
border: 2px solid #E5E7EB
border-radius: 20px
padding: 32px 28px
cursor: pointer
transition: all 0.2s

hover:
  border-color: #F59E0B
  box-shadow: 0 8px 32px rgba(245, 158, 11, 0.12)
  transform: translateY(-3px)

ICON CONTAINER:
  width: 52px, height: 52px
  background: #FEF3C7
  border-radius: 14px
  display: flex, align-items: center, justify-content: center
  margin-bottom: 20px

  ICON: book-open SVG, 26px, color: #D97706

TITLE: "Lecture"
  font: Syne 700, 22px, #111827
  margin-bottom: 8px

DESCRIPTION:
  font: DM Sans 400, 14px, #6B7280
  line-height: 1.6
  margin-bottom: 24px
  text: "Read or listen to an AI-generated explanation of this topic. Best for learning concepts first."

DETAILS LIST:
  display: flex, flex-direction: column, gap: 6px

  Each item:
    display: flex, align-items: center, gap: 8px
    font: DM Sans 400, 13px, #6B7280

    BULLET: small circle, 5px, background: #D97706

  Items:
    "Written explanation"
    "Voice mode available"
    "Key concept cards"
    "Comprehension quiz"

BOTTOM — estimated time:
  margin-top: 24px
  padding-top: 16px
  border-top: 1px solid #F3F4F6
  font: DM Sans 500, 13px, #9CA3AF
  text: "~{node.estimatedMinutes} min"

→ onClick: router.push(`/lesson/${nodeId}/lecture`)
```

### Mode Card — "Practice"
```
Same structure as Lecture card, with:

ICON CONTAINER:
  background: #DCFCE7

  ICON: pencil/edit SVG, 26px, color: #16A34A

TITLE: "Practice"
  color: #111827

DESCRIPTION:
  text: "Solve real problems and exercises on this topic. Best for reinforcing what you already know."

DETAILS LIST items:
  "3 graded tasks"
  "Step-by-step hints"
  "Instant feedback"
  "XP for correct answers"

→ onClick: router.push(`/lesson/${nodeId}/practice`)

hover:
  border-color: #22C55E
  box-shadow: 0 8px 32px rgba(34, 197, 94, 0.12)
```

### Recommendation Tag (optional — show if student is new to topic)
```
Show between the node description and mode cards.

BADGE:
  background: #FEF3C7
  border: 1px solid #FDE68A
  border-radius: 8px
  padding: 10px 16px
  display: flex, align-items: center, gap: 8px
  max-width: 400px
  margin-bottom: 32px

  ICON: lightbulb 16px, color: #D97706
  TEXT: "Recommended: Start with Lecture if this is your first time with this topic."
    font: DM Sans 400, 13px, #92400E
```

---

## Page: `/lesson/[nodeId]/lecture` — Written + Voice Lecture

### Top Bar (same height: 52px structure)
```
LEFT: "← Limits (University Calculus)"

CENTER: Phase progress
  ✓ Lecture (ACTIVE/orange) — Practice — Challenge — Complete
  Note: "Lecture" is active/orange since we're in lecture mode

RIGHT: Voice toggle button
  height: 36px, padding: 0 16px
  background: #111827
  color: #FFFFFF
  border-radius: 100px
  font: DM Sans 600, 13px
  display: flex, align-items: center, gap: 7px

  DEFAULT (written mode):
    ICON: microphone SVG, 15px, color: #FFFFFF
    TEXT: "Voice"

  ACTIVE (voice mode):
    background: #F59E0B
    ICON: microphone SVG, 15px, color: #FFFFFF
    TEXT: "Voice on"
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3)

  → onClick: toggle between written and voice mode
```

### Page label + Title (matches screenshot exactly)
```
padding: 48px 0 32px
max-width: 760px, margin: 0 auto, padding-left/right: 32px

LABEL:
  font: DM Sans 600, 11px, #9CA3AF
  letter-spacing: 0.08em, text-transform: uppercase
  margin-bottom: 12px

  Written mode: "LECTURE"
  Voice mode:   "VOICE LECTURE"

TITLE:
  font: Syne 800, 38px, #111827
  line-height: 1.15
  max-width: 700px
  text: node.title + " — " + descriptive subtitle from lesson content
  e.g. "Understanding Limits Intuitively (Graphical & Numerical Approach)"
```

---

### Written Mode Content

Generated by `POST /api/lesson/lecture` (new endpoint — see backend section).

```
max-width: 760px, margin: 0 auto, padding: 0 32px

SECTIONS — rendered sequentially with scroll:

  INTRO BLOCK:
    font: DM Sans 400, 18px, #374151, line-height: 1.8
    margin-bottom: 40px

  KEY CONCEPT CARD:
    background: #FFFFFF
    border: 1px solid #E5E7EB
    border-radius: 16px
    padding: 24px 28px
    margin-bottom: 20px

    CONCEPT LABEL:
      font: DM Sans 600, 11px, #9CA3AF
      text-transform: uppercase, letter-spacing: 0.07em
      margin-bottom: 8px

    CONCEPT TITLE:
      font: Syne 700, 20px, #111827
      margin-bottom: 10px

    EXPLANATION:
      font: DM Sans 400, 15px, #374151, line-height: 1.75

    EXAMPLE (if present):
      margin-top: 16px
      background: #FFFBEB
      border-left: 3px solid #F59E0B
      border-radius: 0 8px 8px 0
      padding: 12px 16px

      LABEL: "Example"
        font: DM Sans 600, 11px, #D97706, uppercase
      TEXT: font: DM Sans 400, 14px, #374151

    FORMULA (if math):
      margin-top: 16px
      background: #F9FAFB
      border: 1px solid #E5E7EB
      border-radius: 8px
      padding: 14px 18px
      font: monospace or KaTeX-rendered
      text-align: center

  VISUAL DIAGRAM (if provided by Claude):
    background: #F9FAFB
    border: 1px solid #E5E7EB
    border-radius: 12px
    padding: 20px
    margin-bottom: 20px
    min-height: 160px
    display: flex, align-items: center, justify-content: center

    For now: render as a styled text diagram using pre/code tags
    Future: replace with Canvas/SVG rendering

COMPREHENSION CHECK (after all key concepts):
  background: #FFFFFF
  border: 1px solid #E5E7EB
  border-radius: 16px
  padding: 28px
  margin: 40px 0

  TITLE: "Quick check"
    font: Syne 700, 18px, #111827
    margin-bottom: 20px

  QUESTION (1 question only, simple):
    font: DM Sans 400, 16px, #374151
    margin-bottom: 16px

  OPTIONS: same style as quiz phase from previous spec
    but smaller, 3 options max
```

---

### Voice Mode Content

When Voice toggle is ON, replace the written content with the voice UI:

```
VOICE CONTAINER:
  max-width: 520px, margin: 60px auto, text-align: center

  AI AVATAR:
    width: 96px, height: 96px
    border-radius: 50%
    background: #111827
    display: flex, align-items: center, justify-content: center
    margin: 0 auto 32px

    ICON: microphone SVG, 40px, color: #FFFFFF

    SPEAKING state:
      box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.15),
                  0 0 0 16px rgba(245, 158, 11, 0.08)
      animation: speakPulse 1.5s ease-in-out infinite

      @keyframes speakPulse {
        0%, 100% { box-shadow: 0 0 0 8px rgba(245,158,11,0.15), 0 0 0 16px rgba(245,158,11,0.08); }
        50%       { box-shadow: 0 0 0 12px rgba(245,158,11,0.2), 0 0 0 24px rgba(245,158,11,0.06); }
      }

  STATUS TEXT:
    font: DM Sans 500, 16px, #374151
    margin-bottom: 8px
    text: "Speaking..." / "Tap to pause" / "Tap to resume"

  TRANSCRIPT (scrollable, shows spoken text):
    max-height: 240px, overflow-y: auto
    background: #FFFFFF
    border: 1px solid #E5E7EB
    border-radius: 12px
    padding: 16px 20px
    margin: 24px 0
    font: DM Sans 400, 15px, #374151, line-height: 1.7
    text-align: left

  CONTROLS ROW:
    display: flex, justify-content: center, gap: 16px
    margin-top: 24px

    PAUSE/PLAY button:
      width: 52px, height: 52px
      background: #111827
      border-radius: 50%
      ICON: pause/play SVG, 22px, white

    SPEED button:
      height: 36px, padding: 0 14px
      background: #F3F4F6
      border-radius: 100px
      font: DM Sans 600, 13px, #374151
      text: "1×" / "1.5×" / "2×"
      cycles through on click

    RESTART button:
      height: 36px, padding: 0 14px
      background: #F3F4F6
      border-radius: 100px
      font: DM Sans 600, 13px, #374151
      text: "Restart"
```

### Voice Mode — Backend

```typescript
// POST /api/lesson/voice — returns ElevenLabs audio
router.post('/api/lesson/voice', async (req, res) => {
  const { nodeId, studentId } = req.body;

  // Load lesson content (same as /api/lesson/content)
  // Compile into a readable script:
  const script = `
    Welcome to your lecture on ${node.title}.
    ${lesson.intro}
    
    Let's cover three key concepts.
    
    First: ${lesson.keyPoints[0].title}.
    ${lesson.keyPoints[0].explanation}
    For example: ${lesson.keyPoints[0].example}
    
    Second: ${lesson.keyPoints[1].title}.
    ...
    
    To summarize: ${lesson.summary}
  `;

  // Call ElevenLabs TTS
  const audio = await elevenlabs.generate({
    voice: 'Rachel',           // or configurable per subject
    text: script,
    model_id: 'eleven_multilingual_v2',
  });

  res.set('Content-Type', 'audio/mpeg');
  res.send(audio);
});
```

---

### Bottom Action Bar (Lecture page)
```
position: sticky, bottom: 0
background: rgba(248, 247, 244, 0.9)
backdrop-filter: blur(8px)
border-top: 1px solid #E5E7EB
padding: 16px 32px
display: flex, align-items: center, justify-content: space-between

LEFT — ask a question input:
  flex: 1, max-width: 580px

  INPUT:
    width: 100%
    height: 48px
    background: #FFFFFF
    border: 1px solid #E5E7EB
    border-radius: 12px
    padding: 0 16px
    font: DM Sans 400, 14px, #374151
    placeholder: "Ask a question about the lecture..."
    
    focus:
      border-color: #F59E0B
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1)
      outline: none
    
    → onEnter: send to POST /api/tutor/message with context
               show AI answer inline above the input as a pop-up card

RIGHT — "Practice problems →" button:
  height: 48px, padding: 0 24px
  background: #F59E0B
  color: #FFFFFF
  font: Syne 700, 14px
  border-radius: 12px
  border: none, cursor: pointer
  
  hover: background: #D97706

  → onClick: router.push(`/lesson/${nodeId}/practice`)
```

---

## Page: `/lesson/[nodeId]/practice` — Practice Tasks

### Top Bar
```
Same structure.

CENTER: Phase progress
  ✓ Lecture (DONE/green) — Practice (ACTIVE/orange) — Challenge — Complete

Lecture badge:
  background: #DCFCE7, border: 1px solid #86EFAC, color: #15803D
  prepend "✓ "

Practice badge:
  background: #F59E0B, color: #FFFFFF
```

### Page Label + Title
```
Padding: 48px 32px 32px
max-width: 760px, margin: 0 auto

LABEL: "PRACTICE"
  font: DM Sans 600, 11px, #9CA3AF
  letter-spacing: 0.08em, text-transform: uppercase
  margin-bottom: 12px

TITLE: node.title + practice descriptor
  e.g. "Understanding Limits Intuitively (Graphical & Numerical Approach)"
  font: Syne 800, 38px, #111827
  line-height: 1.15
  max-width: 700px
```

### Task Progress Row
```
max-width: 760px, margin: 0 auto, padding: 0 32px
margin-bottom: 32px

display: flex, align-items: center, gap: 12px

TASK DOTS:
  3 dots, each:
    width: 10px, height: 10px, border-radius: 50%
    
    completed:  background: #22C55E
    active:     background: #F59E0B
    upcoming:   background: #E5E7EB

TASK LABEL:
  font: DM Sans 500, 14px, #6B7280
  text: "Task {current} of 3"
```

### Task Card
```
max-width: 760px, margin: 0 auto, padding: 0 32px

CARD:
  background: #FFFFFF
  border: 1px solid #E5E7EB
  border-radius: 20px
  padding: 32px 36px
  margin-bottom: 20px

  TASK TYPE LABEL:
    font: DM Sans 600, 11px, #9CA3AF
    text-transform: uppercase, letter-spacing: 0.07em
    margin-bottom: 12px
    
    types: "MULTIPLE CHOICE" | "OPEN ANSWER" | "STEP BY STEP" | "TRUE / FALSE"

  TASK QUESTION:
    font: Syne 700, 22px, #111827
    line-height: 1.4
    margin-bottom: 24px

  TASK CONTEXT (optional — diagram, formula, scenario):
    background: #F9FAFB
    border: 1px solid #E5E7EB
    border-radius: 10px
    padding: 16px 20px
    margin-bottom: 24px
    font: DM Sans 400, 15px, #374151

  --- Task type rendering ---

  MULTIPLE CHOICE:
    Same option button spec as quiz (see previous doc)
    But white background, not yellow

  OPEN ANSWER:
    TEXTAREA:
      width: 100%
      min-height: 120px
      background: #F9FAFB
      border: 1px solid #E5E7EB
      border-radius: 10px
      padding: 14px 16px
      font: DM Sans 400, 15px, #374151
      resize: vertical
      
      focus: border-color: #F59E0B, box-shadow: 0 0 0 3px rgba(245,158,11,0.1)
    
    After submitting: Claude grades the answer and shows feedback

  STEP BY STEP:
    Numbered input fields:
      display: flex, flex-direction: column, gap: 10px
      
      Each step row:
        display: flex, align-items: center, gap: 12px
        
        STEP NUMBER: 
          width: 28px, height: 28px
          background: #F3F4F6
          border-radius: 50%
          font: Syne 700, 13px, #6B7280
          flex-shrink: 0
        
        INPUT:
          flex: 1, height: 44px
          same input style as open answer

  TRUE / FALSE:
    Two large buttons side by side:
    
    each: flex: 1, height: 56px
    border: 2px solid #E5E7EB
    border-radius: 12px
    font: Syne 700, 16px
    cursor: pointer, transition: 0.15s
    
    TRUE button:
      color: #15803D
      selected: background: #DCFCE7, border-color: #22C55E
    
    FALSE button:
      color: #DC2626
      selected: background: #FEE2E2, border-color: #EF4444
```

### Hint System
```
Below the task card:

HINT BUTTON (before hint used):
  height: 36px, padding: 0 16px
  background: transparent
  border: 1px solid #E5E7EB
  border-radius: 100px
  font: DM Sans 500, 13px, #6B7280
  display: flex, align-items: center, gap: 6px
  cursor: pointer
  
  ICON: lightbulb 15px, color: #D97706
  TEXT: "Show hint"
  
  hover: border-color: #FDE68A, background: #FFFBEB, color: #92400E
  
  Note: costs -10 XP, show warning tooltip on hover:
    "Hint costs 10 XP"

HINT CARD (after clicking):
  background: #FFFBEB
  border: 1px solid #FDE68A
  border-radius: 12px
  padding: 16px 20px
  margin-top: 12px
  animation: fadeIn 0.25s ease

  LABEL: "HINT"
    font: DM Sans 600, 11px, #D97706
    margin-bottom: 6px

  TEXT: hint from lesson content
    font: DM Sans 400, 14px, #374151
```

### Feedback Card (after answer submitted)
```
Appears below the task card.
animation: slideUp 0.3s ease

CORRECT:
  background: #DCFCE7
  border: 1px solid #86EFAC
  border-radius: 12px
  padding: 16px 20px
  
  display: flex, align-items: flex-start, gap: 12px
  
  ICON: check-circle 22px, color: #22C55E
  
  RIGHT:
    LABEL: "Correct! +{xp} XP"
      font: Syne 700, 15px, #15803D
    EXPLANATION: font: DM Sans 400, 14px, #166534

WRONG:
  background: #FEE2E2
  border: 1px solid #FECACA
  Same structure, color: red family
  
  LABEL: "Not quite"
  Show correct answer + explanation

OPEN ANSWER FEEDBACK:
  Same card structure
  LABEL: "AI Feedback"
    font: Syne 700, 15px, #374151
  EXPLANATION: Claude's graded response
    font: DM Sans 400, 14px, #374151
```

### Bottom Action Bar (Practice page)
```
Same sticky bar spec.

LEFT: empty OR score tracker:
  "2 / 3 correct so far" — DM Sans 500, 14px, #6B7280

RIGHT: 
  If not last task → "Next task →" button (gray/secondary)
  If last task → "See results →" button (orange CTA)
```

### Practice Results Screen
```
Shown after all 3 tasks completed (replaces task card area)

SCORE CARD:
  background: #FFFFFF
  border: 1px solid #E5E7EB
  border-radius: 20px
  padding: 40px 36px
  max-width: 520px, margin: 0 auto
  text-align: center

  SCORE DISPLAY:
    font: Syne 800, 64px, #111827
    text: "{score} / 3"
    margin-bottom: 8px

  SCORE LABEL:
    font: DM Sans 400, 17px, #6B7280
    margin-bottom: 28px

  XP ROW:
    display: inline-flex, align-items: center, gap: 8px
    background: #FFFBEB
    border: 1px solid #FDE68A
    border-radius: 100px
    padding: 8px 20px
    margin-bottom: 36px

    TEXT: "+{xpEarned} XP earned"
      font: Syne 700, 16px, #D97706

  DIVIDER: 1px solid #F3F4F6, margin-bottom: 28px

  CONTINUE BUTTON:
    width: 100%
    height: 52px
    background: #F59E0B
    color: #FFFFFF
    font: Syne 700, 15px
    border-radius: 12px
    text: "Complete lesson →"
    → onClick: POST /api/lesson/complete, then router.push('/dashboard/[subject]')
```

---

## Backend: New Endpoints

### `POST /api/lesson/lecture` — generate full written lecture

```typescript
router.post('/api/lesson/lecture', async (req, res) => {
  const { nodeId, studentId } = req.body;

  const student = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
  const memory = student.rows[0].memory;
  const node = memory.studyPath.find((n: RoadmapNode) => n.id === nodeId);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `Write a structured lecture for a student.

Subject: ${node.subject}
Topic: ${node.topic}
Lesson: ${node.title}
Level: ${memory.subjects?.[node.subject]?.level ?? 'general'}
Learning style: ${memory.learningStyle ?? 'examples'}
Student struggles with: ${(memory.subjects?.[node.subject]?.weak ?? []).join(', ') || 'nothing specific'}

Return ONLY valid JSON:
{
  "lectureTitle": "Full descriptive title for this lecture",
  "intro": "2-3 engaging opening sentences",
  "sections": [
    {
      "title": "Section title",
      "explanation": "Full paragraph explanation (3-5 sentences)",
      "example": "Concrete real-world example",
      "formula": "Optional: formula or rule as plain text",
      "visualDescription": "Optional: describe a diagram in plain text for rendering"
    }
  ],
  "comprehensionQuestion": {
    "question": "One question to check understanding",
    "options": ["A", "B", "C"],
    "correctIndex": 0,
    "explanation": "Why this is correct"
  },
  "voiceScript": "Full natural-language script for text-to-speech, same content written conversationally without special characters"
}

Rules:
- sections: exactly 3
- All content MUST be about "${node.subject} — ${node.topic}" specifically
- voiceScript must be readable aloud naturally, no formulas or symbols`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const lecture = JSON.parse(text.replace(/```json|```/g, '').trim());

  res.json({ lecture, node });
});
```

### `POST /api/lesson/practice` — generate practice tasks

```typescript
router.post('/api/lesson/practice', async (req, res) => {
  const { nodeId, studentId } = req.body;

  const student = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
  const memory = student.rows[0].memory;
  const node = memory.studyPath.find((n: RoadmapNode) => n.id === nodeId);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    messages: [{
      role: 'user',
      content: `Generate 3 practice tasks for a student.

Subject: ${node.subject}
Topic: ${node.topic}
Lesson: ${node.title}
Level: ${memory.subjects?.[node.subject]?.level ?? 'general'}
Student struggles with: ${(memory.subjects?.[node.subject]?.weak ?? []).join(', ') || 'nothing specific'}

Return ONLY valid JSON:
{
  "tasks": [
    {
      "type": "multiple_choice" | "open_answer" | "step_by_step" | "true_false",
      "question": "The task question",
      "context": "Optional: background info, scenario, or formula to reference",
      "options": ["A", "B", "C", "D"],        // only for multiple_choice
      "correctIndex": 0,                        // only for multiple_choice
      "correctAnswer": "string",                // for open_answer and step_by_step
      "steps": ["Step 1", "Step 2", "Step 3"], // only for step_by_step
      "isTrue": true,                           // only for true_false
      "hint": "One-sentence hint",
      "explanation": "Full explanation of correct answer",
      "xpReward": 25
    }
  ]
}

Rules:
- exactly 3 tasks
- vary the types: do NOT use the same type 3 times
- tasks MUST be about "${node.subject} — ${node.topic}" only
- difficulty: task 1 = easy, task 2 = medium, task 3 = hard
- hints must not give away the answer directly`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const practice = JSON.parse(text.replace(/```json|```/g, '').trim());

  res.json({ practice, node });
});
```

### `POST /api/lesson/grade` — grade open answer with Claude

```typescript
router.post('/api/lesson/grade', async (req, res) => {
  const { nodeId, studentId, taskIndex, studentAnswer } = req.body;

  // Load the practice tasks from a previous /api/lesson/practice call
  // (cache these in session or re-generate with same seed)
  // For simplicity: pass the task along in the request body:
  const { task } = req.body;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',   // fast, cheap for grading
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Grade this student answer.

Question: ${task.question}
Correct answer: ${task.correctAnswer}
Student's answer: ${studentAnswer}

Return ONLY valid JSON:
{
  "isCorrect": boolean,
  "score": 0 | 0.5 | 1,
  "feedback": "2-3 sentence constructive feedback",
  "xpAwarded": number (0, 12, or 25 based on score)
}`
    }]
  });

  const result = JSON.parse(
    response.content[0].type === 'text'
      ? response.content[0].text.replace(/```json|```/g, '').trim()
      : '{}'
  );

  res.json(result);
});
```

---

## Updated Route Map

```
/lesson/[nodeId]                    ← MODE SELECTION (new)
/lesson/[nodeId]/lecture            ← written + voice lecture (new)
/lesson/[nodeId]/practice           ← practice tasks (new)
/dashboard/[subject]                ← back here after Complete
```

## Updated File Structure

```
app/
└── lesson/
    └── [nodeId]/
        ├── page.tsx                     ← mode selection screen
        ├── lecture/
        │   └── page.tsx                 ← lecture + voice
        └── practice/
            └── page.tsx                 ← tasks + grading

components/
└── lesson/
    ├── ModeSelectionCard.tsx            ← lecture/practice choice
    ├── PhaseProgressBar.tsx             ← top nav: Lecture→Practice→Complete
    ├── lecture/
    │   ├── WrittenLecture.tsx
    │   ├── VoicePlayer.tsx
    │   └── ComprehensionCheck.tsx
    ├── practice/
    │   ├── TaskCard.tsx
    │   ├── TaskMultipleChoice.tsx
    │   ├── TaskOpenAnswer.tsx
    │   ├── TaskStepByStep.tsx
    │   ├── TaskTrueFalse.tsx
    │   ├── HintCard.tsx
    │   ├── FeedbackCard.tsx
    │   └── PracticeResults.tsx
    └── shared/
        ├── BottomActionBar.tsx
        └── LessonTopBar.tsx
```

---

## Phase Progress State Logic

```typescript
// Each lesson page computes phase state from the URL
// and passes it to PhaseProgressBar

type PhaseStatus = 'done' | 'active' | 'upcoming';

interface PhaseState {
  lecture:   PhaseStatus;
  practice:  PhaseStatus;
  challenge: PhaseStatus;
  complete:  PhaseStatus;
}

function getPhaseState(pathname: string): PhaseState {
  if (pathname.endsWith('/lecture')) return {
    lecture: 'active', practice: 'upcoming', challenge: 'upcoming', complete: 'upcoming'
  };
  if (pathname.endsWith('/practice')) return {
    lecture: 'done', practice: 'active', challenge: 'upcoming', complete: 'upcoming'
  };
  // After completing practice → navigate to /dashboard/[subject]
  // Challenge phase = future feature
  return {
    lecture: 'upcoming', practice: 'upcoming', challenge: 'upcoming', complete: 'upcoming'
  };
}
```

---

## Key Rules

1. **Mode selection is always first** — `/lesson/[nodeId]` never skips to lecture or practice directly. Student always sees the choice screen.

2. **Lecture and Practice are independent** — student can do Practice without Lecture and vice versa. No forced order (except the phase bar reflects what they've done).

3. **Voice is a toggle within Lecture** — it's not a separate route. The `voiceScript` field in the lecture response is used for TTS. Same page, same content, different presentation.

4. **All tasks and lecture content are generated per node** — `/api/lesson/lecture` and `/api/lesson/practice` both use `node.subject + node.topic + node.title` so History gets historical tasks and Physics gets physics problems.

5. **Hint costs XP** — deduct 10 XP from the student's total when a hint is used. Call `POST /api/lesson/hint` or handle inline in `/api/lesson/complete`.

6. **Bottom bar question input** — connects to `POST /api/tutor/message` with the node's subject context injected, so the AI answer is topic-aware.

---

*Updated: 2026-03-27 | Based on screenshot showing Lecture → Practice → Challenge → Complete top nav*
