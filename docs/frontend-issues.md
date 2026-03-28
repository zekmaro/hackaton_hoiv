# Frontend Issues & What Needs Fixing

Last updated: 2026-03-28

---

## 🔴 Critical — Breaks the core loop

### 1. Tutor page sends wrong subject name to API

**File:** `frontend/src/pages/Tutor.tsx` line 54

**Problem:**
```typescript
const payload: TutorMessageRequest = {
  subject,  // ← this is the URL param e.g. "calculus 1" (lowercase)
  ...
}
```
The backend stores subjects with original casing e.g. `"Calculus 1"` or `"Analysis 1"`.
Sending `"calculus 1"` means the tutor can't find the student's memory for that subject.
XP won't update, memory won't be read, gaps won't be tracked.

**Fix:**
Derive the real subject name from `localStorage('studyPath')` before sending:
```typescript
const studyPath = JSON.parse(localStorage.getItem('studyPath') ?? '[]') as RoadmapNode[]
const realSubjectName = studyPath.find(
  (n) => n.subject.toLowerCase() === subject?.toLowerCase()
)?.subject ?? subject
```
Then use `realSubjectName` instead of `subject` in the payload.

---

### 2. New subjects added via "Add new subject" don't show on dashboard

**File:** `frontend/src/pages/Onboarding.tsx` lines 133-137

**Problem:**
```typescript
const existing = JSON.parse(localStorage.getItem("studyPath") ?? "[]")
localStorage.setItem("studyPath", JSON.stringify([...existing, ...data.studyPath]))
```
This merges into localStorage correctly, but `Dashboard.tsx` re-fetches from
`GET /api/study-path/:studentId` on load and overwrites localStorage with only
the old data (because the backend fix was just deployed — needs Vercel redeploy).

Also the dashboard doesn't re-fetch after navigating back from onboarding.

**Fix:**
After the backend redeploys (it now correctly merges new subjects into the DB),
make sure `Dashboard.tsx` always fetches fresh from the API rather than trusting
the cache. Remove or don't pre-populate from `localStorage('studyPath')` on Dashboard.

---

## 🟡 Important — Broken UX but not blocking

### 3. Subject URL has spaces — bad URL and potential routing issues

**File:** `frontend/src/pages/Dashboard.tsx` line 159

**Problem:**
```typescript
navigate(`/dashboard/${subject.name.toLowerCase()}`)
// produces: /dashboard/calculus 1  ← spaces in URL
```
Same issue when navigating to tutor: `/tutor/calculus 1`

**Fix:**
```typescript
navigate(`/dashboard/${encodeURIComponent(subject.name.toLowerCase())}`)
```
And in SubjectDetail/Tutor, decode it:
```typescript
const subjectKey = decodeURIComponent(subject ?? "").toLowerCase()
```

---

### 4. Tutor page has no back button

**File:** `frontend/src/pages/Tutor.tsx`

**Problem:** No way to go back to the subject detail or dashboard. User is stuck.

**Fix:** Add a back button at the top:
```tsx
<button onClick={() => navigate(-1)}>← Back</button>
```

---

### 5. SubjectDetail subject matching is fragile

**File:** `frontend/src/pages/SubjectDetail.tsx` line 94

**Problem:**
```typescript
roadmap.filter((node) => node.subject.toLowerCase() === subjectKey)
```
This only works if the URL param exactly matches the node subject lowercased.
If subject is `"Analysis 1"`, URL is `analysis 1`, `subjectKey` is `analysis 1`,
and `node.subject.toLowerCase()` is `analysis 1` — this actually works.

BUT if subject name has special chars or the URL gets encoded differently it breaks.

**Better fix:**
```typescript
roadmap.filter((node) =>
  node.subject.toLowerCase().replace(/\s+/g, '-') === subjectKey.replace(/\s+/g, '-')
)
```

---

### 6. XP gained from tutor sessions not shown anywhere

**File:** `frontend/src/pages/Tutor.tsx`

**Problem:** The API returns `xpGained` on every message but the tutor page doesn't
display it or accumulate it anywhere. Student has no feedback that they earned XP.

**Fix:** Add a small XP counter in the chat header that increments:
```typescript
const [totalXp, setTotalXp] = useState(0)
// in sendMessage after response:
setTotalXp(prev => prev + data.xpGained)
```
Display as `+{data.xpGained} XP` toast or badge after each message.

---

## 🟢 Nice to have — Polish

### 7. Tutor page doesn't auto-send opening message when coming from a node

**File:** `frontend/src/pages/Tutor.tsx`

When navigating from a roadmap node, the URL has `?topic=X`. There's a "Start with X"
button that triggers a message, but it requires a manual click.

Auto-send the opening message on mount when `topic` is present:
```typescript
useEffect(() => {
  if (topic && messages.length === 0) {
    void sendMessage(`Help me understand: ${topic}`)
  }
}, []) // run once on mount
```

---

### 8. Mic button missing from Tutor page

**File:** `frontend/src/pages/Tutor.tsx`

The Web Speech API mic button was planned but not implemented.
See `docs/current-state.md` for the implementation snippet — it's browser-native, no backend needed.

---

## Priority Order

1. Fix subject name in tutor API call (#1) — breaks memory and XP tracking
2. Fix URL encoding (#3) — cleaner and prevents edge cases
3. Add back button (#4) — basic UX
4. Auto-send opening message (#7) — makes the demo flow smoother
5. XP display (#6) — good for demo wow factor
6. Mic button (#8) — voice is a key differentiator
