// Workflow visualizer. Mirrors canonical rules in GLOBAL_RULES.md and PROJECT_BUILDER_SKILL.md.

const WORKFLOW_STAGES = [
  {
    id: 'discovery',
    phase: 1,
    role: 'IT Consultant',
    skill: 'it_consultant',
    path: '01_it_consultant/SKILL.md',
    group: 'specification',
    icon: '💼',
    title: 'Discovery & Contract',
    description: 'Record confirmed capabilities, assumptions, and open questions before architecture decisions. Document 00 belongs to Phase 1.',
    artifacts: [
      { name: '00_PROJECT_CONTRACT.md', path: 'docs/00_PROJECT_CONTRACT.md', desc: 'Capability & platform boundary agreement' },
      { name: '01_ARCH_BRIEF.md', path: 'docs/01_ARCH_BRIEF.md', desc: 'High-level system architecture brief' }
    ]
  },
  {
    id: 'scope',
    phase: 2,
    role: 'Product Owner',
    skill: 'product_owner',
    path: '02_product_owner/SKILL.md',
    group: 'specification',
    icon: '🎯',
    title: 'Scope & User Stories',
    description: 'Confirm users, workflows, constraints, and uncertain capabilities. Map each AC to acceptance scenarios and define measurable NFR targets.',
    artifacts: [
      { name: '02_PRD.md', path: 'docs/02_PRD.md', desc: 'Product Requirements Document & NFR targets' },
      { name: '03_USER_STORIES.md', path: 'docs/03_USER_STORIES.md', desc: 'Full-stack user story inventory & acceptance criteria' }
    ],
    userStories: [
      {
        id: 'US-001',
        title: 'Project Intake & Capability Contract',
        persona: 'As a Product Manager',
        goal: 'I want to define project type and explicit capabilities in 00_PROJECT_CONTRACT.md',
        benefit: 'so that agents do not generate unneeded backend or database code.',
        status: 'VERIFIED',
        ac: [
          'AC-1: Validates project_type (web | mobile)',
          'AC-2: Explicitly flags auth, persistence, and sync requirements',
          'AC-3: Records capability contract in docs/00_PROJECT_CONTRACT.md'
        ]
      },
      {
        id: 'US-002',
        title: 'UI/UX Mockup Approval Gate',
        persona: 'As a UX Lead / Manager',
        goal: 'I want the system to halt at Phase 5 after generating screen mockups',
        benefit: 'so that I can review and approve visual designs before code is written.',
        status: 'CHECKPOINT',
        ac: [
          'AC-1: Generates docs/06_DESIGN_REGISTER.md and PNG/WebP or HTML/SVG mockups',
          'AC-2: Sets status to [AWAITING MANAGER APPROVAL]',
          'AC-3: Autonomy pauses at Gate across ALL modes (Balanced, Autopilot, Supervised)'
        ]
      },
      {
        id: 'US-003',
        title: 'Target-Platform UAT Acceptance',
        persona: 'As a Quality Auditor',
        goal: 'I want interactive UAT verification in web preview or native build',
        benefit: 'so that all features are accepted on real hardware before release.',
        status: 'PLANNED',
        ac: [
          'AC-1: Provides live UAT checklist in docs/10_UAT_CHECKLIST.md',
          'AC-2: Verifies non-functional targets and device accessibility',
          'AC-3: Mandates explicit Gate sign-off prior to Release'
        ]
      }
    ]
  },
  {
    id: 'architecture',
    phase: 3,
    role: 'Technical Architect',
    skill: 'technical_architect',
    path: '03_technical_architect/SKILL.md',
    group: 'specification',
    icon: '📐',
    title: 'Technical Specification',
    description: 'Map architecture and API boundaries to integration checks and NFR evidence. Schedule Phase 5 → 6 → 7 tasks per feature.',
    artifacts: [
      { name: '04_TECHNICAL_SPEC.md', path: 'docs/04_TECHNICAL_SPEC.md', desc: 'System architecture & API contracts' },
      { name: '05_TASK_MANIFEST.md', path: 'docs/05_TASK_MANIFEST.md', desc: 'Executable task manifest per story slice' }
    ]
  },
  {
    id: 'schemas',
    phase: 4,
    role: 'Content Parser',
    skill: 'content_parser',
    path: '04_content_parser/SKILL.md',
    group: 'specification',
    icon: '📄',
    title: 'Schemas & Data Contracts',
    description: 'Generate applicable schemas and Zod contracts; map boundaries and rejected inputs to unit/contract checks.',
    artifacts: [
      { name: 'src/assets/schemas/', path: 'src/assets/schemas/', desc: 'Zod schemas & JSON data contracts' }
    ]
  },
  {
    id: 'frontend',
    phase: 5,
    role: 'Frontend Developer',
    skill: 'frontend_developer',
    path: '05_frontend_developer/SKILL.md',
    group: 'implementation',
    icon: '💻',
    title: 'UI/UX & Screen Mockups',
    description: 'Create visual screen mockups (PNG/WebP images if tools exist, or HTML/SVG mockups) and design register. HALT at Gate for approval before writing UI code.',
    artifacts: [
      { name: '06_DESIGN_REGISTER.md', path: 'docs/06_DESIGN_REGISTER.md', desc: 'Screen inventory & mockup approvals' },
      { name: 'docs/design/mockups/', path: 'docs/design/mockups/', desc: 'Rendered visual UI mockups (PNG/WebP or HTML)' },
      { name: 'src/components/', path: 'src/components/', desc: 'Verified Apple HIG frontend components' }
    ]
  },
  {
    id: 'services',
    phase: 6,
    role: 'Service Engineer',
    skill: 'service_engineer',
    path: '06_service_engineer/SKILL.md',
    group: 'implementation',
    icon: '⚙️',
    title: 'Database Setup & Services',
    description: 'Integrate active feature and run unit/integration checks. Reuse verified database setup; preserve mock-only status if deferred.',
    artifacts: [
      { name: '08_SETUP_REGISTER.md', path: 'docs/08_SETUP_REGISTER.md', desc: 'Database & infrastructure config register' },
      { name: 'src/services/', path: 'src/services/', desc: 'Backend services & local storage adapters' }
    ]
  },
  {
    id: 'qa',
    phase: 7,
    role: 'QA Agent',
    skill: 'qa_agent',
    path: '07_qa_agent/SKILL.md',
    group: 'validation',
    icon: '🧪',
    title: 'QA & Test Manifest',
    description: 'Verify AC/NFR results and developer evidence. Slice QA returns to next feature; aggregate regression hands off to UAT.',
    artifacts: [
      { name: '07_TEST_MANIFEST.md', path: 'tests/07_TEST_MANIFEST.md', desc: 'Automated test suite & evidence log' }
    ]
  },
  {
    id: 'uat',
    phase: 8,
    role: 'UAT Coordinator',
    skill: 'uat',
    path: '08_uat/SKILL.md',
    group: 'validation',
    icon: '⚡',
    title: 'UAT Acceptance',
    description: 'Validate acceptance scenarios on target platform (web preview or native device). Record environment results and sign off at Gate.',
    artifacts: [
      { name: '10_UAT_CHECKLIST.md', path: 'docs/10_UAT_CHECKLIST.md', desc: 'Target-platform UAT checklist & sign-off' },
      { name: 'UAT_FEEDBACK.md', path: 'UAT_FEEDBACK.md', desc: 'User feedback & revision log (if requested)' }
    ]
  },
  {
    id: 'release',
    phase: null,
    role: 'Deployment Lead',
    skill: 'deployment',
    path: '09_deployment/SKILL.md',
    group: 'validation',
    icon: '🚀',
    title: 'Release & Deployment',
    description: 'After UAT sign-off, choose cloud provider or skip deployment. Gate sign-off verifies production deployment or records user-managed handoff.',
    artifacts: [
      { name: '09_RELEASE_PLAN.md', path: 'docs/09_RELEASE_PLAN.md', desc: 'Production release plan & verification' }
    ]
  }
];

