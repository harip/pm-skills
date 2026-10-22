// Minimalist V-Model & Phase Review Visualizer for PM Skills SDLC
// Reads live project state from window.PM_DATA (loaded via docs/progress-data.js)

const WORKFLOW_STAGES = [
  {
    id: 'discovery',
    phase: 1,
    role: 'IT Consultant',
    skill: 'it_consultant',
    group: 'specification',
    icon: '💼',
    title: 'Discovery & Contract',
    description: 'Capability contract, assumptions, and permission matrix before architecture decisions.',
    artifacts: [
      { name: '00_PROJECT_CONTRACT.md', path: '00_PROJECT_CONTRACT.md', desc: 'Capability & platform contract' },
      { name: '01_ARCH_BRIEF.md', path: '01_ARCH_BRIEF.md', desc: 'High-level architecture brief' }
    ]
  },
  {
    id: 'scope',
    phase: 2,
    role: 'Product Owner',
    skill: 'product_owner',
    group: 'specification',
    icon: '🎯',
    title: 'Scope & User Stories',
    description: 'Vertical-slice INVEST user stories (≤10 P1s), acceptance scenarios, and measurable NFR targets.',
    artifacts: [
      { name: '02_PRD.md', path: '02_PRD.md', desc: 'Product Requirements Document & NFR targets' },
      { name: '03_USER_STORIES.md', path: '03_USER_STORIES.md', desc: 'Full-stack user story inventory' }
    ]
  },
  {
    id: 'architecture',
    phase: 3,
    role: 'Technical Architect',
    skill: 'technical_architect',
    group: 'specification',
    icon: '📐',
    title: 'Technical Specification',
    description: 'Strict TypeScript contracts, entity metadata, sync protocols, and executable task manifest.',
    artifacts: [
      { name: '04_TECHNICAL_SPEC.md', path: '04_TECHNICAL_SPEC.md', desc: 'System architecture & API contracts' },
      { name: '05_TASK_MANIFEST.md', path: '05_TASK_MANIFEST.md', desc: 'Executable task manifest per story' }
    ]
  },
  {
    id: 'schemas',
    phase: 4,
    role: 'Content Parser',
    skill: 'content_parser',
    group: 'specification',
    icon: '📄',
    title: 'Schemas & Data Contracts',
    description: 'Draft-07 JSON schemas, Zod runtime contracts, and mock fixtures in src/assets/schemas/.',
    artifacts: [
      { name: 'src/assets/schemas/', path: '../src/assets/schemas/', desc: 'Zod schemas & JSON data contracts' }
    ]
  },
  {
    id: 'frontend',
    phase: 5,
    role: 'Frontend Developer',
    skill: 'frontend_developer',
    group: 'implementation',
    icon: '💻',
    title: 'UI/UX & Mockups (Gate 2)',
    description: 'Visual screen mockups, design register, and Apple HIG 80ms spring components.',
    artifacts: [
      { name: '06_DESIGN_REGISTER.md', path: '06_DESIGN_REGISTER.md', desc: 'Screen inventory & mockup register' },
      { name: 'docs/design/mockups/', path: 'design/mockups/', desc: 'Rendered visual mockups' }
    ]
  },
  {
    id: 'services',
    phase: 6,
    role: 'Service Engineer',
    skill: 'service_engineer',
    group: 'implementation',
    icon: '⚙️',
    title: 'Database Setup & Services',
    description: 'Local-first DB adapter, hooks, atomic sync outbox, and security guard implementations.',
    artifacts: [
      { name: '08_SETUP_REGISTER.md', path: '08_SETUP_REGISTER.md', desc: 'Database & infra config register' }
    ]
  },
  {
    id: 'qa',
    phase: 7,
    role: 'QA Agent',
    skill: 'qa_agent',
    group: 'validation',
    icon: '🧪',
    title: 'QA & Test Manifest',
    description: 'Automated test suite (≥80% coverage), IDOR/tenant isolation tests, and actual render snapshots.',
    artifacts: [
      { name: '07_TEST_MANIFEST.md', path: '../tests/07_TEST_MANIFEST.md', desc: 'Automated test suite & evidence log' }
    ]
  },
  {
    id: 'uat',
    phase: 8,
    role: 'UAT Coordinator',
    skill: 'uat',
    group: 'validation',
    icon: '⚡',
    title: 'Target-Platform UAT (Gate 3)',
    description: 'Stakeholder acceptance testing in web sandbox, native preview, or staging.',
    artifacts: [
      { name: '10_UAT_CHECKLIST.md', path: '10_UAT_CHECKLIST.md', desc: 'Target UAT checklist & sign-off' }
    ]
  },
  {
    id: 'release',
    phase: null,
    role: 'Deployment Lead',
    skill: 'deployment',
    group: 'validation',
    icon: '🚀',
    title: 'Production Release (Gate 4)',
    description: 'Cloud deployment to Vercel/EAS, or verified user-managed handoff.',
    artifacts: [
      { name: '09_RELEASE_PLAN.md', path: '09_RELEASE_PLAN.md', desc: 'Production release plan & verification' }
    ]
  }
];

