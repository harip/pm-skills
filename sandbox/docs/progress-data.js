// sandbox/docs/progress-data.js
// Updated for Phase 8 UAT: Verified Live Process on Device

window.PM_DATA = {
  projectName: "LiDAR Room & Whole-House 3D Studio (iOS)",
  activeStageId: "uat",
  completionPercent: 85,
  completedStageIds: ["discovery", "scope", "architecture", "schemas", "frontend", "services", "qa"],

  pendingReview: {
    stageId: "uat",
    gateName: "Gate 3: Target-Platform User Acceptance Testing (Live on Device)",
    role: "UAT Coordinator",
    status: "AWAITING APPROVAL",
    appUrl: "http://localhost:8081",
    expoUrl: "exp://192.168.86.103:8081",
    deviceStatus: "Running on Nanose (PID 29901, Responsive 3D Drag & Apple AR QuickLook)",
    decisions: [
      {
        id: "UAT-1",
        title: "Apple HIG Light Mode & Empty State First",
        desc: "Strict Apple Light Mode (#f5f5f7 canvas, #ffffff cards, SF Pro) with first-class empty state on fresh install.",
        recommended: { code: "A", name: "Approved (Zero Dark Mode & Zero Fake Records)", desc: "Verified on device." },
        alternative: { code: "B", name: "Refine Design Details", desc: "Request adjustments." }
      },
      {
        id: "UAT-2",
        title: "Realtime LiDAR 3D Scanner & Universal Fallback",
        desc: "Live 3D point cloud viewport, real-time measurements, and zero hollow shells on any device.",
        recommended: { code: "A", name: "Approved (Universal Functional Simulation)", desc: "Verified on device." },
        alternative: { code: "B", name: "Refine Scanner Controls", desc: "Request adjustments." }
      },
      {
        id: "UAT-3",
        title: "3D Solid Mesh, 2D Blueprint & STL Export",
        desc: "Instant 3D solid and 2D floor plan switcher, unit conversion, CAD furniture, and watertight STL downloads.",
        recommended: { code: "A", name: "Approved (Full CAD Workflow)", desc: "Verified on device." },
        alternative: { code: "B", name: "Refine CAD Features", desc: "Request adjustments." }
      }
    ],
    checklistFile: "10_UAT_CHECKLIST.md"
  },

  userStories: [
    {
      id: "US-001",
      title: "Scanned Rooms Catalog & First-Class Empty State",
      status: "VERIFIED",
      ac: ["AC-1: Fresh install empty state", "AC-2: Sample preview toggle", "AC-3: Apple HIG Light Mode"]
    },
    {
      id: "US-002",
      title: "Realtime 3D LiDAR Scanner & Universal Simulation Fallback",
      status: "VERIFIED",
      ac: ["AC-1: 360 touch drag orbit", "AC-2: Live dimension callouts", "AC-3: Zero hollow shells persistence"]
    },
    {
      id: "US-003",
      title: "3D Room & 2D Floor Plan Studio with Units Toggle",
      status: "VERIFIED",
      ac: ["AC-1: 3D/2D segmented switcher", "AC-2: Imperial to metric unit toggle", "AC-3: Dimension tags"]
    },
    {
      id: "US-004",
      title: "CAD Furniture Placement",
      status: "VERIFIED",
      ac: ["AC-1: Furniture tray", "AC-2: Center room placement", "AC-3: SQLite persistence"]
    },
    {
      id: "US-005",
      title: "Standard 3D CAD Export (.STL)",
      status: "VERIFIED",
      ac: ["AC-1: ASCII STL generation", "AC-2: Watertight facets", "AC-3: Export confirmation"]
    },
    {
      id: "US-006",
      title: "Multi-Room Whole-House Auto-Stitching",
      status: "VERIFIED",
      ac: ["AC-1: Multi-room chips", "AC-2: Doorway alignment", "AC-3: Footprint calculation", "AC-4: Master STL export"]
    }
  ],

  qaSummary: {
    totalTests: 6,
    passedTests: 6,
    failedTests: 0,
    status: "ALL PASSING",
    suite: "sandbox/test-runner.js"
  }
};
