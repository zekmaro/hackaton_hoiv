# WOW Study — Tutor-Like UX: Complete Implementation Guide
> Goal: every screen should feel like a real tutor session, not a ChatGPT prompt

---

## The Core UX Principle

Every interaction follows this rule:
> **The tutor speaks first. The student responds. The tutor adapts.**

Never show a blank input and wait. Never dump content passively.
The tutor always initiates, always remembers, always reacts.

---

## PART 1 — PRACTICE PAGE: REDESIGNED

### What's Wrong Now
"Preparing your practice session..." in an unstyled card.
Questions appear as plain text. No personality. Feels like a form.

### What It Should Feel Like
The tutor appears, greets the student by name, explains what they'll work on today, then asks the first question conversationally — like a tutor sitting across a table.

---

### Practice Page: Visual Layout

```
┌─────────────────────────────────────────────────────┐
│ ← Back to lesson   [Lecture] → [Practice]    1 / 4  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  PRACTICE                                           │
│  Memory Layout in C: Stack vs Heap                  │
│                                                     │
│  ● ○ ○ ○   Task 1 of 4                             │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🟠  Alex                           CONCEPTUAL   │ │  ← tutor message bubble
│ │                                                 │ │
│ │  "You've covered the theory — let's see if      │ │
│ │   it sticks. Here's your first question:"       │ │
│ │                                                 │ │
│ │  ┌─────────────────────────────────────────┐   │ │  ← question card inside bubble
│ │  │  A local variable declared inside        │   │ │
│ │  │  main() — where does it live in memory,  │   │ │
│ │  │  and what happens to it when main()      │   │ │
│ │  │  returns?                                 │   │ │
│ │  └─────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │  Your answer                                    │ │  ← answer area
│ │                                                 │ │
│ │  [                                          ]   │ │
│ │                                                 │ │
│ │  💡 Hint (-10 XP)          [Submit answer →]   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Practice Page CSS — Full Spec

```css
/* Page */
.practice-page {
  background: #F5F0E8;           /* warm off-white, not cold gray */
  min-height: 100vh;
  font-family: var(--font-body);
}

/* Content column */
.practice-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px 100px;
}

/* Page label */
.practice-label {
  font: 600 11px var(--font-body);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #9C8A72;
  margin-bottom: 10px;
}

/* Lesson title */
.practice-title {
  font: 800 32px var(--font-display);
  color: #3B2F20;
  line-height: 1.15;
  margin-bottom: 32px;
}

/* ─── TASK PROGRESS DOTS ─── */
.task-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 36px;
}

.task-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: background 0.3s, transform 0.2s;
}

