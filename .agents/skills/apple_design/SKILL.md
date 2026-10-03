---
name: apple-design
description: Apple's HIG principles, spring physics, and fluid interruptible UI motion rules translated for web and mobile.
---

# Apple Design System & Motion Skill

See `.agents/rules/GLOBAL_RULES.md` for shared protocols and document numbering.

## Initial Response
When invoked without a specific question:
> *I'm ready to help you build fluid, Apple-style interfaces on the web/mobile based on Apple's WWDC design standards.*

## Core Design Principles
1. **Response (Kill Latency):** Highlight on `pointer-down` (press), not release. 1:1 direct tracking during drag.
2. **Interruptibility:** Motion MUST start from current live value (not target), inherit gesture velocity, and be grabable/reversable mid-flight. Never lock UI during transitions. Use spring physics, never fixed-duration easing (`ease-in-out`).
3. **Spring Parameters & Defaults:**
   - Default UI: `damping: 1.0` (critically damped, zero bounce).
   - Momentum gestures (flicks, sheets): `damping: 0.8` (controlled bounce).
   - Reanimated mapping: `withSpring(val, { damping: 18, stiffness: 200 })`.
4. **Materials & Depth:** Modals/sheets use `BlurView` (mobile) / `backdrop-filter: blur(20px) saturate(180%)` (web). Never flat opaque backgrounds.
5. **Spatial Symmetry & Boundaries:** Enter/exit paths match (sheet from right dismisses right). Apply rubber-banding resistance at scroll boundaries.
6. **Typography & Layout:** SF Pro scale; Spacing grid in multiples of 8pt (`4|8|12|16|24|32|48|64`); Touch targets ≥44×44pt.
7. **Accessibility:** Enforce `useReducedMotion()` check in every animated component → fallback to opacity cross-fade.
