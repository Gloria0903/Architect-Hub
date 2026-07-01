export type ProjectStatus = "on_track" | "at_risk" | "delayed";

export type Project = {
  id: string;
  sheetNo: string;
  name: string;
  client: string;
  location: string;
  status: ProjectStatus;
  progress: number;
  architect: string;
  architectInitials: string;
  supervisor: string;
  startDate: string;
  dueDate: string;
  budget: number;
  invoiced: number;
  paid: number;
  priority: "low" | "medium" | "high";
  description: string;
};

export const projects: Project[] = [
  {
    id: "a-101",
    sheetNo: "A-101",
    name: "Karen Residence",
    client: "Mr. & Mrs. Mwangi",
    location: "Karen, Nairobi",
    status: "on_track",
    progress: 68,
    architect: "Naomi Otieno",
    architectInitials: "NO",
    supervisor: "David Kiprono",
    startDate: "2026-02-10",
    dueDate: "2026-09-30",
    budget: 18500000,
    invoiced: 11000000,
    paid: 9200000,
    priority: "high",
    description: "A 4-bedroom contemporary residence with a detached studio, set on a 0.5 acre plot. Currently in detailed design phase with structural coordination underway.",
  },
  {
    id: "a-104",
    sheetNo: "A-104",
    name: "Westlands Office Park",
    client: "Aurora Properties Ltd",
    location: "Westlands, Nairobi",
    status: "at_risk",
    progress: 41,
    architect: "Samuel Kamau",
    architectInitials: "SK",
    supervisor: "David Kiprono",
    startDate: "2025-11-01",
    dueDate: "2026-08-15",
    budget: 64000000,
    invoiced: 22000000,
    paid: 22000000,
    priority: "high",
    description: "8-storey mixed-use office development. Awaiting structural engineer revisions on the basement parking layout — flagged as blocking design progress.",
  },
  {
    id: "a-098",
    sheetNo: "A-098",
    name: "Nyali Beach Villas",
    client: "Coastal Developments Ltd",
    location: "Nyali, Mombasa",
    status: "delayed",
    progress: 22,
    architect: "Unassigned",
    architectInitials: "—",
    supervisor: "David Kiprono",
    startDate: "2025-09-05",
    dueDate: "2026-05-01",
    budget: 42000000,
    invoiced: 12000000,
    paid: 8500000,
    priority: "medium",
    description: "12-unit beachfront villa complex. Previously assigned architect departed the firm in May — project requires immediate takeover to restore continuity.",
  },
  {
    id: "a-110",
    sheetNo: "A-110",
    name: "Kilimani Apartments Phase 2",
    client: "Mzima Homes",
    location: "Kilimani, Nairobi",
    status: "on_track",
    progress: 80,
    architect: "Naomi Otieno",
    architectInitials: "NO",
    supervisor: "David Kiprono",
    startDate: "2025-12-01",
    dueDate: "2026-07-20",
    budget: 95000000,
    invoiced: 70000000,
    paid: 65000000,
    priority: "medium",
    description: "Second phase of a 60-unit apartment complex. Finishing schedule and BOQ in final review with the client's quantity surveyor.",
  },
  {
    id: "a-112",
    sheetNo: "A-112",
    name: "Eldoret Cathedral Annex",
    client: "Diocese of Eldoret",
    location: "Eldoret",
    status: "on_track",
    progress: 35,
    architect: "Samuel Kamau",
    architectInitials: "SK",
    supervisor: "David Kiprono",
    startDate: "2026-03-15",
    dueDate: "2027-01-10",
    budget: 31000000,
    invoiced: 6000000,
    paid: 6000000,
    priority: "low",
    description: "New annex building for community hall and offices, adjoining the existing cathedral structure. Concept design approved by the diocese board.",
  },
];

export type DailyLog = {
  id: string;
  projectId: string;
  author: string;
  date: string;
  workCompleted: string;
  challenges: string;
  pendingWork: string;
  nextActions: string;
  progress: number;
};

export const dailyLogs: DailyLog[] = [
  {
    id: "log-1",
    projectId: "a-101",
    author: "Naomi Otieno",
    date: "2026-06-29",
    workCompleted: "Finalised kitchen and utility layout. Coordinated with structural engineer on beam clearance above the living room.",
    challenges: "Client requested a last-minute change to the staircase orientation — needs re-checking against fire egress requirements.",
    pendingWork: "Staircase revision, electrical layout for studio.",
    nextActions: "Send revised staircase option to client by Wednesday.",
    progress: 68,
  },
  {
    id: "log-2",
    projectId: "a-101",
    author: "Naomi Otieno",
    date: "2026-06-26",
    workCompleted: "Completed first-floor bedroom layouts and wardrobe detailing.",
    challenges: "None.",
    pendingWork: "Kitchen layout, utility room.",
    nextActions: "Begin kitchen layout Monday.",
    progress: 63,
  },
];

export type ActivityEntry = {
  id: string;
  projectId: string;
  type: "upload" | "payment" | "takeover" | "log" | "comment" | "assignment";
  actor: string;
  description: string;
  timestamp: string;
};

export const activity: ActivityEntry[] = [
  { id: "ac-1", projectId: "a-101", type: "upload", actor: "Naomi Otieno", description: "Uploaded floor plan revision C", timestamp: "2026-06-29T16:40:00" },
  { id: "ac-2", projectId: "a-098", type: "payment", actor: "Finance", description: "Recorded payment of KSh 850,000", timestamp: "2026-06-28T11:02:00" },
  { id: "ac-3", projectId: "a-098", type: "takeover", actor: "System Admin", description: "Project flagged for takeover — architect departed", timestamp: "2026-06-25T09:15:00" },
  { id: "ac-4", projectId: "a-104", type: "comment", actor: "Samuel Kamau", description: "Added client comment on basement layout", timestamp: "2026-06-27T14:20:00" },
  { id: "ac-5", projectId: "a-110", type: "log", actor: "Naomi Otieno", description: "Submitted daily report", timestamp: "2026-06-29T17:55:00" },
];

export const currentUser = {
  name: "Lewa Mutiso",
  initials: "LM",
  role: "Senior Architect / Supervisor" as const,
  email: "lewa.mutiso@architecthub.io",
};

export function formatKsh(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function statusLabel(status: ProjectStatus) {
  if (status === "on_track") return "On track";
  if (status === "at_risk") return "At risk";
  return "Delayed";
}
