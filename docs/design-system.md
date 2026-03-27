# Design System

Frontend-only reference. All values here must be used exactly as specified.
Never invent new colors or spacing outside this system.

---

## Colors

```typescript
// Use these Tailwind classes or CSS variables — never raw hex in components

Primary (Gold Orange):  #F59E0B  → `text-amber-400`  `bg-amber-400`
Background Light:       #F8FAFC  → `bg-slate-50`
Background Dark:        #0F172A  → `bg-slate-900`
Blue (info/links):      #3B82F6  → `text-blue-500`   `bg-blue-500`
Green (success/done):   #22C55E  → `text-green-500`  `bg-green-500`
Purple (AI features):   #8B5CF6  → `text-violet-500` `bg-violet-500`
```

---

## Typography

```
Font:       Inter (system font stack fallback)
Headings:   font-bold tracking-tight
Body:       font-normal text-slate-700 (light) / text-slate-200 (dark)
Mono:       font-mono text-sm (for code, XP counters, scores)
```

---

## Component Patterns

### Buttons
```tsx
// Primary CTA
<button className="bg-amber-400 hover:bg-amber-500 text-white font-semibold px-6 py-3 rounded-xl transition-all">

// Secondary
<button className="border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium px-6 py-3 rounded-xl transition-all">

// Danger / reset
<button className="text-red-500 hover:text-red-700 font-medium">
```

### Cards
```tsx
<div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
```

### Status Colors by Node Status
```
locked:      text-slate-400  bg-slate-100
available:   text-blue-600   bg-blue-50
in_progress: text-amber-600  bg-amber-50
completed:   text-green-600  bg-green-50
```

### Priority Colors
```
low:     green
medium:  blue
high:    amber
urgent:  red
```

### Agent Activity Badge Colors
```
orchestrator: bg-violet-100 text-violet-700
tutor:        bg-blue-100   text-blue-700
assessment:   bg-amber-100  text-amber-700
memory:       bg-green-100  text-green-700
```

---

## Pages & Routes

```
/              → Landing page
/onboarding    → Multi-step onboarding form
/dashboard     → Main dashboard (requires studentId in localStorage)
/tutor/:subject → Tutor voice/chat page
```

---

## Page Layouts

### Landing
- Full-width sections, max-w-6xl centered content
- Sticky nav: logo left, CTA button right
- Sections: Hero → Problem → How It Works → Demo → CTA

### Onboarding
- Centered card, max-w-lg
- Step 1: Name + goals
- Step 2: Add subjects (multi-select chips)
- Step 3: Add exam dates per subject
- Step 4: Study hours/day slider
- Progress bar at top
- Each step animated with Framer Motion (slide in from right)

### Dashboard
- Sidebar (subjects list + XP + streak) + main content (roadmap)
- Roadmap: horizontal scrollable nodes, connected with animated lines
- Node states animate on hover/complete
- Top bar: student name, streak counter, total XP

### Tutor Page
- Left: chat/voice transcript
- Right: agent activity sidebar
- Bottom: input bar with mic button
- Mic button: pulsing animation when listening

---

## Animations (Framer Motion)

```typescript
// Page transitions
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3 }}

// Roadmap node completion
initial={{ scale: 1 }}
animate={{ scale: [1, 1.2, 1] }}
transition={{ duration: 0.4 }}

// XP counter
// Use animated number — count up from previous to new value over 1s

// Badge earned
initial={{ scale: 0, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
transition={{ type: 'spring', stiffness: 300 }}
```

---

## Dark Mode

Toggle stored in `localStorage` key `theme`.
Apply `dark` class to `<html>` element.
All Tailwind dark variants use `dark:` prefix.

---

## State stored in localStorage

```typescript
'studentId'   → string (set after onboarding)
'theme'       → 'light' | 'dark'
'sessionId'   → string (current tutor session)
```