.task-dot--active    { background: #E67E00; transform: scale(1.2); }
.task-dot--done      { background: #22C55E; }
.task-dot--upcoming  { background: #DDD5C8; }

.task-progress-label {
  font: 500 13px var(--font-body);
  color: #9C8A72;
  margin-left: 4px;
}

/* ─── TUTOR MESSAGE BUBBLE ─── */
.tutor-bubble {
  background: #FFFFFF;
  border: 1px solid #E8E0D4;
  border-radius: 4px 20px 20px 20px;    /* pointy top-left = tutor speaking */
  padding: 24px 28px;
  margin-bottom: 16px;
  animation: bubbleIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

@keyframes bubbleIn {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}

/* Tutor header inside bubble */
.tutor-bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tutor-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tutor-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: #FEF3C7;
  border: 1px solid #FDE68A;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;         /* emoji icon */
  flex-shrink: 0;
}

.tutor-name {
  font: 600 14px var(--font-display);
  color: #3B2F20;
}

.task-type-badge {
  height: 22px;
  padding: 0 10px;
  background: #F5F0E8;
  border: 1px solid #E8E0D4;
  border-radius: 100px;
  font: 600 10px var(--font-body);
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #9C8A72;
  display: flex;
  align-items: center;
}

/* Tutor message text (intro line) */
.tutor-intro-text {
  font: 400 16px var(--font-body);
  color: #5C4A35;
  line-height: 1.65;
  margin-bottom: 20px;
  font-style: italic;
}

/* ─── QUESTION CARD (inside the bubble) ─── */
.question-card {
  background: #FAF8F5;
  border: 1.5px solid #E8E0D4;
  border-radius: 12px;
  padding: 20px 24px;
}

.question-text {
  font: 600 17px var(--font-display);
  color: #3B2F20;
  line-height: 1.5;
  margin-bottom: 0;
}

/* Context block (code / scenario / formula) */
.question-context {
  margin-top: 16px;
  background: #F0EBE2;
  border: 1px solid #DDD5C8;
  border-radius: 8px;
  overflow: hidden;
}

.question-context-label {
  font: 600 10px var(--font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9C8A72;
  padding: 8px 16px;
  border-bottom: 1px solid #DDD5C8;
  background: #EBE4D8;
}

.question-context pre {
  margin: 0;
  padding: 16px 18px;
  font: 400 13px var(--font-mono, 'JetBrains Mono', monospace);
  color: #3B2F20;
  line-height: 1.65;
  overflow-x: auto;
  white-space: pre-wrap;
}

/* ─── ANSWER AREA ─── */
.answer-area {
  background: #FFFFFF;
  border: 1.5px solid #E8E0D4;
  border-radius: 16px;
  padding: 20px 24px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.answer-area:focus-within {
  border-color: #E67E00;
  box-shadow: 0 0 0 4px rgba(230, 126, 0, 0.08);
}

.answer-label {
  font: 600 11px var(--font-body);
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #9C8A72;
  margin-bottom: 10px;
  display: block;
}

.answer-textarea {
  width: 100%;
  min-height: 110px;
  max-height: 280px;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font: 400 15px var(--font-body);
  color: #3B2F20;
  line-height: 1.7;
  placeholder-color: #C4B9AB;
}

.answer-textarea::placeholder { color: #C4B9AB; }

.answer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #F0EBE2;
}

/* Hint button */
.hint-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  background: transparent;
  border: 1px solid #E8E0D4;
  border-radius: 100px;
  font: 500 13px var(--font-body);
  color: #9C8A72;
  cursor: pointer;
  transition: all 0.15s;
}

.hint-trigger:not(:disabled):hover {
  border-color: #FDE68A;
  background: #FFFBEB;
  color: #92400E;
}

/* Submit button */
.submit-answer-btn {
  height: 42px;
  padding: 0 24px;
  background: #E67E00;
  color: #FFFFFF;
  font: 700 14px var(--font-display);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.submit-answer-btn:hover:not(:disabled) {
  background: #D97706;
  transform: translateY(-1px);
}

.submit-answer-btn:disabled {
  background: #DDD5C8;
  color: #9C8A72;
  cursor: default;
  transform: none;
}

/* ─── HINT CARD ─── */
.hint-reveal {
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  border-radius: 10px;
  padding: 14px 18px;
  margin-top: 12px;
  animation: fadeIn 0.25s ease;
}

.hint-badge {
  font: 600 10px var(--font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #D97706;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.hint-reveal p {
  font: 400 14px var(--font-body);
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

/* ─── FEEDBACK BUBBLE (tutor replies) ─── */
.feedback-bubble {
  border-radius: 4px 20px 20px 20px;
  padding: 24px 28px;
  margin-bottom: 16px;
  animation: bubbleIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.feedback-bubble--correct {
  background: #F0FDF4;
  border: 1.5px solid #86EFAC;
}

.feedback-bubble--partial {
  background: #FFFBEB;
  border: 1.5px solid #FDE68A;
}

.feedback-bubble--wrong {
  background: #FFF7ED;
  border: 1.5px solid #FED7AA;
}

/* Result line */
.feedback-result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.feedback-result-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
  flex-shrink: 0;
}

.feedback-bubble--correct  .feedback-result-icon { background: #DCFCE7; color: #15803D; }
.feedback-bubble--partial  .feedback-result-icon { background: #FEF9C3; color: #B45309; }
.feedback-bubble--wrong    .feedback-result-icon { background: #FFEDD5; color: #C2410C; }

.feedback-result-label {
  font: 700 16px var(--font-display);
  color: #3B2F20;
}

.feedback-xp-pill {
  height: 24px;
  padding: 0 10px;
  background: rgba(230, 126, 0, 0.1);
  border: 1px solid rgba(230, 126, 0, 0.3);
  border-radius: 100px;
  font: 600 12px var(--font-body);
  color: #E67E00;
  display: flex;
  align-items: center;
  margin-left: auto;
}

/* Tutor feedback text */
.feedback-text {
  font: 400 15px var(--font-body);
  color: #5C4A35;
  line-height: 1.75;
  margin-bottom: 16px;
}

/* Model answer (only shown when wrong) */
.model-answer-block {
  background: rgba(59, 47, 32, 0.05);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.model-answer-label {
  font: 600 10px var(--font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9C8A72;
  margin-bottom: 8px;
}

.model-answer-text {
  font: 400 14px var(--font-body);
  color: #3B2F20;
  line-height: 1.65;
}

/* Follow-up question from tutor */
.followup-block {
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.followup-label {
  font: 600 10px var(--font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #3B82F6;
  margin-bottom: 6px;
}

.followup-text {
  font: 500 14px var(--font-body);
  color: #1E40AF;
  line-height: 1.6;
}

/* Next button */
.next-question-btn {
  height: 46px;
  padding: 0 28px;
  background: #3B2F20;
  color: #FFFFFF;
  font: 700 14px var(--font-display);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.next-question-btn:hover { background: #5C4A35; }
```

---

### Practice Page: Loading State

Replace "Preparing your practice session..." with a tutor greeting that feels warm:

```tsx
// PracticeLoading.tsx
export function PracticeLoading({ node, studentName }) {
  const messages = [
    `Setting up your ${node?.subject} session...`,
    `Reading your progress notes...`,
    `Building questions based on your weak areas...`,
    `Almost ready...`,
  ];
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMsgIndex(i => Math.min(i + 1, messages.length - 1));
    }, 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="tutor-bubble" style={{ minHeight: 120 }}>
      <div className="tutor-bubble-header">
        <div className="tutor-identity">
          <div className="tutor-avatar">🎓</div>
          <span className="tutor-name">Your tutor</span>
        </div>
      </div>
      <p className="tutor-intro-text" style={{ fontStyle: 'normal' }}>
        <span className="streaming-dot">✦</span>{' '}
        {messages[msgIndex]}
      </p>
    </div>
  );
}
```

---

### Practice Page: Opening Tutor Message

When the first question loads, show this before the question card. It makes the tutor feel present.

```tsx
// TutorOpener.tsx — shown once at start of session
function TutorOpener({ studentName, subject, weakTopics }) {
  const hasWeakTopics = weakTopics.length > 0;

  const opener = hasWeakTopics
    ? `Good to see you, ${studentName}. Last time you mentioned ${weakTopics[0]} was tricky — I've included a question on that. Let's see how it's sitting now.`
    : `Good to see you, ${studentName}. Let's put what you've learned about ${subject} to the test. I'll push you a bit — that's how it sticks.`;

  return (
    <div className="tutor-bubble" style={{ marginBottom: 24 }}>
      <div className="tutor-bubble-header">
        <div className="tutor-identity">
          <div className="tutor-avatar">🎓</div>
          <span className="tutor-name">Your tutor</span>
        </div>
      </div>
      <p className="tutor-intro-text">"{opener}"</p>
    </div>
  );
}
```

---

### Practice Task Card: Full Component

```tsx
export function PracticeTaskCard({
  question, taskIndex, totalTasks,
  answer, onAnswerChange, onSubmit,
  onHint, hint, hintLoading, loading,
  submitted, feedback, isCorrect, score,
  xpAwarded, correctAnswer, followUp,
  tutorName, onNext, isLastTask,
}) {

  // Map task type to tutor intro line
  const taskIntros = {
    conceptual:  'Let me see if the concept is clear.',
    application: 'Time to apply this to a real situation.',
    debugging:   "Something's wrong here. Can you spot it?",
    explanation: 'Explain this back to me in your own words.',
  };

  return (
    <div className="task-card-wrapper">

      {/* Tutor bubble with question inside */}
      <div className="tutor-bubble">
        <div className="tutor-bubble-header">
          <div className="tutor-identity">
            <div className="tutor-avatar">🎓</div>
            <span className="tutor-name">{tutorName ?? 'Your tutor'}</span>
          </div>
          <span className="task-type-badge">
            { {conceptual:'Concept', application:'Apply it',
               debugging:'Debug', explanation:'Explain'}[question.type] }
          </span>
        </div>

        {/* Tutor intro line */}
        <p className="tutor-intro-text">
          "{taskIntros[question.type]}"
        </p>

        {/* Question card */}
        <div className="question-card">
          <p className="question-text">{question.question}</p>

          {/* Code / scenario context */}
          {question.context && (
            <div className="question-context">
              <span className="question-context-label">Reference</span>
              <pre><code>{question.context}</code></pre>
            </div>
          )}
        </div>
      </div>

      {/* Answer area — only when not submitted */}
      {!submitted && (
        <div className="answer-area">
          <span className="answer-label">Your answer</span>

          <textarea
            className="answer-textarea"
            placeholder="Type your answer here... (⌘ + Enter to submit)"
            value={answer}
            onChange={e => onAnswerChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit();
            }}
            disabled={loading}
          />

          {/* Hint reveal */}
          {hint && (
            <div className="hint-reveal">
              <div className="hint-badge">
                <span>💡</span> Hint
              </div>
              <p>{hint}</p>
            </div>
          )}

          <div className="answer-actions">
            <button
              className="hint-trigger"
              onClick={onHint}
              disabled={!!hint || hintLoading}
            >
              💡 {hint ? 'Hint shown' : hintLoading ? '...' : 'Hint  −10 XP'}
            </button>

            <button
              className="submit-answer-btn"
              onClick={onSubmit}
              disabled={!answer.trim() || loading}
            >
              {loading ? (
                <>
                  <span className="streaming-dot">✦</span>
                  Checking...
                </>
              ) : (
                'Submit →'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Feedback bubble — tutor responds */}
      {submitted && (
        <FeedbackBubble
          isCorrect={isCorrect}
          score={score}
          feedback={feedback}
          xpAwarded={xpAwarded}
          correctAnswer={correctAnswer}
          followUp={followUp}
          tutorName={tutorName}
          onNext={onNext}
          isLastTask={isLastTask}
        />
      )}
    </div>
  );
}
```

---

### Feedback Bubble Component

```tsx
function FeedbackBubble({
  isCorrect, score, feedback, xpAwarded,
  correctAnswer, followUp, tutorName, onNext, isLastTask,
}) {
  const resultClass = score === 1 ? 'correct' : score === 0.5 ? 'partial' : 'wrong';
  const icon        = score === 1 ? '✓' : score === 0.5 ? '~' : '✗';
  const resultText  = score === 1 ? 'Correct' : score === 0.5 ? 'Partially right' : 'Not quite';

  return (
    <div className={`feedback-bubble feedback-bubble--${resultClass}`}>

      {/* Tutor header */}
      <div className="tutor-bubble-header" style={{ marginBottom: 16 }}>
        <div className="tutor-identity">
          <div className="tutor-avatar">🎓</div>
          <span className="tutor-name">{tutorName ?? 'Your tutor'}</span>
        </div>
      </div>

      {/* Result row */}
      <div className="feedback-result-row">
        <div className="feedback-result-icon">{icon}</div>
        <span className="feedback-result-label">{resultText}</span>
        {xpAwarded > 0 && (
          <span className="feedback-xp-pill">+{xpAwarded} XP</span>
        )}
      </div>

      {/* Tutor's feedback text */}
      <p className="feedback-text">{feedback}</p>

      {/* Model answer — only if wrong */}
      {correctAnswer && (
        <div className="model-answer-block">
          <div className="model-answer-label">Model answer</div>
          <p className="model-answer-text">{correctAnswer}</p>
        </div>
      )}

      {/* Follow-up question — only if correct */}
      {followUp && (
        <div className="followup-block">
          <div className="followup-label">Bonus question</div>
          <p className="followup-text">{followUp}</p>
        </div>
      )}

      {/* Next action */}
      <button className="next-question-btn" onClick={onNext}>
        {isLastTask ? 'See your results →' : 'Next question →'}
      </button>
    </div>
  );
}
```

---

### Practice Results — Session Debrief

After all 4 questions, show a debrief that feels like a tutor wrapping up the session.

```tsx
export function PracticeResults({
  correctCount, totalTasks, totalXp,
  node, studentName, weakMissed, onReturn,
}) {
  const pct    = Math.round((correctCount / totalTasks) * 100);
  const grade  = pct === 100 ? 'Perfect' : pct >= 75 ? 'Strong' : pct >= 50 ? 'Decent' : 'Needs work';

  // Tutor closing message — personal, not generic
  const closingLines = {
    'Perfect':    `Honestly impressive, ${studentName}. You owned every question. This topic is solid — let's move forward.`,
    'Strong':     `Good session, ${studentName}. You've got the core of this. ${weakMissed?.[0] ? `Watch out for ${weakMissed[0]} next time.` : 'Keep the momentum going.'}`,
    'Decent':     `You're getting there, ${studentName}. The concept is forming but the details need more work. I'd suggest reviewing the lecture before the next session.`,
    'Needs work': `This topic is still fresh, ${studentName}, and that's okay. I'd go back through the lecture — specifically the worked example section — then try again.`,
  };

  return (
    <div className="results-wrapper">

      {/* Tutor debrief bubble */}
      <div className="tutor-bubble" style={{ marginBottom: 24 }}>
        <div className="tutor-bubble-header">
          <div className="tutor-identity">
            <div className="tutor-avatar">🎓</div>
            <span className="tutor-name">Your tutor</span>
          </div>
        </div>
        <p className="tutor-intro-text" style={{ fontStyle: 'normal', fontSize: 16 }}>
          "{closingLines[grade]}"
        </p>
      </div>

      {/* Score card */}
      <div className="results-score-card">
        <div className="results-score-display">
          <span className="results-score-number">{correctCount}</span>
          <span className="results-score-total">/ {totalTasks}</span>
        </div>

        <div className="results-grade-badge" data-grade={grade.toLowerCase().replace(' ', '-')}>
          {grade}
        </div>

        <div className="results-xp-row">
          <span className="results-xp-icon">⭐</span>
          <span className="results-xp-text">+{totalXp} XP earned this session</span>
        </div>
      </div>

      {/* What to do next */}
      {pct < 75 && (
        <div className="results-suggestion">
          <div className="suggestion-label">SUGGESTED NEXT STEP</div>
          <p>Review the lecture, focusing on the worked example. Then come back and retry.</p>
        </div>
      )}

      {/* Return button */}
      <button className="return-btn" onClick={onReturn}>
        Back to roadmap →
      </button>
    </div>
  );
}
```

```css
.results-wrapper {
  max-width: 520px;
  margin: 0 auto;
}

.results-score-card {
  background: #FFFFFF;
  border: 1px solid #E8E0D4;
  border-radius: 20px;
  padding: 36px;
  text-align: center;
  margin-bottom: 20px;
}

.results-score-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 16px;
}

.results-score-number {
  font: 800 72px var(--font-display);
  color: #3B2F20;
  line-height: 1;
}

.results-score-total {
  font: 600 28px var(--font-display);
  color: #9C8A72;
}

.results-grade-badge {
  display: inline-block;
  height: 30px;
  padding: 0 16px;
  border-radius: 100px;
  font: 700 13px var(--font-display);
  line-height: 30px;
  margin-bottom: 24px;
}

.results-grade-badge[data-grade="perfect"]     { background: #DCFCE7; color: #15803D; }
.results-grade-badge[data-grade="strong"]      { background: #DBEAFE; color: #1D4ED8; }
.results-grade-badge[data-grade="decent"]      { background: #FEF9C3; color: #B45309; }
.results-grade-badge[data-grade="needs-work"]  { background: #FEE2E2; color: #B91C1C; }

.results-xp-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: 600 15px var(--font-body);
  color: #E67E00;
}

.results-suggestion {
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.suggestion-label {
  font: 600 10px var(--font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #D97706;
  margin-bottom: 6px;
}

.results-suggestion p {
  font: 400 14px var(--font-body);
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

.return-btn {
  width: 100%;
  height: 50px;
  background: #3B2F20;
  color: #FFFFFF;
  font: 700 15px var(--font-display);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.return-btn:hover { background: #5C4A35; }
```

---

## PART 2 — TUTOR-LIKE UX: GLOBAL RULES

### Rule 1 — The Tutor Always Speaks First

Every page that loads content must begin with a tutor message, not a loader.

| Page | Tutor opening line |
|---|---|
| Practice start | "Good to see you, [name]. Let's test what you've learned." |
| Lecture start | "Welcome back, [name]. Let's build this from the ground up." |
| Dashboard return | "Welcome back, [name]. [X] days to your exam. Here's where to focus." |
| After wrong answer | "Not quite — let me rephrase that for you." |
| After correct answer | "Exactly right. Let me push you a bit further." |
| Session debrief | "Good session today. Here's what I'd focus on next time." |

### Rule 2 — Memory Surfaces in Every Opening

Before any session, read `student.memory.subjects[subject].weak` and use it.

```typescript
// In practice/lecture session openers:
const lastSessionNote = memory.subjects?.[subject]?.lastSessionNote;
const weakTopics      = memory.subjects?.[subject]?.weak ?? [];

// Inject into the tutor's first message:
if (lastSessionNote) {
  // "Last time you struggled with X — I've included that today."
}
if (weakTopics.length > 0) {
  // "Based on your history, let's make sure X is solid."
}
```

After each session, write a note back to memory:

```typescript
// POST /api/lesson/complete — add this:
const sessionNote = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  messages: [{
    role: 'user',
    content: `Write 1 sentence (max 20 words) summarising what this student needs to work on next.
    Subject: ${subject}. Score: ${score}/${total}. Wrong answers on: ${wrongTopics.join(', ')}.
    Write from the tutor's perspective for internal notes. No filler.`
  }]
});

memory.subjects[subject].lastSessionNote = sessionNote.content[0].text;
await db.query('UPDATE students SET memory = $1 WHERE id = $2', [memory, studentId]);
```

### Rule 3 — Adaptive Difficulty Mid-Practice

Track consecutive wrong answers in session state:

```typescript
// In practice session state:
let consecutiveWrong = 0;

// After grading:
if (grade.score === 0) {
  consecutiveWrong++;
} else {
  consecutiveWrong = 0;
}

// If 2 consecutive wrong — add this to the feedback bubble:
if (consecutiveWrong >= 2) {
  feedbackSuffix = "Let me try a simpler angle on this.";
  // next question type = 'conceptual' (easiest) regardless of plan
}
```

### Rule 4 — Lecture Should Break the Wall at Section 2

After the second section streams, pause and show this:

```tsx
{sectionCount >= 2 && isStreaming && (
  <div className="lecture-checkpoint">
    <p>Making sense so far? If anything's unclear, ask below before we continue.</p>
  </div>
)}
```

The student can type a clarifying question in the bottom bar and the lecture resumes after the AI responds inline.

### Rule 5 — Session Debrief on Every Exit

When a student clicks "Back to roadmap", always show a 2-second debrief before navigating:

```tsx
// On return button click:
setShowDebrief(true);
setTimeout(() => router.push(`/dashboard/${subject}`), 2500);

// Debrief overlay:
<div className="debrief-overlay">
  <div className="debrief-card">
    <p className="debrief-line">"Good work today, {name}."</p>
    <p className="debrief-subline">
      {score >= 3
        ? `${subject} is looking strong. Move to the next node when ready.`
        : `Review the lecture once more before your next session.`}
    </p>
    <div className="debrief-xp">+{totalXp} XP</div>
  </div>
</div>
```

```css
.debrief-overlay {
  position: fixed;
  inset: 0;
  background: rgba(59, 47, 32, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.3s ease;
}

.debrief-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 40px 48px;
  text-align: center;
  max-width: 400px;
  animation: scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.debrief-line {
  font: 700 22px var(--font-display);
  color: #3B2F20;
  margin-bottom: 10px;
  font-style: italic;
}

.debrief-subline {
  font: 400 15px var(--font-body);
  color: #5C4A35;
  line-height: 1.6;
  margin-bottom: 24px;
}

.debrief-xp {
  font: 800 28px var(--font-display);
  color: #E67E00;
}

@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
```

### Rule 6 — Dashboard Shows Tutor Presence

The subject card on the dashboard should show the last note the tutor wrote:

```tsx
// In SubjectCard:
{subject.lastSessionNote && (
  <p className="tutor-note">
    <span className="tutor-note-icon">🎓</span>
    "{subject.lastSessionNote}"
  </p>
)}
```

```css
.tutor-note {
  font: 400 13px var(--font-body);
  color: #9C8A72;
  font-style: italic;
  line-height: 1.5;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--bg-border);
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
```

---

## PART 3 — TOP BAR: PIXEL SPEC

Matches screenshot exactly: clean, minimal, no clutter.

```
height: 52px
background: #F5F0E8             ← same warm bg as page, no white bar
border-bottom: 1px solid #E8E0D4
padding: 0 32px
position: sticky, top: 0, z-index: 10

LEFT:
  "← Back to lesson"
  font: DM Sans 400, 14px, #9C8A72
  cursor: pointer
  hover: color: #3B2F20

CENTER:
  Phase pills + connector arrows

  LECTURE pill:
    height: 28px, padding: 0 14px
    background: #FEF3C7 (inactive) or #E67E00 (active)
    border-radius: 100px
    font: DM Sans 600, 13px
    color: #92400E (inactive) or #FFFFFF (active)

  Arrow: "→" in #9C8A72, font-size: 14px, margin: 0 8px

  PRACTICE pill: same spec

RIGHT:
  Practice page: "1 / 4" — DM Sans 500, 14px, #9C8A72
  Lecture page: "Voice mode" button (dark pill, matches screenshot)
    height: 34px, padding: 0 16px
    background: #1A1500
    color: #FFFFFF
    font: DM Sans 600, 13px
    border-radius: 100px
    display: flex, align-items: center, gap: 7px
    ICON: mic SVG 15px
```

---

## Summary: The 6 Changes That Make It Feel Like a Tutor

| What | Before | After |
|---|---|---|
| Session start | Blank loader | Tutor greets student by name, references their history |
| Question display | Plain text in a card | Tutor bubble with intro line + styled question card |
| Feedback | Green/red result | Tutor speaks: explains, adapts, asks follow-up |
| Wrong answers | Show model answer | Tutor reframes, asks simpler follow-up if 2 in a row wrong |
| Session end | "See results" | Tutor wraps up with personal note, 2s debrief overlay |
| Dashboard | Generic subject cards | Tutor's last note visible on every card |

---

*Updated: 2026-03-27 | Practice = conversational tutor session | All screens speak first*
