---
name: pm
description: Entry point for the PM SDLC swarm. Handles /pm start, resume, status, next, mode, and help.
---

# PM Command

Use `/pm` as the only user-facing entry point. Route work to the existing swarm skills and keep `docs/PROJECT_STATUS.md` updated through the Orchestrator.

Keep the conversation very terse, concise, and clear. Number all generated documents sequentially (e.g., `01_ARCH_BRIEF.md`, `02_PRD.md`, `03_USER_STORIES.md`, `04_TECHNICAL_SPEC.md`, `05_TASK_MANIFEST.md`, `06_DESIGN_REGISTER.md`, `07_TEST_MANIFEST.md`) so that the user knows the order.

## Commands

- `/pm` - Show active project, or start intake if none exists.
- `/pm start <name>` - Ask for a short project description, create `docs/PROJECT_STATUS.md`, default to `BALANCED`, and start Phase 1 with the IT Consultant.
- `/pm resume` - Read `NEXT_STEP_POINTER` and continue with the assigned agent.
- `/pm status` - Show project, mode, phase, agent, status, and next action. Do not execute work.
- `/pm next` - Execute `NEXT_STEP_POINTER`. Never bypass an approval gate.
- `/pm mode <balanced|autopilot|supervised>` - Update the mode in `PROJECT_STATUS.md`.
- `/pm help` - Show this command list.
- `/pm understand` - Read the skill file and understand

## Agent Routing

```text
Phase 1 -> IT Consultant
Phase 2 -> Product Owner
Phase 3 -> Technical Architect
Phase 4 -> Content Parser
Phase 5 -> Frontend Developer + Apple Design
Phase 6 -> Service Engineer
Phase 7 -> QA Agent
Release -> Deployment Agent
Review -> Architecture Reviewer
State -> Orchestrator
```

Before running an agent, read its `SKILL.md`.

## Start Flow

For `/pm start <name>`:

1. If `docs/PROJECT_STATUS.md` exists, stop and suggest `/pm resume`.
2. Ask only: `Briefly describe what you want to build.`
3. Initialize the project in `BALANCED` mode.
4. Set Phase 1 to `[IN PROGRESS]` and later phases to `[NOT STARTED]`.
5. Set `NEXT_STEP_POINTER` to the IT Consultant.
6. Start Phase 1 immediately.
7. If Mobile App or Website is already stated, do not ask again.

## Resume and Next

- Read `docs/PROJECT_STATUS.md` first.
- Load the agent named in `NEXT_STEP_POINTER` and execute it.
- If awaiting user approval, show the relevant artifacts and wait for `Approved` or revisions.
- After each phase, run the Architecture Reviewer.
- On approval, follow the active autonomy mode.
- On a block, return fixes to the responsible agent.
- Run the Orchestrator after every state change.

## Modes

- `BALANCED`: Stop after Phases 2, 5, and 7.
- `AUTOPILOT`: Stop after generating UI Mock ups and only before production release.
- `SUPERVISED`: Stop after every phase.

Production release always requires explicit approval.

## Missing State

If no project exists, say:

```text
No PM project exists. Run `/pm start <project name>`.
```

For an unknown command, say:

```text
Unknown PM command. Run `/pm help`.
```