const SUPPORT_ROLES = [
  { id: 'reviewer', role: 'Architecture Reviewer', skill: 'architecture_reviewer', icon: '🔍', title: 'Zero-trust architecture audit', description: 'Cross-phase zero-trust auditor.' }
];

const ALL_ROLES = [...WORKFLOW_STAGES, ...SUPPORT_ROLES];

let currentView = 'vmodel'; // 'vmodel' | 'approvals'
let selectedRoleId = 'scope';
let currentAutonomyMode = 'balanced';

// Ingest live state from window.PM_DATA
const pmData = window.PM_DATA || {};
let projectState = {
  projectName: pmData.projectName || 'PM Skills SDLC',
  autonomyMode: pmData.autonomyMode || 'balanced',
  activeStageId: pmData.activeStageId || 'scope',
  completedStageIds: pmData.completedStageIds || [],
  completionPercent: pmData.completionPercent || 0,
  pendingReview: pmData.pendingReview || null,
  userStories: pmData.userStories || [],
  qaSummary: pmData.qaSummary || null
};

selectedRoleId = projectState.activeStageId;
currentAutonomyMode = projectState.autonomyMode;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function isGateActive(stageId, mode) {
  if (mode === 'supervised') return true;
  if (mode === 'balanced') return ['scope', 'frontend', 'services', 'uat', 'release'].includes(stageId);
  return ['frontend', 'services', 'uat', 'release'].includes(stageId);
}

function switchView(view) {
  currentView = view;
  const vTab = document.getElementById('viewTabVmodel');
  const aTab = document.getElementById('viewTabApprovals');
  if (vTab) vTab.classList.toggle('active', view === 'vmodel');
  if (aTab) aTab.classList.toggle('active', view === 'approvals');
  if (view === 'vmodel') renderVModelView();
  else renderApprovalsView();
}

