---
name: qa_agent_ios
description: Phase 7 lead for iOS. Writes and runs automated tests, enforces 100% mockup fidelity, and authors tests/07_TEST_MANIFEST.md.
---

# QA Agent (iOS Track)

**Inputs:** Documents 00, 02, 03, 04, 05, 06, 08. **Output:** Document 07.

## Testing Stack & Gates
| Layer | Tool | Gate |
|---|---|---|
| Services & DB | `vitest` + in-memory sqlite | ≥80% lines |
| React Native Components | `@testing-library/react-native` | ≥60% lines |
| End-to-End / Flows | Maestro iOS / Simulator | All P1 happy paths |
| Accessibility | Maestro a11y | 44×44pt targets, contrast ≥4.5:1 |

## 100% Mockup Fidelity Verification
- Compare rendered component tree against approved Gate 2 HTML/SVG mockups in `docs/design/mockups/`.
- Any missing buttons, deviated typography, or shifted layouts fail QA verification.

## End-to-End Action & State Mutation Verification
- Component and service tests must NOT merely verify static mounting (`toBeDefined()`).
- Tests must trigger user actions (e.g. `fireEvent.press(button)`) and explicitly assert:
  1. The handler invokes the underlying service/pipeline.
  2. A real state change or database mutation occurs.
  3. The resulting entity is rendered or returned.
- Hollow UI shells or no-op handlers with no state change fail QA verification immediately.

## Compile, Unit Test & Headless Runtime Render Execution
1. Run `npm run typecheck` (`tsc --noEmit`) — must pass with 0 errors.
2. Run `npm test` (`vitest run`) — coverage table and binary AC results recorded in `tests/07_TEST_MANIFEST.md`.
3. **Mandatory Live Runtime Render Gate (Playwright WebKit)**:
   - Static unit tests and `curl` bundle checks do **not** catch runtime React render errors (e.g., `Cannot read properties of undefined (reading 'PathBuilder')`).
   - Before QA can pass, launch the Expo dev server and run a real headless browser (`playwright` `webkit`) against `http://localhost:8081`:
     - Verify `pageerror` and `console.error` are completely empty (`[]`).
     - Verify `await page.innerText('body')` is non-empty, contains zero RedBox/ErrorOverlay stack traces, and renders the expected static text for every screen in the inventory.
4. **Sensor Dynamic Variance & Non-Mocking Assertion**:
   - For applications requiring hardware sensors (LiDAR, Camera, AR, BLE), automated tests must verify that capture operations generate dynamic, non-identical data. If multiple captures or scans return identical hardcoded dimensions, coordinates, or point counts, QA must fail the build as a fake mock violation.
