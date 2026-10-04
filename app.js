// Workflow visualizer. Mirrors the canonical registry in GLOBAL_RULES.md.
// Only phases have numbers; release and supporting roles are not extra phases.
const WORKFLOW_STAGES = [
  { id: 'discovery', phase: 1, role: 'IT Consultant', skill: 'it_consultant', path: 'it_consultant/SKILL.md', group: 'specification', icon: '💼', title: 'Discovery & Contract', description: 'Record confirmed capabilities, assumptions, and open questions before architecture decisions. Document 00 belongs to Phase 1.', artifacts: ['docs/00_PROJECT_CONTRACT.md', 'docs/01_ARCH_BRIEF.md'], checkpoint: 'Review capabilities and architecture.' },
  { id: 'scope', phase: 2, role: 'Product Owner', skill: 'product_owner', path: 'product_owner/SKILL.md', group: 'specification', icon: '🎯', title: 'Scope', description: 'Confirm users, workflows, constraints, and uncertain capabilities. Map each AC to acceptance scenarios and define measurable NFR targets.', artifacts: ['docs/02_PRD.md', 'docs/03_USER_STORIES.md'], checkpoint: 'Gate 1 — Scope approval in BALANCED and SUPERVISED.' },
  { id: 'architecture', phase: 3, role: 'Technical Architect', skill: 'technical_architect', path: 'techincal_architect/SKILL.md', group: 'specification', icon: '📐', title: 'Technical Specification', description: 'Map architecture and API boundaries to integration checks and NFR evidence. Schedule Phase 5 → 6 → 7 tasks per feature.', artifacts: ['docs/04_TECHNICAL_SPEC.md', 'docs/05_TASK_MANIFEST.md'], checkpoint: 'Architecture Reviewer checks technical deliverables.' },
  { id: 'schemas', phase: 4, role: 'Content Parser', skill: 'content_parser', path: 'content_parser/SKILL.md', group: 'specification', icon: '📄', title: 'Schemas', description: 'Generate applicable schemas and contracts; map boundaries and rejected inputs to unit/contract checks.', artifacts: ['src/assets/schemas/'], checkpoint: 'Mark schema work N/A when persistence is not required.' },
  { id: 'frontend', phase: 5, role: 'Frontend Developer', skill: 'frontend_developer', path: 'frontend_developer/SKILL.md', group: 'implementation', icon: '💻', title: 'UI/UX', description: 'For the active feature, implement approved UI and run component checks. Continue to services and QA; repeat for the next feature. Apple Design supports this phase.', artifacts: ['docs/06_DESIGN_REGISTER.md', 'docs/design/mockups/', 'src/components/'], checkpoint: 'Gate 2 — Mockup approval before UI code, in every mode.' },
  { id: 'services', phase: 6, role: 'Service Engineer', skill: 'service_engineer', path: 'service_engineer/SKILL.md', group: 'implementation', icon: '⚙️', title: 'Database Setup & Services', description: 'Integrate the active feature and run unit/integration checks. Reuse verified database setup; preserve any mock-only qualification.', artifacts: ['docs/08_SETUP_REGISTER.md', 'src/services/', 'src/hooks/', 'src/db/', 'src/sync/'], checkpoint: 'Database setup/skip at phase entry, in every mode.' },
  { id: 'qa', phase: 7, role: 'QA Agent', skill: 'qa_agent', path: 'qa_agent/SKILL.md', group: 'validation', icon: '🧪', title: 'QA', description: 'Verify AC/NFR results and developer evidence. Slice QA returns to the next feature; aggregate regression QA across all slices hands off to UAT. Coverage alone is insufficient.', artifacts: ['tests/07_TEST_MANIFEST.md'], checkpoint: 'Preserve any mock-only qualification; QA is not release authorization.' },
  { id: 'uat', phase: 8, role: 'UAT Coordinator', skill: 'uat', path: 'uat/SKILL.md', group: 'validation', icon: '⚡', title: 'UAT', description: 'Validate acceptance scenarios on the target platform: compatible web preview or native build/device. Record revision, environment, results, and limitations; preserve mock-only scope.', artifacts: ['docs/10_UAT_CHECKLIST.md', 'open_stackblitz.html', 'redirect_stackblitz.html', 'UAT_FEEDBACK.md'], checkpoint: 'Gate 3 — UAT sign-off in every mode. Feedback file is created only when revisions are requested.' },
  { id: 'release', phase: null, role: 'Deployment Lead', skill: 'deployment', path: 'deployment/SKILL.md', group: 'validation', icon: '🚀', title: 'Release', description: 'After UAT sign-off, choose a provider or skip deployment. Prepare and verify the selected release, or record the user-managed handoff.', artifacts: ['docs/08_SETUP_REGISTER.md', 'docs/09_RELEASE_PLAN.md'], checkpoint: 'Deployment selection/skip, then Gate 4 — Release approval if deploying, in every mode.' }
];

