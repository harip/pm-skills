// Data model for SDLC Swarm Skills, Interactions, and Produced Documentation
const SWARM_DATA = {
  phases: [
    {
      id: 1,
      name: "Discovery & Contract",
      agent: "pm",
      agentName: "Project Manager",
      icon: "📋",
      color: "blue",
      desc: "Discovers user intent, scopes features, and locks the project contract.",
      inputs: ["User Request / Idea", "Constraints"],
      outputs: ["Project Contract", "Workspace Initialization"],
      docsCreated: [
        { name: "PROJECT_CONTRACT.md", desc: "Locked scope, platform choice, constraints & milestones" },
        { name: "progress.html", desc: "Visual project dashboard initialized in project root" }
      ],
      downstream: ["product_owner"]
    },
    {
      id: 2,
      name: "Product Definition",
      agent: "product_owner",
      agentName: "Product Owner",
      icon: "🎯",
      color: "purple",
      desc: "Transforms project scope into functional requirements and acceptance criteria.",
      inputs: ["PROJECT_CONTRACT.md"],
      outputs: ["PRD", "User Stories", "Acceptance Criteria"],
      docsCreated: [
        { name: "PRD.md", desc: "Detailed functional requirements, constraints, and success metrics" },
        { name: "USER_STORIES.md", desc: "Actionable feature breakdown with edge cases" }
      ],
      downstream: ["techincal_architect", "apple_design"]
    },
    {
      id: 3,
      name: "Architecture & Design",
      agent: "techincal_architect",
      agentName: "Technical Architect & Apple Design",
      icon: "📐",
      color: "indigo",
      desc: "Selects technology stack, schemas, and crafts Apple HIG-compliant UI/UX specifications.",
      inputs: ["PRD.md", "USER_STORIES.md"],
      outputs: ["System Architecture", "Data Schemas", "UI Design System"],
      docsCreated: [
        { name: "ARCHITECTURE.md", desc: "Component architecture, data flows, and tech stack choices" },
        { name: "DESIGN_SPEC.md", desc: "Apple HIG typography, color palette, glassmorphism tokens" }
      ],
      downstream: ["frontend_developer", "service_engineer"]
    },
    {
      id: 4,
      name: "Implementation",
      agent: "frontend_developer",
      agentName: "Frontend & Service Engineer",
      icon: "💻",
      color: "emerald",
      desc: "Executes clean, modular application code, APIs, and client-side interactions.",
      inputs: ["ARCHITECTURE.md", "DESIGN_SPEC.md"],
      outputs: ["Application Source Code", "Local Live Server"],
      docsCreated: [
        { name: "README.md", desc: "Project overview, run scripts, and keyboard shortcuts" },
        { name: "index.html / Source", desc: "Production-ready application code" }
      ],
      downstream: ["qa_agent"]
    },
    {
      id: 5,
      name: "Quality Assurance",
      agent: "qa_agent",
      agentName: "QA Agent",
      icon: "🧪",
      color: "amber",
      desc: "Runs automated unit tests, validates edge cases, and verifies PRD compliance.",
      inputs: ["Application Code", "PRD.md"],
      outputs: ["Automated Test Suite", "QA Verification Report"],
      docsCreated: [
        { name: "TEST_PLAN.md", desc: "Test matrix, boundary values, and automated assertions" },
        { name: "QA_REPORT.md", desc: "Verification scorecard (Passing vs. Failing test cases)" }
      ],
      downstream: ["uat"]
    },
    {
      id: 6,
      name: "User Acceptance Testing",
      agent: "uat",
      agentName: "UAT Coordinator",
      icon: "⚡",
      color: "cyan",
      desc: "Deploys application to temporary StackBlitz cloud sandbox for stakeholder evaluation.",
      inputs: ["Application Code", "QA_REPORT.md", "PRD.md"],
      outputs: ["StackBlitz WebContainer", "UAT Checklist", "Stakeholder Sign-off"],
      docsCreated: [
        { name: "UAT_CHECKLIST.md", desc: "Interactive verification steps for stakeholders" },
        { name: "open_stackblitz.html", desc: "Zero-config temporary cloud container launcher" },
        { name: "UAT_FEEDBACK.md", desc: "Structured user feedback (if revisions requested)" }
      ],
      downstream: ["deployment"]
    },
    {
      id: 7,
      name: "Production Release",
      agent: "deployment",
      agentName: "Deployment Agent",
      icon: "🚀",
      color: "rose",
      desc: "Publishes final release to production hosting (Vercel, Netlify, Cloudflare).",
      inputs: ["UAT Sign-off", "Verified Code"],
      outputs: ["Live Production URL", "CI/CD Pipeline"],
      docsCreated: [
        { name: "DEPLOYMENT.md", desc: "Production release notes, domain records, and build logs" }
      ],
      downstream: []
    }
  ],

  supportingSkills: [
    {
      id: "orchestrator",
      name: "Swarm Orchestrator",
      icon: "🎼",
      desc: "Master workflow coordinator directing phase handoffs and multi-agent state.",
      docsCreated: ["TASK_LIST.md", "progress.html"]
    },
    {
      id: "architecture_reviewer",
      name: "Architecture Reviewer",
      icon: "🔍",
      desc: "Independent reviewer validating scalability, security, and component coupling.",
      docsCreated: ["ARCH_REVIEW.md"]
    },
    {
      id: "it_consultant",
      name: "IT Consultant",
      icon: "💼",
      desc: "Recommends third-party tooling, APIs, database architectures, and services.",
      docsCreated: ["VENDOR_EVALUATION.md"]
    },
    {
      id: "content_parser",
      name: "Content Parser",
      icon: "📄",
      desc: "Ingests raw briefs, PDFs, API specs, and transforms them into clean prompts.",
      docsCreated: ["EXTRACTED_SPECS.md"]
    }
  ]
};

