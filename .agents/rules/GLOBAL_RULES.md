# Global SDLC Swarm Rules & Protocols

## 1. Core Operating Principles & Capability Model
- **1-Person Company Model:** Solo founder + AI swarm. Features built as vertical slices (UI through DB per story).
- **Capability-Driven Execution:** Phase 1 defines `docs/00_PROJECT_CONTRACT.md`. Agents skip infrastructure marked `none` and flag checks `N/A — CAPABILITY NOT REQUIRED`.
- **Zero-Trust Audit:** Architecture Reviewer audits every deliverable against `00_PROJECT_CONTRACT.md`.

## 2. Document Prefix Protocol & Canonical Paths
- **Tone:** Very terse, concise, and clear. Zero conversational filler.
- **Canonical Document Paths:**
  - `docs/00_PROJECT_CONTRACT.md` — Phase 1: Capability & Target Contract
  - `docs/01_ARCH_BRIEF.md` — Phase 1: Architecture Brief
  - `docs/02_PRD.md` — Phase 2: Product Requirements Document
  - `docs/03_USER_STORIES.md` — Phase 2: Full-Stack User Stories
  - `docs/04_TECHNICAL_SPEC.md` — Phase 3: Technical Specification
  - `docs/05_TASK_MANIFEST.md` — Phase 3: Executable Task Manifest
  - `docs/06_DESIGN_REGISTER.md` — Phase 5: UI Mockup Register
  - `tests/07_TEST_MANIFEST.md` — Phase 7: Automated Test Manifest *(Canonical path)*
  - `docs/08_SETUP_REGISTER.md` — Database/Prerequisite Progress Register
  - `docs/09_RELEASE_PLAN.md` — Release Approval & Verified Plan
  - `docs/10_UAT_CHECKLIST.md` — User Acceptance Testing & StackBlitz Review Checklist
  - `progress.html` — Live Visual Project Progress Dashboard (Project Root)
  - `docs/reviews/0[N]_ARCH_REVIEW_PHASE_[N].md` — Phase Audit Reports

## 3. Revision Invalidation & Traceability Protocol
- **Artifact Sign-off:** Approvals record artifact path, revision hash, approver, scope, and evidence.
- **Cascading Invalidation:** Modifying an upstream artifact (story, contract, platform, capability, permission policy, schema, tech spec) invalidates affected downstream artifacts and reopens approvals from the earliest affected phase.

## 4. Status Vocabulary & Terminal States
- **Status Enums:** `[NOT STARTED]`, `[IN PROGRESS]`, `[AWAITING PEER REVIEW]`, `[AWAITING MANAGER APPROVAL]`, `[AWAITING UAT SIGN-OFF]`, `[COMPLETED & LOCKED]`, `[SKIPPED — MOCKS ONLY]`, `[SKIPPED — USER MANAGED]`, `[N/A — CAPABILITY NOT REQUIRED]`, `[UNVERIFIED — DEPENDENCY DEFERRED]`.
- **Terminal Pointer:** Upon successful deployment or explicit user handoff:
  `NEXT_STEP_POINTER: COMPLETE — USER MANAGED HANDOFF`

## 5. Token & Context Efficiency Protocol
- **Write-to-File, Link-in-Chat:** Save code/schemas/specs directly to disk. In chat, return file links + 3-bullet summary.
- **Lazy Loading:** Load ONLY the specific artifact required for the active step.
- **Bounded State Window:** `docs/PROJECT_STATUS.md` maintains a rolling 3-session log cap (≤ 65 lines).

## 6. Autonomy Modes
- **`BALANCED`** (Default): Stop for sign-off at Gate 1 (`02_PRD.md` & `03_USER_STORIES.md`), Gate 2 (`06_DESIGN_REGISTER.md`), Gate 3 (UAT StackBlitz Review), and Gate 4 (`09_RELEASE_PLAN.md`).
- **`AUTOPILOT`**: Auto-advance through Phases 1–6. Stop for mockup sign-off, DB setup/skip, StackBlitz UAT evaluation, and release approval.
- **`SUPERVISED`**: Stop for user sign-off after EVERY phase.

## 7. Visual Progress Dashboard Protocol (`progress.html`)
- **Visual Over Textual:** Whenever the swarm operates on an active project, it must maintain an interactive `progress.html` at the project root. Stakeholders should never have to manually parse disjointed markdown files to assess project health.
- **Mandatory Dashboard Elements:**
  1. **Visual Milestone Stepper:** Displays active phase, completed milestones, and upcoming gates.
  2. **Live Environment Hub:** Embedded links to local dev servers and the **temporary StackBlitz UAT sandbox**.
  3. **Deliverables Index:** Clean cards linking to and summarizing `02_PRD.md`, `04_TECHNICAL_SPEC.md`, `07_TEST_MANIFEST.md`, and `10_UAT_CHECKLIST.md`.
  4. **Acceptance Sign-off:** Interactive checklist for stakeholders to test and approve the release.
