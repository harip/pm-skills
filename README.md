# 🚀 Multi-Agent SDLC Swarm for Solo Founders

> **Build and ship enterprise-grade software as a solo founder, powered by an AI agentic swarm.**

[📊 **Launch Interactive Visualizer Dashboard (`docs/progress.html`)**](docs/progress.html)

---

## ⚡ Quickstart: Create a New App in 3 Steps

Follow these exact steps whenever you want to create a brand-new application using this swarm:

### 1. Create Repo from Template on GitHub
1. Navigate to [**github.com/harip/pm-skills**](https://github.com/harip/pm-skills).
2. Click the green **"Use this template"** button (top right) ➔ **"Create a new repository"**.
3. Name your repository (e.g. `my-dream-app`), select Public/Private, and click **"Create repository"**.

### 2. Clone & Open in Antigravity IDE
Open your terminal and run:
```bash
git clone https://github.com/harip/my-dream-app.git
cd my-dream-app
```
Then open this folder in **Antigravity IDE** (or your editor).

### 3. Kick Off the AI Swarm!
In the chat prompt, type:
```text
/pm start "My Dream App"
```
> **Default Mode:** By default, projects start in **`BALANCED`** mode.
> 
> **Want a different mode?**
> - Start directly in your preferred mode:
>   - `/pm start "My Dream App" autopilot` ➔ Auto-advances across phases, pausing only for Gate 2 mockups, DB setup, Gate 3 UAT, and Release.
>   - `/pm start "My Dream App" supervised` ➔ Pauses for your explicit approval after *every single phase*.
> - Or change it at **any time** (before or during execution):
>   - `/pm mode <balanced|autopilot|supervised>`

The **IT Consultant** will immediately kick off Phase 1 intake. Open [`docs/progress.html`](docs/progress.html) in your browser at any time to watch the live interactive project visualizer!

---

## 💻 Swarm Commands (`/pm`)

Control project intake, phase execution, autonomy modes, and session resumption using simple slash commands:

| Command | Action & Description |
|---|---|
| `/pm start <name> [mode]` | Initialize a new project and launch Phase 1 intake. `[mode]` is optional (`balanced`, `autopilot`, or `supervised`; defaults to `balanced`). |
| `/pm mode <balanced\|autopilot\|supervised>` | Switch or set active autonomy mode at any time (before start or mid-flight). |
| `/pm resume` | Read `NEXT_STEP_POINTER` from `docs/PROJECT_STATUS.md` and execute the assigned agent step. |
| `/pm status` | Inspect project mode, active phase, lead agent, and next step without executing. |
| `/pm next` | Force execute the next actionable step (respecting gate sign-offs). |
| `/pm help` | Display full command list and role matrix. |

### How Starting & Modes Work:
- **Default Start:** Just run `/pm start "My App"`. You do **not** need to set the mode first; it automatically starts in `BALANCED`.
- **Custom Mode Start:** If you prefer Autopilot or Supervised from the very start, specify it in one command:
  ```text
  /pm start "My App" autopilot
  ```
- **Switching Mid-Project:** At any turn, you can type `/pm mode autopilot` (or `balanced`, `supervised`) and the swarm adjusts its pause frequency immediately.
- **Pausing & Resuming:** Stop chatting whenever you want. Your step is saved in `docs/PROJECT_STATUS.md`. Type `/pm resume` to continue anytime.

---

## 📂 Key Locations & Dashboard

All project status tracking and generated deliverables live inside your project's `docs/` and `tests/` folders:

| Location | Purpose & Description |
|---|---|
| 📊 **`docs/progress.html`** | **Interactive Progress Dashboard:** Launch `docs/progress.html` in any browser to inspect real-time project completion, active autonomy mode, full-stack user story statuses, and clickable links to all generated stage documents (`00_PROJECT_CONTRACT.md` through `10_UAT_CHECKLIST.md`). |
| 🔄 **`docs/PROJECT_STATUS.md`** | **Living State Machine:** Tracks current phase progress, completed steps, rolling session log, and `NEXT_STEP_POINTER`. |
| 🧪 **`tests/07_TEST_MANIFEST.md`** | **QA Test Results & Coverage:** Canonical manifest containing unit test outputs, multi-tenant security IDOR checks, ARIA accessibility scores, and visual regression baselines. |

---

## 👥 The 8-Phase Development Process

Every user story is engineered as a complete vertical feature slice (UI through database):

```mermaid
flowchart TB
    PM["PM: entry & routing"] --> IT["1. IT Consultant: contract & brief"]
    IT --> PO["2. Product Owner: scope — Gate 1"]
    PO --> TA["3. Technical Architect: spec & tasks"]
    TA --> CP["4. Content Parser: schemas"]
    CP --> FE["5. Frontend Developer: mockups — Gate 2, then UI"]
    FE --> SE["6. Service Engineer: database setup/skip & services"]
    SE --> QA["7. QA Agent: verification"]
    QA -->|All slices and aggregate QA pass| UAT["8. UAT Coordinator: acceptance — Gate 3"]
    QA -->|Next feature slice| FE
    UAT --> DEP["Release: Deployment Lead — setup/skip, Gate 4 if deploying"]
```

### Autonomy Modes
- 🟢 **`AUTOPILOT`**: Auto-advances between phases. Always stops for UI mockup review (Gate 2), DB setup/skip, UAT sign-off (Gate 3), and Release approval (Gate 4).
- 🟡 **`BALANCED`** (Default): Pauses for explicit founder sign-off at strategic gates (Gate 1 Scope, Gate 2 Mockups, Gate 3 UAT, Gate 4 Release).
- 🔴 **`SUPERVISED`**: Pauses for approval after *every single phase*.

---

## 📂 Standard Directory Layout

```
docs/
├── progress.html           # 📊 Interactive Progress Visualizer Dashboard
├── PROJECT_STATUS.md       # 🔄 Living state machine & NEXT_STEP_POINTER
├── 00_PROJECT_CONTRACT.md  # Phase 1: Capability contract & platform boundaries
├── 01_ARCH_BRIEF.md        # Phase 1: Architecture Brief & Permission Matrix
├── 02_PRD.md               # Phase 2: Product Requirements Document
├── 03_USER_STORIES.md      # Phase 2: Full-stack INVEST user story inventory
├── 04_TECHNICAL_SPEC.md    # Phase 3: Technical Specification
├── 05_TASK_MANIFEST.md     # Phase 3: Task manifest per story slice
├── 06_DESIGN_REGISTER.md   # Phase 5: Screen mockup inventory & approvals
├── 08_SETUP_REGISTER.md   # Phase 6/Release: Non-secret setup & connection evidence
├── 09_RELEASE_PLAN.md      # Release: Production deployment & recovery plan
└── 10_UAT_CHECKLIST.md     # Phase 8: Stakeholder target-platform acceptance (Gate 3)

tests/
└── 07_TEST_MANIFEST.md     # Phase 7: Automated test suite results & coverage evidence
```
