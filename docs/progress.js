// Workflow visualizer. Mirrors canonical rules in GLOBAL_RULES.md and PROJECT_BUILDER_SKILL.md.

const WORKFLOW_STAGES = [
  {
    id: 'discovery',
    phase: 1,
    role: 'IT Consultant',
    skill: 'it_consultant',
    path: 'it_consultant/SKILL.md',
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
    path: 'product_owner/SKILL.md',
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
    path: 'techincal_architect/SKILL.md',
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
    path: 'content_parser/SKILL.md',
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
    path: 'frontend_developer/SKILL.md',
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
    path: 'service_engineer/SKILL.md',
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
    path: 'qa_agent/SKILL.md',
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
    path: 'uat/SKILL.md',
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
    path: 'deployment/SKILL.md',
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
  { id: 'pm', role: 'PM', skill: 'pm', path: 'pm/SKILL.md', icon: '🧭', title: 'Entry & routing', description: 'Routes /pm commands to phase lead. Uses controller document and canonical global rules.' },
  { id: 'orchestrator', role: 'Orchestrator', skill: 'orchestrator', path: 'orchestrator/SKILL.md', icon: '🎼', title: 'State & dashboard', description: 'Maintains project state, revision invalidation, pending approvals, and progress dashboard.', artifacts: [{ name: 'PROJECT_STATUS.md', path: 'docs/PROJECT_STATUS.md', desc: 'Live project state machine pointer' }] },
  { id: 'reviewer', role: 'Architecture Reviewer', skill: 'architecture_reviewer', path: 'architecture_reviewer/SKILL.md', icon: '🔍', title: 'Cross-phase audit', description: 'Reviews deliverables throughout workflow.', artifacts: [{ name: 'docs/reviews/', path: 'docs/reviews/', desc: 'Zero-trust architecture audit logs' }] }
];

const ALL_ROLES = [...WORKFLOW_STAGES, ...SUPPORT_ROLES];
let selectedRoleId = 'services';
let currentAutonomyMode = 'autopilot';

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


