---
name: apple-design
description: Apple HIG principles, spring physics, fluid interruptible UI motion rules, and strict Apple Light Mode standards for iOS.
---

# Apple Design & Motion (iOS Track)

## 1. Strict Apple HIG Light Mode Rule (Zero Dark Mode)
Whenever designing or developing for **iOS**, the swarm must **STRICTLY ENFORCE Apple HIG Light Mode**. Dark mode is explicitly prohibited across mockups, prototypes, and code:

| Semantic Token | Hex Value | Purpose |
|---|---|---|
| **System Canvas** | `#f5f5f7` | Page background / secondary system background |
| **Card / Grouped Surface** | `#ffffff` | Primary elevated card, list item, sheet background |
| **Borders / Separators** | `#e5e5ea` | Subtle 1px / 0.5px hairline divider |
| **Primary Text** | `#1c1c1e` | High-contrast body, headlines, numbers |
| **Secondary Text** | `#8e8e93` | Captions, footnotes, metadata, inactive labels |
| **System Blue (Accent)** | `#007aff` | Interactive buttons, active tabs, primary CTAs |
| **System Green (Success)** | `#34c759` | Badges, confirmations, completed status |
| **System Orange (Notice)** | `#ff9500` | Warnings, step badges |
| **System Red (Destructive)**| `#ff3b30` | Delete, destructive actions |

### Technical Enforcement:
- In `app.json`: Set `"userInterfaceStyle": "light"`.
- In `Info.plist`: Set `<key>UIUserInterfaceStyle</key><string>Light</string>`.
- In React Native: Set `<StatusBar barStyle="dark-content" />`.
- In HTML Mockups: Set `body { background: #f5f5f7; color: #1c1c1e; }`.
- **Forbidden**: `#000000`, `#121212`, `#1c1c1e` or dark charcoal container backgrounds, and dark CAD viewports.

---

## 2. Minimalist Design Principles (Content Over Chrome)
Every iOS screen, mockup, and component must embody clean, uncluttered Apple minimalism:

1. **Content Over Chrome (Edge-to-Edge Full-Bleed)**: Chrome must recede. Viewports, cards, and primary content areas should maximize usable screen space (`flex: 1`, edge-to-edge). Never box primary content in heavy nested frames, double borders, or wasted margin gutters.
2. **Ruthless De-Cluttering ("Less, but better")**: Eliminate decorative badges, duplicate metric pills, redundant labels, and visual clutter. Every element on screen must serve an active, immediate user purpose.
3. **Typographic Hierarchy & Whitespace**: Define structure through Apple's SF Pro typographic scale (Large Title, Title 2, Headline, Subhead, Footnote) and clean whitespace, rather than heavy card borders or dark drop shadows. Use Apple Inset Grouped lists with subtle 0.5pt hairline dividers (`#e5e5ea`).
4. **Single-Accent Color Restraint**: Maintain a clean monochromatic grayscale foundation (`#f5f5f7` / `#ffffff` / `#1c1c1e`) punctuated by **a single intentional accent color** (Apple System Blue `#007aff`). Avoid multicolored buttons, rainbow badges, or heavy gradient fills.
5. **Focused Action Hierarchy**: Exactly one primary CTA per screen (e.g. 50pt rounded pill button with `#007aff` background and white text, positioned for easy thumb reach). Secondary actions use subtle ghost pills or native iOS segmented controls (`[ 🧊 3D | 📐 2D ]`).
6. **Native iOS Controls & Sheet Modals**: Use native Apple segmented pickers, floating translucent HUD pills (`rgba(255,255,255,0.92)` with `backdrop-filter: blur(20px)`), and bottom sheets with drag grabbers (`Grabber`). Avoid Android-style floating action buttons (FABs), bulky web sidebars, or complex desktop menus on iOS.

---

## 3. Fluid Interaction & Spring Physics
1. **Response:** highlight on pointer-down, not release; track drags 1:1.
2. **Interruptibility:** motion starts from the current live value, inherits gesture velocity, and can be grabbed or reversed mid-flight. Never lock UI during transitions. Use springs, never fixed-duration easing.
3. **Springs:** default UI `damping: 1.0` (no bounce); momentum gestures (flicks, sheets) `damping: 0.8`. Reanimated: `withSpring(val, { damping: 18, stiffness: 200 })`.
4. **Materials:** modals and sheets use `BlurView` (mobile) or `backdrop-filter: blur(20px) saturate(180%)` (web); no flat opaque dark backdrops.
5. **Spatial symmetry:** exit along the entry path (sheet from right dismisses right); rubber-band at scroll boundaries.
6. **Layout:** SF Pro type scale; spacing `4|8|12|16|24|32|48|64`; touch targets ≥44×44pt.
7. **Accessibility:** check `useReducedMotion()` in every animated component; fall back to an opacity cross-fade.