function switchAutonomyMode(mode) {
  currentAutonomyMode = mode;
  document.querySelectorAll('.folder-tab[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });
  const modeBadge = document.getElementById('projectModeBadge');
  if (modeBadge) {
    const label = mode === 'autopilot' ? '🟢 Autopilot' : mode === 'balanced' ? '🟡 Balanced' : '🔴 Supervised';
    modeBadge.textContent = 'Autonomy Mode: ' + label;
  }
  if (currentView === 'vmodel') renderVModelView();
}

function selectRole(id) {
  selectedRoleId = id;
  const detailPanel = document.getElementById('roleDetail');
  if (detailPanel) {
    document.querySelectorAll('[data-role-id]').forEach(btn => {
      btn.classList.toggle('inspected', btn.getAttribute('data-role-id') === id);
    });
    const selected = ALL_ROLES.find(r => r.id === id);
    detailPanel.innerHTML = renderDetailPanelContent(selected);
  }
}

function renderCard(role) {
  const isInspected = selectedRoleId === role.id;
  const isActive = projectState.activeStageId === role.id;
  const isCompleted = projectState.completedStageIds.includes(role.id);
  const badge = role.phase || 'R';
  const hasGate = isGateActive(role.id, currentAutonomyMode);

  return `
    <button type="button" class="role-card ${isActive ? 'active-project-stage' : ''} ${isInspected ? 'inspected' : ''} ${isCompleted ? 'completed-stage' : ''}" data-role-id="${role.id}" onclick="selectRole('${role.id}')">
      ${isCompleted ? '<span class="completed-checkmark">✓</span>' : ''}
      <span class="card-heading">
        <span class="card-role"><span aria-hidden="true">${role.icon}</span> ${escapeHtml(role.skill)}</span>
        <span class="badge">${badge}</span>
      </span>
      <span class="card-label">${escapeHtml(role.title)}</span>
      <div class="card-pills-row">
        ${hasGate ? '<span class="gate-badge-pill gate-active">🚧 Gate</span>' : '<span class="gate-badge-pill gate-passive">⚡ Auto</span>'}
        ${isActive ? '<span class="active-stage-pill">⚡ ACTIVE</span>' : ''}
      </div>
    </button>
  `;
}

function renderDetailPanelContent(selected) {
  const isCompleted = projectState.completedStageIds.includes(selected.id);
  const isActive = projectState.activeStageId === selected.id;
  const isStartedOrDone = isCompleted || isActive;

  let storiesHtml = '';
  if (selected.id === 'scope' && projectState.userStories.length > 0) {
    storiesHtml = `
      <div style="margin-top: 14px;">
        <div class="section-label">User Stories (${projectState.userStories.length})</div>
        <div class="stories-scroll-box">
          <div class="stories-grid">
            ${projectState.userStories.map(s => `
              <div class="story-card">
                <div class="story-header">
                  <span class="story-id">${escapeHtml(s.id)}</span>
                  <span class="story-status">${escapeHtml(s.status || 'PLANNED')}</span>
                </div>
                <div class="story-title">${escapeHtml(s.title)}</div>
                <div class="story-statement">${escapeHtml(s.persona)}, ${escapeHtml(s.goal)} ${escapeHtml(s.benefit)}</div>
                ${s.ac ? `<ul class="story-ac-list">${s.ac.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="detail-header">
      <div class="detail-title-group">
        <span class="detail-icon">${selected.icon}</span>
        <div>
          <h3 class="detail-title">${selected.phase ? 'Phase ' + selected.phase + ' — ' : ''}${escapeHtml(selected.title || selected.role)}</h3>
          <p class="detail-subtitle">Lead: <code>${escapeHtml(selected.skill || selected.role)}</code></p>
        </div>
      </div>
    </div>
    <p style="color: #404040; font-size: 12px; line-height: 18px;">${escapeHtml(selected.description)}</p>
    ${selected.artifacts ? `
      <div class="doc-links-section">
        <div class="section-label">Deliverables</div>
        <div class="doc-pills">
          ${selected.artifacts.map(a => `
            <a href="${a.path}" class="doc-pill ${isStartedOrDone ? '' : 'disabled'}" target="_blank">📄 ${escapeHtml(a.name)}</a>
          `).join('')}
        </div>
      </div>
    ` : ''}
    ${storiesHtml}
  `;
}

function renderVModelView() {
  const container = document.getElementById('vModelContainer');
  if (!container) return;

  const selected = ALL_ROLES.find(r => r.id === selectedRoleId) || WORKFLOW_STAGES[0];
  const groups = [
    ['specification', 'Specification', ['discovery', 'scope', 'architecture', 'schemas']],
    ['implementation', 'Implementation', ['frontend', 'services']],
    ['validation', 'Validation', ['qa', 'uat', 'release']]
  ];
  const reviewer = SUPPORT_ROLES[0];

  container.innerHTML = `
    <div class="v-split-layout">
      <div class="v-left-pane">
        <button type="button" class="audit-strip ${selectedRoleId === 'reviewer' ? 'selected' : ''}" data-role-id="reviewer" onclick="selectRole('reviewer')">
          <span><span aria-hidden="true">${reviewer.icon}</span> architecture_reviewer</span>
          <span>Zero-trust audit</span>
        </button>
        <div class="v-grid">
          ${groups.map(([grp, title, ids]) => `
            <section class="phase-column ${grp}">
              <h2>${title}</h2>
              <div class="phase-cards">${ids.map(id => renderCard(ALL_ROLES.find(r => r.id === id))).join('')}</div>
            </section>
          `).join('')}
        </div>
      </div>
      <div class="v-right-pane">
        <section id="roleDetail" class="detail-panel">${renderDetailPanelContent(selected)}</section>
      </div>
    </div>
  `;
}

function renderApprovalsView() {
  const container = document.getElementById('vModelContainer');
  if (!container) return;

  const rev = projectState.pendingReview;
  if (!rev) {
    container.innerHTML = `
      <div class="approvals-container">
        <div class="approval-gate-banner approved">
          <span>✅</span>
          <div>
            <strong>All Checkpoints Approved</strong>
            <div style="font-size: 11px; font-weight: 400; margin-top: 2px;">
              No pending reviews. The swarm is advancing or execution is completed.
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="approvals-container">
      <div class="approvals-header">
        <div>
          <h2 class="approvals-title">⚡ ${escapeHtml(rev.gateName)}</h2>
          <p class="approvals-subtitle">Lead: <code>${escapeHtml(rev.role)}</code> &bull; Curated by Architecture Reviewer. Recommended standards pre-selected.</p>
        </div>
        <div class="approval-gate-banner" style="margin: 0;">
          <span>🚧</span>
          <span>Awaiting Review</span>
        </div>
      </div>

      <div class="questions-grid">
        ${(rev.decisions || []).map((d, idx) => `
          <div class="question-card">
            <div class="question-title-row">
              <h4 class="question-title">${d.id}. ${escapeHtml(d.title)}</h4>
              <span style="font-size: 10px; color: #737373; font-weight: 700;">DECISION ${idx + 1}</span>
            </div>
            <p class="question-desc">${escapeHtml(d.desc)}</p>
            <div class="options-group">
              <div class="option-label selected">
                <span style="font-weight: 700; color: #2563eb; font-size: 13px;">[A]</span>
                <div class="option-text-group">
                  <div class="option-header-row">
                    <span class="option-name">${escapeHtml(d.recommended.name)}</span>
                    <span class="recommended-badge">⭐️ Recommended Standard</span>
                  </div>
                  <span class="option-explanation">${escapeHtml(d.recommended.desc)}</span>
                </div>
              </div>
              ${d.alternative ? `
                <div class="option-label" style="opacity: 0.85;">
                  <span style="font-weight: 700; color: #737373; font-size: 13px;">[B]</span>
                  <div class="option-text-group">
                    <div class="option-header-row">
                      <span class="option-name">${escapeHtml(d.alternative.name)}</span>
                      <span style="font-size: 9px; color: #737373; font-weight: 700; text-transform: uppercase;">Alternative</span>
                    </div>
                    <span class="option-explanation">${escapeHtml(d.alternative.desc)}</span>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}

        ${rev.perks && rev.perks.length > 0 ? `
          <div class="perks-card">
            <div class="perks-header">
              <span>✨</span>
              <span>Cool Out-of-the-Box Perks (Optional Add-ons)</span>
            </div>
            <p class="perks-sub">Reply in chat to add any of these perks (e.g. <code>add P1</code>):</p>
            <div class="perks-grid">
              ${rev.perks.map(p => `
                <div class="perk-label">
                  <span style="font-weight: 700; color: #7c3aed; font-size: 11px;">[${escapeHtml(p.id)}]</span>
                  <div>
                    <div class="perk-title">${escapeHtml(p.name)}</div>
                    <div class="perk-desc">${escapeHtml(p.desc)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Action Guidance Callout -->
      <div class="approval-done-banner" style="display: flex;">
        <div>
          <span>👉 <strong>To Approve:</strong> Return to chat and type <code>approved</code>.</span><br/>
          <span style="font-weight: 400; color: #047857; font-size: 11px;">To change any option: Reply e.g. <code>D1: B, add P1</code> or free text in chat.</span>
        </div>
        <button type="button" class="copy-pill-btn" onclick="copyApprovedText()">📋 Copy "approved"</button>
      </div>
    </div>
  `;
}

function copyApprovedText() {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText('approved').then(() => alert('Copied "approved" to clipboard!'));
  } else {
    prompt('Copy to clipboard:', 'approved');
  }
}

function initVisualizer() {
  const nameEl = document.getElementById('projectName');
  if (nameEl) nameEl.textContent = projectState.projectName;
  const pctEl = document.getElementById('progressPercent');
  if (pctEl) pctEl.textContent = projectState.completionPercent + '%';
  const fillEl = document.getElementById('progressFill');
  if (fillEl) fillEl.style.width = projectState.completionPercent + '%';

  const badgeEl = document.getElementById('pendingApprovalsBadge');
  if (badgeEl) {
    if (projectState.pendingReview) {
      badgeEl.textContent = '1 Pending';
      badgeEl.style.background = '#ea580c';
    } else {
      badgeEl.textContent = '✓ Ready';
      badgeEl.style.background = '#16a34a';
    }
  }

  switchAutonomyMode(projectState.autonomyMode);
  renderVModelView();
}

document.addEventListener('DOMContentLoaded', initVisualizer);