const SUPPORT_ROLES = [
  { id: 'pm', role: 'PM', skill: 'pm', path: 'pm/SKILL.md', icon: '🧭', title: 'Entry & routing', description: 'Routes /pm commands to the phase lead. Uses the controller document and canonical global rules.' },
  { id: 'orchestrator', role: 'Orchestrator', skill: 'orchestrator', path: 'orchestrator/SKILL.md', icon: '🎼', title: 'State & dashboard', description: 'Maintains project state, revision invalidation, pending approvals, and the live progress dashboard.', artifacts: ['docs/PROJECT_STATUS.md', 'progress.html'] },
  { id: 'reviewer', role: 'Architecture Reviewer', skill: 'architecture_reviewer', path: 'architecture_reviewer/SKILL.md', icon: '🔍', title: 'Cross-phase audit', description: 'Reviews deliverables throughout the workflow. It is not a final numbered step.', artifacts: ['docs/reviews/'] },
  { id: 'design', role: 'Apple Design', skill: 'apple-design', path: 'apple_design/SKILL.md', icon: '🎨', title: 'Phase 5 design support', description: 'Provides design and motion standards to Frontend Developer during Phase 5.' },
  { id: 'controller', role: 'Workflow Controller', path: 'PROJECT_BUILDER_SKILL.md', icon: '👑', title: 'Controller document', description: 'Documents the existing workflow. It is not a separate skill or phase.' }
];

const ALL_ROLES = [...WORKFLOW_STAGES, ...SUPPORT_ROLES];
let selectedRoleId = 'discovery';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function selectRole(id) {
  if (!ALL_ROLES.some(role => role.id === id)) return;
  selectedRoleId = id;
  renderVModelView();
  // Preserve keyboard focus when the selected card is rerendered.
  document.querySelector('[data-role-id="' + id + '"]')?.focus({ preventScroll: true });
}

// Match the reference's three-column arrangement. The reviewer sits outside the
// sequence because it audits every phase rather than running as a final step.
const CARD_LABELS = {
  discovery: 'Scope & Architecture Brief',
  scope: 'PRD & Full-Stack User Stories',
  architecture: 'Technical Spec & Task Manifest',
  schemas: 'Data Contracts & Schemas',
  frontend: 'Feature UI & Component Tests',
  services: 'Feature Integration & Tests',
  qa: 'Slice QA & Integrated Regression',
  uat: 'Target-Platform Acceptance',
  reviewer: 'Zero-Trust Audit Gate',
  release: 'Production Cloud Release'
};

const TEST_RELATIONSHIPS = {
  discovery: 'Confirm consequential assumptions during scope clarification.',
  scope: 'Requirements / ACs ↔ acceptance tests (Phase 8)',
  architecture: 'Architecture / APIs ↔ integration tests (Phases 6–7)',
  schemas: 'Contracts ↔ unit / contract tests (Phases 5–7)',
  frontend: 'Per feature: UI → Services → QA ↺ next feature',
  services: 'Per feature: UI → Services → QA ↺ next feature',
  qa: 'All slices + integrated regression + required NFR evidence → UAT',
  uat: 'Accept the tested build and environment; web preview does not prove native behavior.'
};

function renderCard(role) {
  const active = role.id === selectedRoleId;
  const badge = role.phase || 'R';
  const badgeLabel = role.phase ? 'Phase ' + role.phase : 'Release';
  return `<button type="button" class="role-card ${active ? 'selected' : ''}" data-role-id="${role.id}" aria-pressed="${active}" aria-controls="roleDetail" onclick="selectRole('${role.id}')">
    <span class="card-heading"><span class="card-role"><span aria-hidden="true">${role.icon}</span> ${escapeHtml(role.skill)}</span><span class="badge" aria-label="${badgeLabel}" title="${badgeLabel}">${badge}</span></span>
    <span class="card-label">${CARD_LABELS[role.id]}</span>
  </button>`;
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
  const description = selected.id === 'discovery'
    ? 'it_consultant records confirmed decisions, assumptions, and open questions in the contract and architecture brief.'
    : selected.description;
  const reviewer = ALL_ROLES.find(role => role.id === 'reviewer');
  container.innerHTML = `
    <button type="button" class="audit-strip ${selectedRoleId === 'reviewer' ? 'selected' : ''}" data-role-id="reviewer" aria-pressed="${selectedRoleId === 'reviewer'}" aria-controls="roleDetail" onclick="selectRole('reviewer')">
      <span><span aria-hidden="true">${reviewer.icon}</span> architecture_reviewer</span>
      <span>Cross-phase audit · reviews every phase and release</span>
    </button>
    <div class="v-grid">${groups.map(([group, title, ids]) => `
      <section class="phase-column ${group}" aria-label="${title}">
        <h2>${title}</h2>
        <div class="phase-cards">${ids.map(id => renderCard(ALL_ROLES.find(role => role.id === id))).join('')}</div>
      </section>`).join('')}
    </div>
    <section id="roleDetail" class="detail" aria-live="polite" aria-atomic="true">
      <span class="detail-icon" aria-hidden="true">${selected.icon}</span>
      <div><h2>${selected.phase ? 'Phase ' + selected.phase : selected.id === 'release' ? 'Release' : 'Cross-phase support'}: ${escapeHtml(selected.skill || selected.role)}</h2>
      <p>${escapeHtml(description)}</p><p class="test-mapping">${escapeHtml(TEST_RELATIONSHIPS[selected.id] || selected.checkpoint || 'Audits requirements, implementation evidence, and target-platform acceptance throughout.')}</p></div>
    </section>`;
}

document.addEventListener('DOMContentLoaded', renderVModelView);