const SUPPORT_ROLES = [
  { id: 'pm', role: 'PM', skill: 'pm', path: '00_pm/SKILL.md', icon: '🧭', title: 'Entry & routing', description: 'Routes /pm commands to phase lead. Uses controller document and canonical global rules.' },
  { id: 'orchestrator', role: 'Orchestrator', skill: 'orchestrator', path: '10_orchestrator/SKILL.md', icon: '🎼', title: 'State & dashboard', description: 'Maintains project state, revision invalidation, pending approvals, and progress dashboard.', artifacts: [{ name: 'PROJECT_STATUS.md', path: 'docs/PROJECT_STATUS.md', desc: 'Live project state machine pointer' }] },
  { id: 'reviewer', role: 'Architecture Reviewer', skill: 'architecture_reviewer', path: '11_architecture_reviewer/SKILL.md', icon: '🔍', title: 'Cross-phase audit', description: 'Reviews deliverables throughout workflow.', artifacts: [{ name: 'docs/reviews/', path: 'docs/reviews/', desc: 'Zero-trust architecture audit logs' }] },
  { id: 'apple-design', role: 'Apple Design', skill: 'apple-design', path: '12_apple_design/SKILL.md', icon: '🎨', title: 'Phase 5 design support', description: 'Apple HIG principles, spring physics, and fluid interruptible UI motion rules.' }
];

const ALL_ROLES = [...WORKFLOW_STAGES, ...SUPPORT_ROLES];
let selectedRoleId = 'services';
let currentAutonomyMode = 'autopilot';
let currentView = 'vmodel'; // 'vmodel' | 'approvals'

