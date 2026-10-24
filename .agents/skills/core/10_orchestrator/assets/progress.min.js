// Interactive V-Model, IT Consultant Discovery Questionnaire & Gate Review Studio
// Reads live project state from window.PM_DATA (docs/progress-data.js) and saved discovery answers (docs/00_DISCOVERY_ANSWERS.json)

const WORKFLOW_STAGES = [
  {
    id: 'discovery',
    phase: 1,
    role: 'IT Consultant',
    skill: 'it_consultant',
    group: 'specification',
    icon: '💼',
    title: 'Discovery, Ideation & Contract',
    description: 'Deep interactive IT Consultant questionnaire, AI feature recommendations, UX ideation, and capability contract.',
    artifacts: [
      { name: '00_DISCOVERY_ANSWERS.json', path: '00_DISCOVERY_ANSWERS.json', desc: 'Saved interactive questionnaire answers' },
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
    description: 'Draft-07 JSON schemas, TypeScript runtime contracts, and mock fixtures in src/assets/schemas/.',
    artifacts: [
      { name: 'src/assets/schemas/', path: '../src/assets/schemas/', desc: 'Schemas & mock fixtures' }
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
    description: 'Visual screen mockups, design register, and Apple HIG / Material / Web components.',
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
    description: 'Local-first DB adapter, hooks, domain services, and security guard implementations.',
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
    title: 'QA & Playwright Runtime Gate',
    description: 'Automated test suite (≥80% coverage), Playwright WebKit headless render verification, and 100% mockup fidelity.',
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
    description: 'Stakeholder acceptance testing in live browser and native Expo Go preview.',
    artifacts: [
      { name: '10_UAT_CHECKLIST.md', path: '10_UAT_CHECKLIST.md', desc: 'Target UAT checklist & sign-off' }
    ]
  },
  {
    id: 'release',
    phase: 9,
    role: 'Deployment Lead',
    skill: 'deployment',
    group: 'validation',
    icon: '🚀',
    title: 'Production Release (Gate 4)',
    description: 'Cloud deployment to Vercel/EAS, or verified user-managed handoff.',
    artifacts: [
      { name: '09_DEPLOYMENT_MANIFEST.md', path: '09_DEPLOYMENT_MANIFEST.md', desc: 'Production release manifest' }
    ]
  }
];

const SUPPORT_ROLES = [
  { id: 'reviewer', role: 'Architecture Reviewer', skill: 'architecture_reviewer', icon: '🔍', title: 'Zero-trust architecture audit', description: 'Cross-phase zero-trust auditor.' }
];

const ALL_ROLES = [...WORKFLOW_STAGES, ...SUPPORT_ROLES];

const pmData = window.PM_DATA || {};
let projectState = {
  projectName: pmData.projectName || 'PM Skills SDLC',
  autonomyMode: pmData.autonomyMode || 'supervised',
  activeStageId: pmData.activeStageId || 'discovery',
  completedStageIds: pmData.completedStageIds || [],
  completionPercent: pmData.completionPercent || 10,
  consultantDiscovery: pmData.consultantDiscovery || null,
  pendingReview: pmData.pendingReview || null,
  userStories: pmData.userStories || [],
  qaSummary: pmData.qaSummary || null
};

let currentView = projectState.activeStageId === 'discovery' && projectState.consultantDiscovery ? 'discovery' : 'vmodel';
let selectedRoleId = projectState.activeStageId || 'discovery';
let currentAutonomyMode = projectState.autonomyMode;

// Interactive Discovery Form State
let discoveryFormState = {
  round: (projectState.consultantDiscovery && projectState.consultantDiscovery.round) || 1,
  selectedFeatures: {},
  customFeaturesText: '',
  answers: {},
  questionNotes: {},
  additionalDetails: '',
  consultantQuestions: '',
  lastSavedAt: null,
  lastAction: null
};

// Initialize defaults from consultantDiscovery
function initDiscoveryFormDefaults() {
  const cd = projectState.consultantDiscovery;
  if (!cd) return;

  (cd.suggestedFeatures || []).forEach(f => {
    if (discoveryFormState.selectedFeatures[f.id] === undefined) {
      discoveryFormState.selectedFeatures[f.id] = f.recommended !== false;
    }
  });

  (cd.questions || []).forEach(q => {
    if (discoveryFormState.answers[q.id] === undefined) {
      if (q.type === 'multi') {
        const recOpts = (q.options || []).filter(o => o.recommended).map(o => o.code);
        discoveryFormState.answers[q.id] = recOpts.length > 0 ? recOpts : [(q.options && q.options[0] && q.options[0].code) || 'A'];
      } else {
        const recOpt = (q.options || []).find(o => o.recommended) || (q.options && q.options[0]);
        discoveryFormState.answers[q.id] = recOpt ? recOpt.code : 'A';
      }
    }
    if (discoveryFormState.questionNotes[q.id] === undefined) {
      discoveryFormState.questionNotes[q.id] = '';
    }
  });

  // Hydrate from window.PM_DISCOVERY_SAVED or localStorage if available
  const savedGlobal = window.PM_DISCOVERY_SAVED || (cd && cd.savedAnswers) || null;
  if (savedGlobal && savedGlobal.saved) {
    applyHydratedDiscovery(savedGlobal);
  } else {
    try {
      const localRaw = localStorage.getItem('PM_DISCOVERY_DRAFT_' + projectState.projectName);
      if (localRaw) {
        applyHydratedDiscovery(JSON.parse(localRaw));
      }
    } catch (e) {}
  }

  // Also fetch latest from /api/discovery-answers if served via dashboard-server.js
  fetch('/api/discovery-answers')
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (data && data.saved) {
        applyHydratedDiscovery(data);
        updateDiscoveryBadge();
        if (currentView === 'discovery') renderDiscoveryView();
      }
    })
    .catch(() => {});
}