// UI State
let activeSkillId = 1;
let currentView = 'flow'; // 'flow', 'docs', 'dashboard'

function initUI() {
  renderFlowGraph();
  renderSkillInspector(SWARM_DATA.phases[0]);
  renderDocsMatrix();
  renderDashboardPreview();
}

function switchView(viewName) {
  currentView = viewName;
  document.getElementById('viewFlow').classList.toggle('hidden', viewName !== 'flow');
  document.getElementById('viewDocs').classList.toggle('hidden', viewName !== 'docs');
  document.getElementById('viewDashboard').classList.toggle('hidden', viewName !== 'dashboard');

  ['btnTabFlow', 'btnTabDocs', 'btnTabDash'].forEach(id => {
    document.getElementById(id).className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all text-neutral-400 hover:text-white';
  });

  const activeBtn = viewName === 'flow' ? 'btnTabFlow' : viewName === 'docs' ? 'btnTabDocs' : 'btnTabDash';
  document.getElementById(activeBtn).className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all bg-neutral-800 text-white shadow';
}

function renderFlowGraph() {
  const container = document.getElementById('flowContainer');
  container.innerHTML = '';

  SWARM_DATA.phases.forEach((phase, idx) => {
    const isSelected = activeSkillId === phase.id;
    const card = document.createElement('div');
    card.className = `p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
      isSelected 
        ? 'bg-neutral-800/90 border-blue-500 shadow-xl ring-2 ring-blue-500/30' 
        : 'bg-neutral-900/70 hover:bg-neutral-800/60 border-neutral-800'
    }`;
    card.onclick = () => selectSkill(phase.id);

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xl">${phase.icon}</span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-950/70 border border-neutral-800 text-neutral-400">Phase ${phase.id}</span>
        </div>
        <h4 class="text-sm font-bold text-white tracking-tight">${phase.name}</h4>
        <p class="text-xs text-neutral-400 mt-1 line-clamp-2">${phase.agentName}</p>
      </div>
      
      <div class="mt-3 pt-2.5 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500">
        <span>${phase.docsCreated.length} docs created</span>
        <span class="text-blue-400 font-medium">Inspect →</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function selectSkill(phaseId) {
  activeSkillId = phaseId;
  const phase = SWARM_DATA.phases.find(p => p.id === phaseId);
  renderFlowGraph();
  renderSkillInspector(phase);
}

function renderSkillInspector(phase) {
  const inspector = document.getElementById('inspectorPanel');
  if (!phase) return;

  let docsHtml = phase.docsCreated.map(doc => `
    <div class="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between">
      <div class="min-w-0 pr-2">
        <span class="font-mono text-xs text-blue-400 font-semibold truncate block">📄 ${doc.name}</span>
        <span class="text-[11px] text-neutral-400 truncate block mt-0.5">${doc.desc}</span>
      </div>
      <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-mono shrink-0">Artifact</span>
    </div>
  `).join('');

  inspector.innerHTML = `
    <div class="flex items-center justify-between pb-3 border-b border-neutral-800">
      <div class="flex items-center gap-2.5">
        <span class="text-2xl">${phase.icon}</span>
        <div>
          <h3 class="text-base font-bold text-white">${phase.agentName}</h3>
          <span class="text-xs text-neutral-400">Phase ${phase.id}: ${phase.name}</span>
        </div>
      </div>
      <span class="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-mono">.agents/skills/${phase.agent}</span>
    </div>

    <div class="mt-3 space-y-3 text-xs">
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Role & Directive</label>
        <p class="text-neutral-300 mt-1 leading-relaxed">${phase.desc}</p>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1">
        <div class="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800">
          <label class="text-[10px] uppercase font-semibold text-neutral-500">Inputs Required</label>
          <ul class="mt-1 space-y-0.5 text-neutral-300 text-[11px]">
            ${phase.inputs.map(i => `<li>• ${i}</li>`).join('')}
          </ul>
        </div>
        <div class="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800">
          <label class="text-[10px] uppercase font-semibold text-neutral-500">Handoffs To</label>
          <ul class="mt-1 space-y-0.5 text-neutral-300 text-[11px]">
            ${phase.downstream.length ? phase.downstream.map(d => `<li>→ ${d}</li>`).join('') : '<li class="text-neutral-500">Final Phase</li>'}
          </ul>
        </div>
      </div>

      <div class="pt-1">
        <label class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 block">Documentation Produced by this Skill</label>
        <div class="space-y-1.5">
          ${docsHtml}
        </div>
      </div>
    </div>
  `;
}

function renderDocsMatrix() {
  const container = document.getElementById('docsMatrixContainer');
  container.innerHTML = '';

  SWARM_DATA.phases.forEach(phase => {
    phase.docsCreated.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between';

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="font-mono text-xs font-bold text-white">📄 ${doc.name}</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 font-mono">Phase ${phase.id}</span>
          </div>
          <p class="text-xs text-neutral-400 leading-relaxed">${doc.desc}</p>
        </div>
        <div class="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
          <span>Author: <strong class="text-neutral-300 font-medium">${phase.agentName}</strong></span>
          <span class="text-xs">${phase.icon}</span>
        </div>
      `;
      container.appendChild(card);
    });
  });
}

function renderDashboardPreview() {
  const preview = document.getElementById('dashLivePreview');
  preview.innerHTML = `
    <div class="bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl w-full max-w-xl text-xs space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-cyan-400 animate-ping"></span>
          <h3 class="font-bold text-white text-sm">Active Project: Apple Minimalist Calendar</h3>
        </div>
        <span class="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono text-[11px]">Phase 6: UAT</span>
      </div>

      <!-- Stepper -->
      <div>
        <label class="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">SDLC Swarm Milestones</label>
        <div class="grid grid-cols-7 gap-1 mt-1.5 text-center font-mono text-[10px]">
          <div class="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">1. PM ✓</div>
          <div class="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">2. PO ✓</div>
          <div class="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">3. Arch ✓</div>
          <div class="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">4. Dev ✓</div>
          <div class="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">5. QA ✓</div>
          <div class="p-1 rounded bg-cyan-500/30 text-cyan-300 border border-cyan-400 font-bold animate-pulse">6. UAT ⚡</div>
          <div class="p-1 rounded bg-neutral-900 text-neutral-600 border border-neutral-800">7. Deploy</div>
        </div>
      </div>

      <!-- Sandbox Link Card -->
      <div class="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between">
        <div>
          <span class="text-cyan-400 font-bold text-xs block">⚡ StackBlitz Temporary UAT Sandbox Live</span>
          <span class="text-[11px] text-neutral-400 mt-0.5 block">Review live application in isolated WebContainer</span>
        </div>
        <button class="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors">
          Open UAT ↗
        </button>
      </div>

      <!-- Documents Generated -->
      <div>
        <label class="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">Delivered Artifacts</label>
        <div class="grid grid-cols-2 gap-2 mt-1.5">
          <div class="p-2 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
            <span class="font-mono text-neutral-300">PRD.md</span>
            <span class="text-emerald-400 text-[10px]">Verified</span>
          </div>
          <div class="p-2 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
            <span class="font-mono text-neutral-300">QA_REPORT.md</span>
            <span class="text-emerald-400 text-[10px]">5/5 Passed</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.addEventListener('DOMContentLoaded', initUI);
