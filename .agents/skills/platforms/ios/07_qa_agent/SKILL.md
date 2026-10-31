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
5. **Spatial Geometry & Multi-Story Assertion Suite**:
   - For applications with spatial measurements, physical mapping, or multi-level environments:
     - **Real Geometry Assertions**: Verify visual components render individual measured wall segments $(x_1, z_1) \to (x_2, z_2)$ and openings, rather than a generic bounding box.
     - **Multi-Story Elevation Assertions**: Verify that entities at distinct altitudes (e.g. Basement at $Y < -1.2\text{m}$ vs Ground Floor at $Y \approx 0$) are partitioned into separate level groups, rendered on dedicated 2D floor plans, and vertically stacked in 3D views without overlapping.
     - **Watertight Export Assertions**: Verify that exported STL strings contain valid `facet normal` vectors, complete `outer loop` vertex sets, and closed surface topology.

## Universal Device-to-Fixture Test-Driven Development (Device-Fixture TDD)
Whenever a complex state bug, data corruption, or edge-case failure occurs during hardware device testing (across all application domains: FinTech, E-Commerce, Social, Media, Productivity, Sensors):
1. **Physical Reality Extraction**: Never debug on device by guessing or modifying live code ad-hoc. Immediately copy the app's data container from the connected hardware iPhone (`xcrun devicectl device copy from --domain-type appDataContainer`).
2. **Persistent Fixture Seeding**: Seed the extracted snapshot into `sandbox/test-fixtures.sqlite` as the `before_state_json`. Define the exact, mathematically or relationally verified `target_after_state_json` with strict invariant assertions.
3. **Local Test-Driven Iteration Loop**: Author/run `sandbox/test-fixture-runner.js` to simulate the user action against the Before State and assert against the Target After State. Iterate code locally until the runner achieves 100% PASS.
4. **Hardware Verification Gate**: Once verified locally in the fixture runner, rebuild, re-sign, and deploy the updated application to the physical iPhone, verifying the screen layout with automated OCR.
5. Refer to `.agents/skills/platforms/ios/13_device_fixture_tdd/SKILL.md` for the complete enterprise protocol and domain-specific templates.