function applyHydratedDiscovery(data) {
  if (!data) return;
  if (data.selectedFeatures) Object.assign(discoveryFormState.selectedFeatures, data.selectedFeatures);
  if (typeof data.customFeaturesText === 'string') discoveryFormState.customFeaturesText = data.customFeaturesText;
  if (data.answers) Object.assign(discoveryFormState.answers, data.answers);
  if (data.questionNotes) Object.assign(discoveryFormState.questionNotes, data.questionNotes);
  if (typeof data.additionalDetails === 'string') discoveryFormState.additionalDetails = data.additionalDetails;
  if (typeof data.consultantQuestions === 'string') discoveryFormState.consultantQuestions = data.consultantQuestions;
  if (data.savedAt) discoveryFormState.lastSavedAt = data.savedAt;
  if (data.action) discoveryFormState.lastAction = data.action;
}

function persistLocalDraft() {
  try {
    localStorage.setItem('PM_DISCOVERY_DRAFT_' + projectState.projectName, JSON.stringify(discoveryFormState));
  } catch (e) {}
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function isGateActive(stageId, mode) {
  if (mode === 'supervised') return true;
  if (mode === 'balanced') return ['discovery', 'scope', 'frontend', 'services', 'uat', 'release'].includes(stageId);
  return ['frontend', 'services', 'uat', 'release'].includes(stageId);
}

function switchView(view) {
  currentView = view;
  const vTab = document.getElementById('viewTabVmodel');
  const dTab = document.getElementById('viewTabDiscovery');
  const aTab = document.getElementById('viewTabApprovals');
  if (vTab) vTab.classList.toggle('active', view === 'vmodel');
  if (dTab) dTab.classList.toggle('active', view === 'discovery');
  if (aTab) aTab.classList.toggle('active', view === 'approvals');
  if (view === 'vmodel') renderVModelView();
  else if (view === 'discovery') renderDiscoveryView();
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

  let extraSectionHtml = '';
  if (selected.id === 'discovery') {
    extraSectionHtml = `
      <div style="margin-top: 14px; padding: 14px; border-radius: 10px; background: #eff6ff; border: 1px solid #bfdbfe;">
        <div style="font-size: 12px; font-weight: 700; color: #1e40af; margin-bottom: 6px;">💼 Interactive IT Consultant Questionnaire</div>
        <p style="margin: 0 0 10px; font-size: 11px; color: #334155; line-height: 1.5;">
          Review platform feasibility, toggle AI-recommended features, answer the deep discovery questionnaire, add custom notes, or go back and edit your answers at any time.
        </p>
        <button type="button" onclick="switchView('discovery')" style="border: none; background: #2563eb; color: #ffffff; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px; cursor: pointer;">
          Open / Edit Discovery Questionnaire &rarr;
        </button>
      </div>
    `;
  } else if (selected.id === 'scope' && projectState.userStories.length > 0) {
    extraSectionHtml = `
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
    ${extraSectionHtml}
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

// Interactive Discovery Questionnaire Handlers
window.toggleFeatureCheck = function(featureId) {
  discoveryFormState.selectedFeatures[featureId] = !discoveryFormState.selectedFeatures[featureId];
  persistLocalDraft();
  renderDiscoveryView();
};

window.selectSingleAnswer = function(questionId, optionCode) {
  discoveryFormState.answers[questionId] = optionCode;
  persistLocalDraft();
  renderDiscoveryView();
};

window.toggleMultiAnswer = function(questionId, optionCode) {
  const cur = Array.isArray(discoveryFormState.answers[questionId])
    ? [...discoveryFormState.answers[questionId]]
    : [];
  const idx = cur.indexOf(optionCode);
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(optionCode);
  discoveryFormState.answers[questionId] = cur;
  persistLocalDraft();
  renderDiscoveryView();
};

window.updateQuestionNote = function(questionId, val) {
  discoveryFormState.questionNotes[questionId] = val;
  persistLocalDraft();
};

window.updateCustomFeaturesText = function(val) {
  discoveryFormState.customFeaturesText = val;
  persistLocalDraft();
};

window.updateAdditionalDetails = function(val) {
  discoveryFormState.additionalDetails = val;
  persistLocalDraft();
};

window.updateConsultantQuestions = function(val) {
  discoveryFormState.consultantQuestions = val;
  persistLocalDraft();
};

window.saveDiscoveryQuestionnaire = async function(actionMode) {
  const cd = projectState.consultantDiscovery || {};
  const structuredSummary = (cd.questions || []).map(q => {
    const ans = discoveryFormState.answers[q.id];
    const selectedOpts = (q.options || []).filter(o =>
      Array.isArray(ans) ? ans.includes(o.code) : ans === o.code
    );
    return {
      questionId: q.id,
      dimension: q.dimension || 'General',
      question: q.title,
      selectedCodes: ans,
      selectedLabels: selectedOpts.map(o => o.name),
      customNote: discoveryFormState.questionNotes[q.id] || ''
    };
  });

  const chosenFeatures = (cd.suggestedFeatures || [])
    .filter(f => discoveryFormState.selectedFeatures[f.id])
    .map(f => ({ id: f.id, name: f.name, category: f.category }));

  const payload = {
    projectName: projectState.projectName,
    round: discoveryFormState.round,
    action: actionMode, // 'proceed' | 'refine'
    status: actionMode === 'refine' ? 'NEEDS_FOLLOWUP_CONSULTATION' : 'READY_FOR_CONTRACT',
    selectedFeatures: discoveryFormState.selectedFeatures,
    chosenFeaturesList: chosenFeatures,
    customFeaturesText: discoveryFormState.customFeaturesText,
    answers: discoveryFormState.answers,
    questionNotes: discoveryFormState.questionNotes,
    structuredSummary,
    additionalDetails: discoveryFormState.additionalDetails,
    consultantQuestions: discoveryFormState.consultantQuestions
  };

  let savedToServer = false;
  try {
    const res = await fetch('/api/save-discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const json = await res.json();
      discoveryFormState.lastSavedAt = json.savedAt || new Date().toISOString();
      discoveryFormState.lastAction = actionMode;
      window.PM_DISCOVERY_SAVED = { saved: true, savedAt: discoveryFormState.lastSavedAt, ...payload };
      savedToServer = true;
    }
  } catch (err) {
    savedToServer = false;
  }

  if (!savedToServer) {
    discoveryFormState.lastSavedAt = new Date().toISOString();
    discoveryFormState.lastAction = actionMode;
    // Fallback download of 00_DISCOVERY_ANSWERS.json if opened via file://
    const blob = new Blob([JSON.stringify({ saved: true, savedAt: discoveryFormState.lastSavedAt, ...payload }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '00_DISCOVERY_ANSWERS.json';
    a.click();
  }

  persistLocalDraft();
  updateDiscoveryBadge();
  renderDiscoveryView();

  const replyWord = actionMode === 'refine' ? 'refine' : 'submitted';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(replyWord).catch(() => {});
  }
  const toast = document.getElementById('discoverySaveToast');
  if (toast) {
    toast.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

function updateDiscoveryBadge() {
  const badge = document.getElementById('discoveryStatusBadge');
  if (!badge) return;
  if (discoveryFormState.lastSavedAt) {
    badge.textContent = discoveryFormState.lastAction === 'refine' ? '💬 Follow-Up Saved' : '✓ Saved';
    badge.style.background = discoveryFormState.lastAction === 'refine' ? '#2563eb' : '#16a34a';
  } else {
    const qCount = (projectState.consultantDiscovery && projectState.consultantDiscovery.questions && projectState.consultantDiscovery.questions.length) || 0;
    badge.textContent = qCount > 0 ? qCount + ' Questions' : 'Interactive';
    badge.style.background = '#2563eb';
  }
}

function renderDiscoveryView() {
  const container = document.getElementById('vModelContainer');
  if (!container) return;

  const cd = projectState.consultantDiscovery;
  if (!cd) {
    container.innerHTML = `
      <div class="approvals-container">
        <div class="approvals-header">
          <div>
            <h2 class="approvals-title">💼 IT Consultant Discovery Questionnaire</h2>
            <p class="approvals-subtitle">No discovery questionnaire data found in <code>window.PM_DATA.consultantDiscovery</code>.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const questions = cd.questions || [];
  const features = cd.suggestedFeatures || [];
  const brief = cd.advisoryBrief || {};
  const selectedFeatureCount = features.filter(f => discoveryFormState.selectedFeatures[f.id]).length;

  container.innerHTML = `
    <div class="approvals-container">
      <!-- Top Header -->
      <div class="approvals-header">
        <div>
          <h2 class="approvals-title">💼 ${escapeHtml(cd.title || 'Principal IT Consultant — Deep Discovery & Product Ideation Questionnaire')}</h2>
          <p class="approvals-subtitle">${escapeHtml(cd.subtitle || 'Review what is possible on your target platform, select the features you want, answer the detailed discovery questions below, or ask the IT Consultant follow-up questions before locking the contract.')}</p>
        </div>
        <div class="approval-gate-banner ${discoveryFormState.lastSavedAt ? 'approved' : ''}">
          <span>${discoveryFormState.lastSavedAt ? '✓ Saved to docs/00_DISCOVERY_ANSWERS.json' : 'Round ' + (cd.round || 1) + ' • ' + questions.length + ' Deep Questions'}</span>
        </div>
      </div>

      <!-- Save Toast Feedback Banner -->
      <div id="discoverySaveToast" class="save-toast-banner ${discoveryFormState.lastSavedAt ? 'visible' : ''} ${discoveryFormState.lastAction === 'refine' ? 'refine' : 'success'}">
        <div>
          <div style="font-size: 13px; font-weight: 800;">
            ${discoveryFormState.lastAction === 'refine'
              ? '💬 Saved Follow-Up Request & Answers to docs/00_DISCOVERY_ANSWERS.json!'
              : '✅ Saved All Questionnaire Answers to docs/00_DISCOVERY_ANSWERS.json!'}
          </div>
          <div style="font-size: 11px; margin-top: 3px; font-weight: 500;">
            ${discoveryFormState.lastAction === 'refine'
              ? 'Now reply "refine" in chat — the IT Consultant will read your saved answers & questions, respond in detail, and update this questionnaire.'
              : 'Now reply "submitted" (or "approved") in chat — the workflow will read docs/00_DISCOVERY_ANSWERS.json and generate 00_PROJECT_CONTRACT.md & 01_ARCH_BRIEF.md. You can come back to this tab anytime to edit and re-save!'}
          </div>
        </div>
        <button type="button" class="copy-pill-btn" onclick="navigator.clipboard.writeText('${discoveryFormState.lastAction === 'refine' ? 'refine' : 'submitted'}')">
          Copy "${discoveryFormState.lastAction === 'refine' ? 'refine' : 'submitted'}"
        </button>
      </div>

      <!-- Consultant Follow-Up Answers (if Round 2+) -->
      ${brief.followUpAnswers && brief.followUpAnswers.length > 0 ? `
        <div class="consultant-followup-box">
          <h3 class="consultant-followup-title">💡 IT Consultant Responses to Your Previous Questions &amp; Refinements</h3>
          <div style="display: grid; gap: 10px;">
            ${brief.followUpAnswers.map(fa => `
              <div style="background: #ffffff; border: 1px solid #dbeafe; border-radius: 8px; padding: 12px;">
                <div style="font-size: 12px; font-weight: 700; color: #1e3a8a; margin-bottom: 4px;">Q: ${escapeHtml(fa.question)}</div>
                <div style="font-size: 12px; color: #1e293b; line-height: 1.5;">${escapeHtml(fa.answer)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Section 1: Consultant Advisory Brief (What is Possible + Recommended UX) -->
      <div class="consultant-brief-grid">
        ${brief.platformCapabilities && brief.platformCapabilities.length > 0 ? `
          <div class="consultant-brief-card">
            <h3>🔬 What Is Technically Possible (${escapeHtml(cd.platform || 'Platform')} Feasibility)</h3>
            <ul>
              ${brief.platformCapabilities.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${brief.recommendedUxVision && brief.recommendedUxVision.length > 0 ? `
          <div class="consultant-brief-card">
            <h3>✨ Recommended Best-in-Class User Experience</h3>
            <ul>
              ${brief.recommendedUxVision.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${brief.architecturalGuardrails && brief.architecturalGuardrails.length > 0 ? `
          <div class="consultant-brief-card">
            <h3>🛡️ Key Technical &amp; UX Guardrails</h3>
            <ul>
              ${brief.architecturalGuardrails.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <!-- Section 2: AI-Suggested Feature & Capability Catalog -->
      ${features.length > 0 ? `
        <div class="question-card" style="background: #fafafa;">
          <div class="question-title-row">
            <h3 class="question-title">🚀 Step 1: Select Features to Include (${selectedFeatureCount} of ${features.length} Selected)</h3>
            <span class="question-dim-pill">AI Consultant Feature Catalog</span>
          </div>
          <p class="question-desc">Based on your project description and domain best practices, the IT Consultant recommends the following capabilities. Check or uncheck any feature below:</p>
          <div class="features-catalog-grid">
            ${features.map(f => {
              const isChecked = Boolean(discoveryFormState.selectedFeatures[f.id]);
              return `
                <label class="feature-check-card ${isChecked ? 'checked' : ''}">
                  <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleFeatureCheck('${escapeHtml(f.id)}')" />
                  <div class="option-text-group">
                    <div class="option-header-row">
                      <span class="option-name">${escapeHtml(f.name)}</span>
                      <span class="feature-cat-pill">${escapeHtml(f.category || 'Feature')}</span>
                    </div>
                    <span class="option-explanation">${escapeHtml(f.desc)}</span>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
          <div style="margin-top: 6px;">
            <input
              type="text"
              class="question-custom-input"
              placeholder="➕ Want additional features not listed above? Type them here (e.g., 3D dollhouse preview, PDF contractor report, voice notes on walls)..."
              value="${escapeHtml(discoveryFormState.customFeaturesText)}"
              oninput="updateCustomFeaturesText(this.value)"
            />
          </div>
        </div>
      ` : ''}

      <!-- Section 3: Thorough Multi-Dimensional Discovery Questions (8-12 Questions) -->
      <div class="questions-grid">
        ${questions.map((q, idx) => {
          const isMulti = q.type === 'multi';
          const currentAns = discoveryFormState.answers[q.id];
          const noteVal = discoveryFormState.questionNotes[q.id] || '';
          return `
            <div class="question-card" id="qcard_${escapeHtml(q.id)}">
              <div class="question-title-row">
                <h4 class="question-title">Q${idx + 1}. ${escapeHtml(q.title)}</h4>
                <span class="question-dim-pill">${escapeHtml(q.dimension || (isMulti ? 'Multi-Select' : 'Single Choice'))}</span>
              </div>
              <p class="question-desc">${escapeHtml(q.desc)}</p>
              <div class="options-group">
                ${(q.options || []).map(opt => {
                  const isSelected = isMulti
                    ? Array.isArray(currentAns) && currentAns.includes(opt.code)
                    : currentAns === opt.code;
                  const handler = isMulti
                    ? `toggleMultiAnswer('${escapeHtml(q.id)}', '${escapeHtml(opt.code)}')`
                    : `selectSingleAnswer('${escapeHtml(q.id)}', '${escapeHtml(opt.code)}')`;
                  return `
                    <label class="option-label ${isSelected ? 'selected' : ''}">
                      <input
                        type="${isMulti ? 'checkbox' : 'radio'}"
                        name="q_${escapeHtml(q.id)}"
                        ${isSelected ? 'checked' : ''}
                        onchange="${handler}"
                      />
                      <div class="option-text-group">
                        <div class="option-header-row">
                          <span class="option-name">[${escapeHtml(opt.code)}] ${escapeHtml(opt.name)}</span>
                          ${opt.recommended ? '<span class="recommended-badge">★ Recommended</span>' : ''}
                        </div>
                        <span class="option-explanation">${escapeHtml(opt.desc)}</span>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
              <div>
                <input
                  type="text"
                  class="question-custom-input"
                  placeholder="✍️ Add specific details, custom behavior, or nuances for Q${idx + 1} (optional)..."
                  value="${escapeHtml(noteVal)}"
                  oninput="updateQuestionNote('${escapeHtml(q.id)}', this.value)"
                />
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Section 4: Open-Ended Elaboration & Questions for the IT Consultant -->
      <div class="question-card" style="background: #f8fafc; border-color: #cbd5e1;">
        <div class="question-title-row">
          <h4 class="question-title">📝 Additional Project Requirements, Edge Cases &amp; Questions for the IT Consultant</h4>
          <span class="question-dim-pill">Open-Ended Consultation</span>
        </div>
        <p class="question-desc">
          Want to describe specific workflows in your own words, add extra requirements, or ask the IT Consultant what else is possible before locking the contract? Enter them below:
        </p>
        <div style="display: grid; gap: 12px;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">1. Additional Requirements, Custom Workflows, or Special Rules (Optional):</div>
            <textarea
              class="consultant-textarea"
              placeholder="Describe any additional details, user flows, edge cases, or design preferences you want included in the project..."
              oninput="updateAdditionalDetails(this.value)"
            >${escapeHtml(discoveryFormState.additionalDetails)}</textarea>
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">2. Questions for the IT Consultant (If you want the Consultant to advise &amp; refine before proceeding):</div>
            <textarea
              class="consultant-textarea"
              placeholder="Ask the IT Consultant anything (e.g., 'Can we also scan ceiling height?', 'How accurate is LiDAR vs camera?', 'What export formats work best for contractors?')..."
              oninput="updateConsultantQuestions(this.value)"
            >${escapeHtml(discoveryFormState.consultantQuestions)}</textarea>
          </div>
        </div>
      </div>

      <!-- Sticky Save & Submit Bar -->
      <div class="consultant-submit-bar">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a;">
            Ready to save your Discovery Questionnaire?
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">
            Saves directly to <code>docs/00_DISCOVERY_ANSWERS.json</code> so the AI workflow can read all your answers and you can come back to edit anytime.
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn-secondary-refine" onclick="saveDiscoveryQuestionnaire('refine')" id="btnSaveAndRefine">
            💬 Save &amp; Ask Consultant Follow-Up / Refine
          </button>
          <button type="button" class="btn-primary-save" onclick="saveDiscoveryQuestionnaire('proceed')" id="btnSaveAndProceed">
            💾 Save Answers &amp; Proceed to Contract &rarr;
          </button>
        </div>
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
          <span>All Checkpoints Approved &bull; Ready to proceed</span>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="approvals-container">
      <div class="approvals-header">
        <div>
          <h2 class="approvals-title">${escapeHtml(rev.gateName)}</h2>
          <p class="approvals-subtitle">${escapeHtml(rev.subtitle || '')}</p>
        </div>
        <div class="approval-gate-banner">
          <span>Awaiting Review</span>
        </div>
      </div>

      ${rev.mockups && rev.mockups.length > 0 ? `
        <div class="mockups-preview-section">
          <h3 class="mockups-section-title">Design Mockups for Approval (${rev.mockups.length})</h3>
          <div class="mockups-scroll-row">
            ${rev.mockups.map(m => `
              <div class="mockup-frame-card">
                <div class="mockup-card-header">
                  <span class="mockup-card-title">${escapeHtml(m.title || m.name)}</span>
                  <a href="${escapeHtml(m.path)}" target="_blank" style="font-size: 11px; color: #2563eb; text-decoration: none; font-weight: 500;">Open full screen &nearr;</a>
                </div>
                <div class="mockup-iframe-wrap">
                  <iframe src="${escapeHtml(m.path)}" class="mockup-iframe" title="${escapeHtml(m.title || m.name)}"></iframe>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="questions-grid">
        ${(rev.decisions || []).map(d => `
          <div class="question-card">
            <div class="question-title-row">
              <h4 class="question-title">${escapeHtml(d.title)}</h4>
            </div>
            <p class="question-desc">${escapeHtml(d.desc)}</p>
            <div class="options-group">
              <div class="option-label selected">
                <div class="option-text-group">
                  <div class="option-header-row">
                    <span class="option-name">${escapeHtml(d.recommended.name)}</span>
                    <span class="recommended-badge">Recommended</span>
                  </div>
                  <span class="option-explanation">${escapeHtml(d.recommended.desc)}</span>
                </div>
              </div>
              ${d.alternative ? `
                <div class="option-label">
                  <div class="option-text-group">
                    <div class="option-header-row">
                      <span class="option-name" style="color: #4b5563;">${escapeHtml(d.alternative.name)}</span>
                    </div>
                    <span class="option-explanation">${escapeHtml(d.alternative.desc)}</span>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Action Guidance Callout -->
      <div class="approval-done-banner">
        <div>
          <span style="font-weight: 600; color: #111827;">To proceed, reply in chat with: <code>approved</code></span>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Need to review or edit your Phase 1 Discovery Questionnaire answers? Click the <strong>💼 IT Consultant Questionnaire</strong> tab above anytime!</div>
        </div>
        <button type="button" class="copy-pill-btn" onclick="copyApprovedText()">Copy "approved"</button>
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
  initDiscoveryFormDefaults();

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

  updateDiscoveryBadge();
  switchAutonomyMode(projectState.autonomyMode);
  switchView(currentView);
}

document.addEventListener('DOMContentLoaded', initVisualizer);
