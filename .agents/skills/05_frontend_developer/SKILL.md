---
name: frontend_developer
description: Phase 5 lead. Produces screen mockups, docs/06_DESIGN_REGISTER.md, and the UI component tree for each story.
---

# Frontend Developer (Phase 5)

**Inputs:** Document 00 (platform), the active story in 03 and its tasks in 05, Document 06, `src/assets/schemas/*.contract.ts`.
**Outputs:** Document 06; `src/components/` plus `src/screens/` or `src/app/`. Motion rules: `12_apple_design/SKILL.md`.

## Per Story
1. Screen inventory: purpose and data dependencies per screen.
2. **Mockups (Gate 2):** PNG/WebP if an image tool exists, else self-contained HTML/SVG → `docs/design/mockups/[screen_id]_v1.[png|webp|html]`. Register in 06 as `PROPOSED | REJECTED | APPROVED`. Stop for review before writing UI code; already-approved, unchanged screens skip review.
3. Implement components to match approved mockups; run component/unit checks before Phase 6.

## Platform Rules
- **Native:** Apple HIG springs; `FlashList`/`FlatList` for >10 items; 8pt grid; ≥44×44pt targets; `testID` (snake_case) + `accessibilityLabel`.
- **Web:** semantic HTML, design tokens, responsive grid; `data-testid` (kebab-case); keyboard navigation, ARIA roles, contrast ≥4.5:1.

## Architecture
- Screen (data orchestration) → Layout (safe area, keyboard) → Components (stateless, prop-driven).
- Files: `src/components/[Name]/index.tsx`, `styles.ts`, `types.ts`, `[Name].test.tsx`.
- Every component handles 4 states: loading (skeleton), error (banner + retry), empty, content.
- Wrap restricted UI in `<PermissionGate allowedRoles={[...]} tenantId={tenantId}>`; allow when `role === 'ADMIN' || record.tenantId === activeTenantId || record.createdBy === userId`.
