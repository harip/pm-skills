---
name: apple-design
description: Apple HIG principles, spring physics, and fluid interruptible UI motion rules translated for web and mobile.
---

# Apple Design & Motion

1. **Response:** highlight on pointer-down, not release; track drags 1:1.
2. **Interruptibility:** motion starts from the current live value, inherits gesture velocity, and can be grabbed or reversed mid-flight. Never lock UI during transitions. Use springs, never fixed-duration easing.
3. **Springs:** default UI `damping: 1.0` (no bounce); momentum gestures (flicks, sheets) `damping: 0.8`. Reanimated: `withSpring(val, { damping: 18, stiffness: 200 })`.
4. **Materials:** modals and sheets use `BlurView` (mobile) or `backdrop-filter: blur(20px) saturate(180%)` (web); no flat opaque backdrops.
5. **Spatial symmetry:** exit along the entry path (sheet from right dismisses right); rubber-band at scroll boundaries.
6. **Layout:** SF Pro type scale; spacing `4|8|12|16|24|32|48|64`; touch targets ≥44×44pt.
7. **Accessibility:** check `useReducedMotion()` in every animated component; fall back to an opacity cross-fade.