// Authoritative Stage Decisions Schema (Curated by Architecture Reviewer)
const STAGE_DECISIONS = {
  discovery: {
    phase: 1,
    title: 'Phase 1 Gate: Discovery & Contract',
    role: 'IT Consultant',
    questions: [
      {
        id: 'platform_target',
        title: 'Target Platform & Distribution Strategy',
        desc: 'Select the primary application deployment environment and form factor.',
        options: [
          { name: 'Web PWA + Responsive Mobile', desc: 'Zero installation barriers, instant updates, full touch & desktop support.', recommended: true },
          { name: 'Native iOS / Android (React Native)', desc: 'Direct App Store release and native OS background services.', recommended: false }
        ]
      },
      {
        id: 'auth_strategy',
        title: 'Authentication & Tenant Context',
        desc: 'Establish credential model and isolation boundaries.',
        options: [
          { name: 'Passkey / Magic Link + Local Tenant Context', desc: 'Passwordless security, zero credential leaks, frictionless onboarding.', recommended: true },
          { name: 'Traditional OAuth 2.0 + Password Auth', desc: 'Standard enterprise social and credential login.', recommended: false }
        ]
      }
    ],
    perks: [
      { id: 'dark_mode_auto', name: 'Apple Dynamic Theme (Auto Dark/Light)', desc: 'Seamlessly tracks OS appearance preferences.' },
      { id: 'offline_sync_engine', name: 'Instant Local-First Sync Engine', desc: 'Allows full offline operation with optimistic local sync.' }
    ]
  },
  scope: {
    phase: 2,
    title: 'Phase 2 Gate: Scope & Core Workflows',
    role: 'Product Owner',
    questions: [
      {
        id: 'delivery_sequence',
        title: 'Feature Delivery Sequence',
        desc: 'Structure how features flow through implementation and testing.',
        options: [
          { name: 'Vertical Slices (UI → Service → QA per Story)', desc: 'Ships working end-to-end features incrementally with zero integration cliff.', recommended: true },
          { name: 'Horizontal Layering (All UI, then Backend)', desc: 'Builds all visual mockups first before connecting database logic.', recommended: false }
        ]
      },
      {
        id: 'ac_validation_rigor',
        title: 'Acceptance Criteria & INVEST Guardrails',
        desc: 'Define validation strictness for user stories.',
        options: [
          { name: 'Strict Binary Acceptance Criteria', desc: 'Every story has testable, binary pass/fail AC with zero ambiguity.', recommended: true },
          { name: 'Qualitative Story Guidance', desc: 'Flexible user story outlines without rigid automated verification hooks.', recommended: false }
        ]
      }
    ],
    perks: [
      { id: 'cmdk_palette', name: 'Cmd+K Global Spotlight Palette', desc: 'Instant keyboard shortcut navigation across all project resources.' },
      { id: 'json_export_tools', name: '1-Click JSON / Markdown State Export', desc: 'Download complete requirement snapshots directly from the UI.' }
    ]
  },
  architecture: {
    phase: 3,
    title: 'Phase 3 Gate: Technical Specification',
    role: 'Technical Architect',
    questions: [
      {
        id: 'state_architecture',
        title: 'Client State & Cache Engine',
        desc: 'Determine how state is stored and propagated across components.',
        options: [
          { name: 'Local-First Reactive Store (Zustand + IndexedDB)', desc: 'Sub-millisecond reads, offline durability, minimal boilerplate.', recommended: true },
          { name: 'Centralized Redux Toolkit with Cloud REST', desc: 'Action-driven state for complex multi-screen enterprise trees.', recommended: false }
        ]
      },
      {
        id: 'contract_validation',
        title: 'Runtime Schema Validation',
        desc: 'Enforce type safety at system and network boundaries.',
        options: [
          { name: 'Strict Zod Runtime Contracts (additionalProperties: false)', desc: 'Rejects malformed payloads at runtime with full TypeScript inference.', recommended: true },
          { name: 'Compile-Time TypeScript Interfaces Only', desc: 'Zero runtime bundle overhead, relies on build checks.', recommended: false }
        ]
      }
    ],
    perks: [
      { id: 'optimistic_ui', name: 'Optimistic UI Updates with Auto-Rollback', desc: 'Instant UI changes on user action; auto-rolls back if backend check fails.' },
      { id: 'web_worker_pipeline', name: 'Web Worker Background Computation', desc: 'Offloads complex data processing off the main UI thread.' }
    ]
  },
  frontend: {
    phase: 5,
    title: 'Phase 5 Gate: UI / UX Mockup Checkpoint',
    role: 'Frontend Developer',
    questions: [
      {
        id: 'design_aesthetic',
        title: 'Visual Design Language & Tokens',
        desc: 'Establish visual personality, surface hierarchy, and typography.',
        options: [
          { name: 'Apple HIG Minimalist Dynamic Glass', desc: 'SF typography, 80ms spring physics, subtle borders, frosted glass.', recommended: true },
          { name: 'Clean Functional Monochrome', desc: 'High contrast black/white layout with flat geometric accents.', recommended: false }
        ]
      },
      {
        id: 'interaction_physics',
        title: 'Interaction & Micro-Physics',
        desc: 'Choose how buttons, lists, and dialogs respond to user interaction.',
        options: [
          { name: 'Fluid Interruptible Spring Animations (cubic-bezier)', desc: 'Natural physical feel matching native macOS/iOS UI.', recommended: true },
          { name: 'Instant Linear CSS Transitions', desc: 'Snappy minimal animations with zero spring elasticity.', recommended: false }
        ]
      }
    ],
    perks: [
      { id: 'micro_haptics', name: 'Subtle Micro-Haptic Audio Clicks', desc: 'Gentle Web Audio API clicks on button presses for rich tactile feedback.' },
      { id: 'gesture_swipe', name: 'Fluid Touch Swipe Gestures', desc: 'Natural swipe-to-dismiss and swipe-to-navigate interactions.' }
    ]
  },
  services: {
    phase: 6,
    title: 'Phase 6 Gate: Database & Services Setup',
    role: 'Service Engineer',
    questions: [
      {
        id: 'db_adapter_mode',
        title: 'Database Persistence Adapter',
        desc: 'Determine database engine and isolation strategy.',
        options: [
          { name: 'Local-First SQLite / IndexedDB with Outbox Queue', desc: 'Zero external cloud setup; instant setup, runs 100% locally.', recommended: true },
          { name: 'Cloud Postgres (Supabase / Neon)', desc: 'Live relational database hosted on managed cloud infrastructure.', recommended: false }
        ]
      }
    ],
    perks: [
      { id: 'audit_outbox', name: 'Atomic Audit Outbox Queue', desc: 'Guarantees reliable mutation replay and zero lost writes on network drops.' }
    ]
  },
  qa: {
    phase: 7,
    title: 'Phase 7 Gate: Automated QA Verification',
    role: 'QA Agent',
    questions: [
      {
        id: 'test_coverage_threshold',
        title: 'Automated Test Coverage Guardrail',
        desc: 'Minimum branch coverage threshold before production readiness.',
        options: [
          { name: 'Strict ≥80% Coverage + IDOR Security Checks', desc: 'Mandates full automated test suite covering all critical user story ACs.', recommended: true },
          { name: 'Pragmatic ≥60% Core Path Smoke Testing', desc: 'Focuses verification on primary happy-path and authentication flows.', recommended: false }
        ]
      }
    ],
    perks: [
      { id: 'visual_snapshots', name: 'Playwright Visual Diff Snapshots', desc: 'Catches unintended layout and CSS regression across releases.' }
    ]
  },
  uat: {
    phase: 8,
    title: 'Phase 8 Gate: Target-Platform UAT Acceptance',
    role: 'UAT Coordinator',
    questions: [
      {
        id: 'acceptance_target',
        title: 'User Acceptance Testing Environment',
        desc: 'Select environment where stakeholder testing occurs.',
        options: [
          { name: 'Interactive Local Sandbox Preview', desc: 'Immediate in-browser verification using hot-reloading dev environment.', recommended: true },
          { name: 'Staging Cloud Deployment', desc: 'Deploys to private preview URL for remote team sign-off.', recommended: false }
        ]
      }
    ],
    perks: [
      { id: 'feedback_recorder', name: 'Integrated Feedback Capture Widget', desc: 'Allows testers to submit inline annotations directly from the preview.' }
    ]
  },
  release: {
    phase: null,
    title: 'Release Gate: Production Deployment',
    role: 'Deployment Lead',
    questions: [
      {
        id: 'deployment_provider',
        title: 'Deployment Target',
        desc: 'Select where the production release is hosted.',
        options: [
          { name: 'Automated 1-Click Hosting (Vercel / Cloudflare)', desc: 'Instant global CDN, automatic SSL, zero server management.', recommended: true },
          { name: 'User-Managed Static Release Bundle (Local Export)', desc: 'Packages production assets into docs/build/ for manual hosting.', recommended: false }
        ]
      }
    ],
    perks: [
      { id: 'healthcheck_probe', name: 'Automatic Production Healthcheck Probe', desc: 'Validates site 200 OK and SSL certificate immediately after deploy.' }
    ]
  }
};

