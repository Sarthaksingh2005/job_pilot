# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

### Login Page — OAuth card

File: app/(auth)/login/page.tsx
Last updated: 2026-07-03

| Property | Class |
| ---------------- | --------------- |
| Background | `bg-surface` |
| Border | `border border-border` |
| Border radius | `rounded-[32px]` |
| Text — primary | `text-text-dark` |
| Text — secondary | `text-text-secondary` |
| Spacing | `p-10`, `mt-10`, `space-y-4`, `px-5`, `py-4` |
| Hover state | `hover:border-text-primary`, `hover:bg-surface` |
| Shadow | `shadow-sm` |
| Accent usage | `bg-accent`, `text-accent` |

**Pattern notes:**
- The login card uses a strong white/surface panel with a thin border and soft shadow.
- Buttons are full-width, softly rounded, and show a hover state that emphasizes the border and background without introducing new color tokens.
- Secondary text uses `text-text-secondary` and small font sizes for descriptions, while headings use `text-text-dark` and bold weights.
- Validation and help callouts are cards with the same `rounded-[20px]` radius and token-based border/background colors.