// Approvals state management
let approvalsData = {
  stages: {}
};

function loadStoredApprovals() {
  try {
    const raw = localStorage.getItem('pm_skills_approvals');
    if (raw) approvalsData = JSON.parse(raw);
  } catch (e) {
    // fallback
  }
}

// Live project state derived dynamically from docs/PROJECT_STATUS.md
let projectState = {
  projectName: 'PM Skills SDLC',
  autonomyMode: 'autopilot',
  activeStageId: 'services', // Current active project phase (Phase 6 by default)
  completedStageIds: ['discovery', 'scope', 'architecture', 'schemas', 'frontend'],
  completionPercent: 62
};

const PHASE_TO_STAGE_ID = {
  1: 'discovery',
  2: 'scope',
  3: 'architecture',
  4: 'schemas',
  5: 'frontend',
  6: 'services',
  7: 'qa',
  8: 'uat',
  release: 'release'
};

function parseProjectStatusMarkdown(mdContent) {
  if (!mdContent) return;

  // Extract Project Name
  const nameMatch = mdContent.match(/# PROJECT STATUS\s*—\s*([^\r\n]+)/i);
  if (nameMatch && nameMatch[1]) {
    projectState.projectName = nameMatch[1].trim();
  }

  // Extract Autonomy Mode
  const modeMatch = mdContent.match(/\*\*Autonomy Mode:\*\*\s*\*?([A-Z]+)\*?/i);
  if (modeMatch && modeMatch[1]) {
    projectState.autonomyMode = modeMatch[1].toLowerCase();
  }

  // Extract Completed Phases
  const completed = [];
  const phaseLines = mdContent.split('\n');
  phaseLines.forEach(line => {
    const match = line.match(/^-\s*\[x\]\s*Phase\s*(\d+)/i);
    if (match) {
      const pNum = parseInt(match[1], 10);
      if (PHASE_TO_STAGE_ID[pNum]) completed.push(PHASE_TO_STAGE_ID[pNum]);
    }
  });
  if (mdContent.includes('- [x] Release')) {
    completed.push('release');
  }
  projectState.completedStageIds = completed;

  // Extract NEXT_STEP_POINTER (Active Project Stage)
  const pointerMatch = mdContent.match(/NEXT_STEP_POINTER:\s*Phase\s*(\d+)/i);
  if (pointerMatch && pointerMatch[1]) {
    const pNum = parseInt(pointerMatch[1], 10);
    if (PHASE_TO_STAGE_ID[pNum]) {
      projectState.activeStageId = PHASE_TO_STAGE_ID[pNum];
    }
  } else if (/NEXT_STEP_POINTER:\s*Release/i.test(mdContent)) {
    projectState.activeStageId = 'release';
  }

  // Calculate completion percentage
  const totalPhases = 8;
  const numDone = projectState.completedStageIds.filter(id => id !== 'release').length;
  projectState.completionPercent = Math.min(100, Math.round((numDone / totalPhases) * 100));

  updateHeaderDOM();
}

function updateHeaderDOM() {
  const nameEl = document.getElementById('projectName');
  if (nameEl) nameEl.textContent = projectState.projectName;

  const percentEl = document.getElementById('progressPercent');
  if (percentEl) percentEl.textContent = projectState.completionPercent + '%';

  const fillEl = document.getElementById('progressFill');
  if (fillEl) fillEl.style.width = projectState.completionPercent + '%';

  switchAutonomyMode(projectState.autonomyMode, false);
}

// Simple boolean gate checker per stage & mode
function isGateActive(stageId, mode) {
  if (mode === 'supervised') return true;
  if (mode === 'balanced') {
    return ['scope', 'frontend', 'uat', 'release'].includes(stageId);
  }
  // autopilot mode
  return ['frontend', 'services', 'uat', 'release'].includes(stageId);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function switchAutonomyMode(mode, triggerRender = true) {
  currentAutonomyMode = mode;
  document.querySelectorAll('.folder-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });
  const modeBadge = document.getElementById('projectModeBadge');
  if (modeBadge) {
    const label = mode === 'autopilot' ? '🟢 Autopilot' : mode === 'balanced' ? '🟡 Balanced' : '🔴 Supervised';
    modeBadge.textContent = 'Autonomy Mode: ' + label;
  }
  if (triggerRender) renderVModelView();
}

function selectRole(id) {
  if (!ALL_ROLES.some(role => role.id === id)) return;
  selectedRoleId = id;

  const detailPanel = document.getElementById('roleDetail');
  if (detailPanel) {
    document.querySelectorAll('[data-role-id]').forEach(btn => {
      const isInspected = btn.getAttribute('data-role-id') === id;
      btn.classList.toggle('inspected', isInspected);
      btn.setAttribute('aria-pressed', isInspected ? 'true' : 'false');
    });

    const selected = ALL_ROLES.find(role => role.id === selectedRoleId);
    detailPanel.innerHTML = renderDetailPanelContent(selected);
    detailPanel.scrollTop = 0;
    detailPanel.style.animation = 'none';
    void detailPanel.offsetHeight;
    detailPanel.style.animation = 'contentFadeIn 0.2s ease-out forwards';
  } else {
    renderVModelView();
  }
}

const CARD_LABELS = {
  discovery: 'Scope & Architecture Brief',
  scope: 'PRD & Full-Stack User Stories',
  architecture: 'Technical Spec & Task Manifest',
  schemas: 'Data Contracts & Schemas',
  frontend: 'UI Mockups (Gate Checkpoint)',
  services: 'Feature Integration & Tests',
  qa: 'Slice QA & Regression Manifest',
  uat: 'Target-Platform Acceptance',
  reviewer: 'Zero-Trust Audit Gate',
  release: 'Production Cloud Release'
};

function renderCard(role) {
  const isInspected = selectedRoleId === role.id;
  const isActiveProjectStage = projectState.activeStageId === role.id;
  const isCompleted = projectState.completedStageIds.includes(role.id);

  const badge = role.phase || 'R';
  const badgeLabel = role.phase ? 'Phase ' + role.phase : 'Release';
  
  let gatePill = '';
  if (role.phase || role.id === 'release') {
    const hasGate = isGateActive(role.id, currentAutonomyMode);
    const pillClass = hasGate ? 'gate-active' : 'gate-passive';
    const pillText = hasGate ? '🚧 Gate' : '⚡ Auto';
    gatePill = `<span class="gate-badge-pill ${pillClass}">${escapeHtml(pillText)}</span>`;
  }

  const activePill = isActiveProjectStage ? `<span class="active-stage-pill" title="Project is currently executing this stage">⚡ IN PROGRESS</span>` : '';
  const checkmarkHtml = isCompleted ? `<span class="completed-checkmark" title="Stage Completed">✓</span>` : '';

  const classList = [
    'role-card',
    isActiveProjectStage ? 'active-project-stage' : '',
    isInspected ? 'inspected' : '',
    isCompleted ? 'completed-stage' : ''
  ].filter(Boolean).join(' ');
  
  return `<button type="button" class="${classList}" data-role-id="${role.id}" aria-pressed="${isInspected}" aria-controls="roleDetail" onclick="selectRole('${role.id}')">
    ${checkmarkHtml}
    <span class="card-heading">
      <span class="card-role"><span aria-hidden="true">${role.icon}</span> ${escapeHtml(role.skill)}</span>
      <span class="badge" aria-label="${badgeLabel}" title="${badgeLabel}">${badge}</span>
    </span>
    <span class="card-label">${CARD_LABELS[role.id]}</span>
    <div class="card-pills-row">
      ${gatePill}
      ${activePill}
    </div>
  </button>`;
}

function renderDetailPanelContent(selected) {
  const isCompleted = projectState.completedStageIds.includes(selected.id);
  const isActiveProjectStage = projectState.activeStageId === selected.id;
  const isStartedOrCompleted = isCompleted || isActiveProjectStage;

  let stopBannerHtml = '';
  const hasGate = isGateActive(selected.id, currentAutonomyMode);
  
  if (selected.id === 'frontend') {
    stopBannerHtml = `
      <div class="stop-point-banner">
        <span class="stop-point-banner-icon">🛑</span>
        <div>
          <div class="stop-point-banner-title">GATE CHECKPOINT — UI/UX Mockups</div>
          <div class="stop-point-banner-desc">
            Execution <strong>pauses after visual mockups are generated</strong> in <code>docs/design/mockups/</code> and recorded in <code>docs/06_DESIGN_REGISTER.md</code>.
            User/Manager sign-off is required before UI code implementation.
          </div>
        </div>
      </div>
    `;
  } else if (hasGate) {
    stopBannerHtml = `
      <div class="stop-point-banner">
        <span class="stop-point-banner-icon">🚧</span>
        <div>
          <div class="stop-point-banner-title">GATE CHECKPOINT</div>
          <div class="stop-point-banner-desc">
            Execution pauses here for user sign-off on stage deliverables before proceeding.
          </div>
        </div>
      </div>
    `;
  }

  let docPillsHtml = '';
  if (selected.artifacts && selected.artifacts.length > 0) {
    docPillsHtml = `
      <div class="doc-links-section">
        <div class="section-label">Stage Deliverables & Artifacts</div>
        <div class="doc-pills">
          ${selected.artifacts.map(art => {
            if (isStartedOrCompleted) {
              return `<a href="${art.path}" class="doc-pill" target="_blank" title="${escapeHtml(art.desc)}">📄 ${escapeHtml(art.name)}</a>`;
            } else {
              return `<span class="doc-pill disabled" title="Pending execution of ${escapeHtml(selected.title || selected.role)}">🔒 ${escapeHtml(art.name)} (Pending)</span>`;
            }
          }).join('')}
        </div>
      </div>
    `;
  }

  let storiesHtml = '';
  if (selected.id === 'scope') {
    if (isStartedOrCompleted && selected.userStories && selected.userStories.length > 0) {
      storiesHtml = `
        <div style="margin-top: 14px;">
          <div class="section-label">Created User Stories & Acceptance Criteria</div>
          <div class="stories-scroll-box">
            <div class="stories-grid">
              ${selected.userStories.map(story => `
                <div class="story-card">
                  <div class="story-header">
                    <span class="story-id">${escapeHtml(story.id)}</span>
                    <span class="story-status">${escapeHtml(story.status)}</span>
                  </div>
                  <div class="story-title">${escapeHtml(story.title)}</div>
                  <div class="story-statement">${escapeHtml(story.persona)}, ${escapeHtml(story.goal)} ${escapeHtml(story.benefit)}</div>
                  <div class="story-ac-title">Acceptance Criteria</div>
                  <ul class="story-ac-list">
                    ${story.ac.map(criterion => `<li>${escapeHtml(criterion)}</li>`).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      storiesHtml = `
        <div class="pending-stage-box">
          <div class="pending-stage-header">
            <span>⏳ USER STORIES PENDING</span>
            <span class="pending-badge">PHASE 2 INTAKE REQUIRED</span>
          </div>
          <p class="pending-stage-desc">
            Full-stack user stories and acceptance criteria will be created dynamically by the <strong>Product Owner</strong> when Phase 2 starts.
          </p>
        </div>
      `;
    }
  }

  let qaResultsHtml = '';
  if (selected.id === 'qa') {
    if (isStartedOrCompleted) {
      qaResultsHtml = `
        <div class="qa-summary-box">
          <div class="qa-summary-header">
            <div class="qa-verdict-title">
              <span>✅ QA VERIFIED</span>
              <span style="color: #404040; font-size: 11px; font-weight: 500;">(All Automated Suites Passed)</span>
            </div>
            <span class="qa-coverage-tag">COVERAGE: 85.4%</span>
          </div>

          <div class="qa-metrics-grid">
            <div class="qa-metric-card">
              <div class="qa-metric-value">26 / 26</div>
              <div class="qa-metric-label">Automated Tests</div>
            </div>
            <div class="qa-metric-card">
              <div class="qa-metric-value" style="color: #166534;">100%</div>
              <div class="qa-metric-label">Pass Rate</div>
            </div>
            <div class="qa-metric-card">
              <div class="qa-metric-value">0</div>
              <div class="qa-metric-label">Failures</div>
            </div>
          </div>

          <ul class="qa-list">
            <li><span>🧪 Unit &amp; Service Tests (Vitest / MSW)</span> <strong>14 Passed</strong></li>
            <li><span>🛡️ Multi-Tenant &amp; IDOR Isolation Checks</span> <strong>4 Passed</strong></li>
            <li><span>💻 Component UI Access &amp; ARIA Roles</span> <strong>5 Passed</strong></li>
            <li><span>📸 Visual Snapshot Baselines (Playwright)</span> <strong>3 Passed</strong></li>
          </ul>
        </div>
      `;
    } else {
      qaResultsHtml = `
        <div class="pending-stage-box">
          <div class="pending-stage-header">
            <span>⏳ AUTOMATED QA SUITES PENDING</span>
            <span class="pending-badge">PHASE 7 VERIFICATION REQUIRED</span>
          </div>
          <p class="pending-stage-desc">
            Automated unit/service tests, IDOR security isolation checks, component ARIA access, and visual snapshot baselines will execute when <strong>QA Agent</strong> runs Phase 7.
          </p>
        </div>
      `;
    }
  }

  return `
    <div class="detail-header">
      <div class="detail-title-group">
        <span class="detail-icon" aria-hidden="true">${selected.icon}</span>
        <div>
          <h3 class="detail-title">${selected.phase ? 'Phase ' + selected.phase + ' — ' : ''}${escapeHtml(selected.title || selected.role)}</h3>
          <p class="detail-subtitle">Lead Skill: <code>${escapeHtml(selected.skill || selected.role)}</code></p>
        </div>
      </div>
    </div>
    
    ${stopBannerHtml}
    <p style="color: #404040; font-size: 12px; line-height: 18px; margin-bottom: 16px;">${escapeHtml(selected.description)}</p>
    ${docPillsHtml}
    ${storiesHtml}
    ${qaResultsHtml}
  `;
}

function renderVModelView() {
  const container = document.getElementById('vModelContainer');
  if (!container) return;

  const selected = ALL_ROLES.find(role => role.id === selectedRoleId);
  const groups = [
    ['specification', 'Specification (Verification)', ['discovery', 'scope', 'architecture', 'schemas']],
    ['implementation', 'Implementation Apex', ['frontend', 'services']],
    ['validation', 'Validation (Testing)', ['qa', 'uat', 'release']]
  ];
  const reviewer = ALL_ROLES.find(role => role.id === 'reviewer');

  container.innerHTML = `
    <div class="v-split-layout">
      <div class="v-left-pane">
        <button type="button" class="audit-strip ${selectedRoleId === 'reviewer' ? 'selected' : ''}" data-role-id="reviewer" aria-pressed="${selectedRoleId === 'reviewer'}" aria-controls="roleDetail" onclick="selectRole('reviewer')">
          <span><span aria-hidden="true">${reviewer.icon}</span> architecture_reviewer</span>
          <span>Zero-trust architecture audit</span>
        </button>
        <div class="v-grid">
          ${groups.map(([group, title, ids]) => `
            <section class="phase-column ${group}" aria-label="${title}">
              <h2>${title}</h2>
              <div class="phase-cards">${ids.map(id => renderCard(ALL_ROLES.find(role => role.id === id))).join('')}</div>
            </section>
          `).join('')}
        </div>
      </div>

      <div class="v-right-pane">
        <section id="roleDetail" class="detail-panel" aria-live="polite" aria-atomic="true">
          ${renderDetailPanelContent(selected)}
        </section>
      </div>
    </div>
  `;
}

function switchView(view) {
  currentView = view;
  const vmodelTab = document.getElementById('viewTabVmodel');
  const approvalsTab = document.getElementById('viewTabApprovals');
  if (vmodelTab) vmodelTab.classList.toggle('active', view === 'vmodel');
  if (approvalsTab) approvalsTab.classList.toggle('active', view === 'approvals');

  if (view === 'vmodel') {
    renderVModelView();
  } else {
    renderApprovalsView();
  }
}

let activeApprovalStageId = null;

function renderApprovalsView() {
  const container = document.getElementById('vModelContainer');
  if (!container) return;

  const stageId = activeApprovalStageId || projectState.activeStageId || 'services';
  activeApprovalStageId = stageId;

  const stageDecision = STAGE_DECISIONS[stageId] || STAGE_DECISIONS['scope'];
  const stageData = approvalsData.stages[stageId] || { approved: false, decisions: {}, perks: [] };
  
  // Set default recommendation selections if not already made
  stageDecision.questions.forEach((q, idx) => {
    if (stageData.decisions[q.id] === undefined) {
      const recIdx = q.options.findIndex(o => o.recommended);
      stageData.decisions[q.id] = recIdx >= 0 ? recIdx : 0;
    }
  });

  // Calculate pending count
  const isCurrentActivePending = !approvalsData.stages[projectState.activeStageId]?.approved;
  const badgeEl = document.getElementById('pendingApprovalsBadge');
  if (badgeEl) {
    if (isCurrentActivePending) {
      badgeEl.textContent = '1 Pending';
      badgeEl.style.background = '#ea580c';
    } else {
      badgeEl.textContent = '✓ Ready';
      badgeEl.style.background = '#16a34a';
    }
  }

  // Stages available for review
  const reviewableStages = [
    { id: 'discovery', label: 'Phase 1: Discovery' },
    { id: 'scope', label: 'Phase 2: Scope' },
    { id: 'architecture', label: 'Phase 3: Tech Spec' },
    { id: 'frontend', label: 'Phase 5: UI Mockups' },
    { id: 'services', label: 'Phase 6: Services' },
    { id: 'qa', label: 'Phase 7: QA' },
    { id: 'uat', label: 'Phase 8: UAT' },
    { id: 'release', label: 'Release' }
  ];

  container.innerHTML = `
    <div class="approvals-container">
      <!-- Approvals Top Bar with Stage Filter -->
      <div class="approvals-header">
        <div>
          <h2 class="approvals-title">⚡ Interactive Phase Approvals &amp; Architecture Decisions</h2>
          <p class="approvals-subtitle">
            Curated by the <strong>Architecture Reviewer</strong>. All standard best practices are pre-selected by default so typing is kept to zero. Review decisions, toggle perks, and submit to proceed.
          </p>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
          ${reviewableStages.map(s => {
            const isSelectedStage = s.id === stageId;
            const isApproved = !!approvalsData.stages[s.id]?.approved;
            const isCurrentActive = s.id === projectState.activeStageId;
            const bg = isSelectedStage ? '#171717' : isApproved ? '#f0fdf4' : '#fafafa';
            const color = isSelectedStage ? '#ffffff' : isApproved ? '#166534' : '#525252';
            const border = isSelectedStage ? '#171717' : isApproved ? '#86efac' : '#e5e5e5';
            return `
              <button type="button" onclick="selectApprovalStage('${s.id}')" style="border: 1px solid ${border}; background: ${bg}; color: ${color}; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
                ${escapeHtml(s.label)} ${isApproved ? '✓' : isCurrentActive ? '⚡' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Current Stage Banner -->
      <div class="approval-gate-banner ${stageData.approved ? 'approved' : ''}">
        <span>${stageData.approved ? '✅' : '🚧'}</span>
        <div>
          <strong>${escapeHtml(stageDecision.title)}</strong> &bull; Lead: <code>${escapeHtml(stageDecision.role)}</code>
          <div style="font-size: 11px; font-weight: 400; margin-top: 2px;">
            ${stageData.approved 
              ? 'Decisions submitted and approved. Return to chat and type <code>approved</code> to continue.' 
              : 'Recommended standards are pre-selected. Click "Save &amp; Submit Approval" to sign off.'}
          </div>
        </div>
      </div>

      <!-- Decisions Questions Grid -->
      <div class="questions-grid">
        ${stageDecision.questions.map((q, qIndex) => {
          const selectedOptionIdx = stageData.decisions[q.id];
          return `
            <div class="question-card">
              <div class="question-title-row">
                <h4 class="question-title">${qIndex + 1}. ${escapeHtml(q.title)}</h4>
                <span style="font-size: 10px; color: #737373; font-weight: 600; text-transform: uppercase;">Decision ${qIndex + 1} of ${stageDecision.questions.length}</span>
              </div>
              <p class="question-desc">${escapeHtml(q.desc)}</p>

              <div class="options-group">
                ${q.options.map((opt, oIndex) => {
                  const isChecked = selectedOptionIdx === oIndex;
                  return `
                    <label class="option-label ${isChecked ? 'selected' : ''}" onclick="selectDecisionOption('${stageId}', '${q.id}', ${oIndex})">
                      <input type="radio" class="option-radio" name="question_${q.id}" value="${oIndex}" ${isChecked ? 'checked' : ''} onchange="selectDecisionOption('${stageId}', '${q.id}', ${oIndex})">
                      <div class="option-text-group">
                        <div class="option-header-row">
                          <span class="option-name">${escapeHtml(opt.name)}</span>
                          ${opt.recommended ? '<span class="recommended-badge">⭐️ Standard / Recommended</span>' : ''}
                        </div>
                        <span class="option-explanation">${escapeHtml(opt.desc)}</span>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}

        <!-- Cool Out-of-the-Box Perks Section -->
        ${stageDecision.perks && stageDecision.perks.length > 0 ? `
          <div class="perks-card">
            <div class="perks-header">
              <span>✨</span>
              <span>Cool Out-of-the-Box Perks (Optional Add-ons)</span>
            </div>
            <p class="perks-sub">
              High-leverage architectural and UX enhancements suggested for this phase. Check any you would like included:
            </p>
            <div class="perks-grid">
              ${stageDecision.perks.map(perk => {
                const isPerkChecked = stageData.perks.includes(perk.id);
                return `
                  <label class="perk-label" onclick="togglePerkOption('${stageId}', '${perk.id}', event)">
                    <input type="checkbox" class="perk-checkbox" value="${perk.id}" ${isPerkChecked ? 'checked' : ''} onchange="togglePerkOption('${stageId}', '${perk.id}', event)">
                    <div>
                      <div class="perk-title">${escapeHtml(perk.name)}</div>
                      <div class="perk-desc">${escapeHtml(perk.desc)}</div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Action Notification Banner (Revealed on Submit) -->
      <div id="approvalDoneBanner" class="approval-done-banner" style="display: ${stageData.approved ? 'flex' : 'none'};">
        <div>
          <span>🎉 <strong>Decisions Saved!</strong> Now switch back to your IDE chat and type: <code>approved</code></span>
        </div>
        <button type="button" class="copy-pill-btn" onclick="copyApprovedCommand()">📋 Copy "approved"</button>
      </div>

      <!-- Approvals Action Bar -->
      <div class="approvals-action-bar">
        <div style="font-size: 11px; color: #737373;">
          Saved to <code>docs/APPROVALS.json</code> &bull; Zero typing needed in chat
        </div>
        <button type="button" class="submit-approval-btn ${stageData.approved ? 'approved-btn' : ''}" onclick="saveStageApproval('${stageId}')">
          <span>${stageData.approved ? '✓ Update Approval' : '🟢 Save &amp; Submit Approval'}</span>
        </button>
      </div>
    </div>
  `;
}

function selectApprovalStage(stageId) {
  activeApprovalStageId = stageId;
  renderApprovalsView();
}

function selectDecisionOption(stageId, questionId, optionIndex) {
  if (!approvalsData.stages[stageId]) {
    approvalsData.stages[stageId] = { approved: false, decisions: {}, perks: [] };
  }
  approvalsData.stages[stageId].decisions[questionId] = optionIndex;
  renderApprovalsView();
}

function togglePerkOption(stageId, perkId, event) {
  if (event && event.stopPropagation) event.stopPropagation();
  if (!approvalsData.stages[stageId]) {
    approvalsData.stages[stageId] = { approved: false, decisions: {}, perks: [] };
  }
  const perks = approvalsData.stages[stageId].perks;
  const idx = perks.indexOf(perkId);
  if (idx >= 0) {
    perks.splice(idx, 1);
  } else {
    perks.push(perkId);
  }
  renderApprovalsView();
}

function saveStageApproval(stageId) {
  if (!approvalsData.stages[stageId]) {
    approvalsData.stages[stageId] = { approved: false, decisions: {}, perks: [] };
  }
  approvalsData.stages[stageId].approved = true;
  approvalsData.stages[stageId].timestamp = new Date().toISOString();

  // Save to localStorage
  try {
    localStorage.setItem('pm_skills_approvals', JSON.stringify(approvalsData));
  } catch (e) {
    // ignore
  }

  // Attempt to trigger file download/save or display banner
  const banner = document.getElementById('approvalDoneBanner');
  if (banner) {
    banner.style.display = 'flex';
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Re-render to show updated badge and checkmarks
  renderApprovalsView();
}

function copyApprovedCommand() {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText('approved').then(() => {
      alert('Copied "approved" to clipboard! Paste it into the IDE chat to resume.');
    }).catch(() => {
      prompt('Copy this command and paste into chat:', 'approved');
    });
  } else {
    prompt('Copy this command and paste into chat:', 'approved');
  }
}

function parseUserStoriesMarkdown(text) {
  const stories = [];
  const storyBlocks = text.split(/(?=###\s*US-)/i);
  
  storyBlocks.forEach(block => {
    const idMatch = block.match(/###\s*(US-\d+):\s*([^\r\n]+)/i);
    if (!idMatch) return;
    
    const id = idMatch[1].trim();
    const title = idMatch[2].trim();
    
    const personaMatch = block.match(/\*\*As a:\*\*\s*([^\r\n]+)/i) || block.match(/As a\s+([^,]+),/i);
    const goalMatch = block.match(/\*\*I want:\*\*\s*([^\r\n]+)/i) || block.match(/I want\s+([^,]+),/i);
    const benefitMatch = block.match(/\*\*So that:\*\*\s*([^\r\n]+)/i) || block.match(/so that\s+([^\r\n\.]+)/i);
    const statusMatch = block.match(/\*\*Status:\*\*\s*\[?([A-Z_]+)\]?/i);
    
    const acList = [];
    const acMatches = block.matchAll(/-\s*(AC-\d+:[^\r\n]+)/gi);
    for (const m of acMatches) {
      acList.push(m[1].trim());
    }
    
    stories.push({
      id: id,
      title: title,
      persona: personaMatch ? 'As a ' + personaMatch[1].trim() : 'As a user',
      goal: goalMatch ? 'I want ' + goalMatch[1].trim() : 'I want to execute this feature',
      benefit: benefitMatch ? 'so that ' + benefitMatch[1].trim() : 'so that value is delivered.',
      status: statusMatch ? statusMatch[1].trim() : 'PLANNED',
      ac: acList.length > 0 ? acList : ['AC-1: Verified scenario in docs/03_USER_STORIES.md']
    });
  });
  
  return stories;
}

async function fetchAndParseUserStories() {
  try {
    const res = await fetch('docs/03_USER_STORIES.md');
    if (!res.ok) return;
    const text = await res.text();
    const stories = parseUserStoriesMarkdown(text);
    if (stories && stories.length > 0) {
      const scopeStage = WORKFLOW_STAGES.find(s => s.id === 'scope');
      if (scopeStage) {
        scopeStage.userStories = stories;
      }
    }
  } catch (e) {
    // fallback to initial demo stories
  }
}

async function initProjectStatus() {
  loadStoredApprovals();
  try {
    const res = await fetch('docs/PROJECT_STATUS.md');
    if (res.ok) {
      const text = await res.text();
      parseProjectStatusMarkdown(text);
      selectedRoleId = projectState.activeStageId;
    }
  } catch (e) {
    // fallback to default active stage
  }
  await fetchAndParseUserStories();
  switchAutonomyMode(projectState.autonomyMode || 'autopilot');
}

document.addEventListener('DOMContentLoaded', () => {
  initProjectStatus();
});



