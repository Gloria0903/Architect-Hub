import { PrismaClient, Role, ProjectStatus, Priority, CommentType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Architect Hub database...");

  // ─── Clear existing data ──────────────────────────────────────────────────
  await prisma.notification.deleteMany();
  await prisma.assignmentRecord.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.clientComment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users / Staff ────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("Password123!", 12);

  const lewa = await prisma.user.create({
    data: {
      name: "Lewa Mutiso",
      email: "lewa@archub.io",
      password: hashedPassword,
      role: Role.ADMIN,
      phone: "+254 700 111 001",
      department: "Management",
      initials: "LM",
    },
  });

  const naomi = await prisma.user.create({
    data: {
      name: "Naomi Otieno",
      email: "naomi@archub.io",
      password: hashedPassword,
      role: Role.ARCHITECT,
      phone: "+254 700 111 002",
      department: "Design",
      initials: "NO",
    },
  });

  const samuel = await prisma.user.create({
    data: {
      name: "Samuel Kamau",
      email: "samuel@archub.io",
      password: hashedPassword,
      role: Role.ARCHITECT,
      phone: "+254 700 111 003",
      department: "Design",
      initials: "SK",
    },
  });

  const david = await prisma.user.create({
    data: {
      name: "David Kiprono",
      email: "david@archub.io",
      password: hashedPassword,
      role: Role.ARCHITECT,
      phone: "+254 700 111 004",
      department: "Construction",
      initials: "DK",
    },
  });

  const amina = await prisma.user.create({
    data: {
      name: "Amina Wanjiru",
      email: "amina@archub.io",
      password: hashedPassword,
      role: Role.ARCHITECT,
      phone: "+254 700 111 005",
      department: "Design",
      initials: "AW",
    },
  });

  console.log("✅ Users created");

  // ─── Clients ──────────────────────────────────────────────────────────────
  const mwangi = await prisma.client.create({
    data: {
      name: "Mr. & Mrs. Mwangi",
      contactPerson: "James Mwangi",
      email: "mwangi@gmail.com",
      phone: "+254 722 100 001",
      address: "Karen, Nairobi",
    },
  });

  const aurora = await prisma.client.create({
    data: {
      name: "Aurora Properties Ltd",
      contactPerson: "Sarah Njoroge",
      email: "sarah@aurora.co.ke",
      phone: "+254 722 100 002",
      address: "Westlands, Nairobi",
    },
  });

  const coastal = await prisma.client.create({
    data: {
      name: "Coastal Developments Ltd",
      contactPerson: "Ali Hassan",
      email: "ali@coastal.co.ke",
      phone: "+254 722 100 003",
      address: "Nyali, Mombasa",
    },
  });

  const mzima = await prisma.client.create({
    data: {
      name: "Mzima Homes",
      contactPerson: "Peter Ndirangu",
      email: "peter@mzima.co.ke",
      phone: "+254 722 100 004",
      address: "Kilimani, Nairobi",
    },
  });

  const diocese = await prisma.client.create({
    data: {
      name: "Diocese of Eldoret",
      contactPerson: "Fr. Michael Rotich",
      email: "diocese@eldoret.go.ke",
      phone: "+254 722 100 005",
      address: "Eldoret",
    },
  });

  console.log("✅ Clients created");

  // ─── Projects ─────────────────────────────────────────────────────────────
  const p1 = await prisma.project.create({
    data: {
      sheetNo: "A-101",
      name: "Karen Residence",
      clientId: mwangi.id,
      location: "Karen, Nairobi",
      description: "4-bedroom contemporary residence with a detached studio on 0.5 acres. Currently in detailed design phase with structural coordination underway.",
      status: ProjectStatus.ON_TRACK,
      progress: 68,
      architectId: naomi.id,
      supervisorId: david.id,
      startDate: new Date("2026-02-10"),
      dueDate: new Date("2026-09-30"),
      budget: 18500000,
      invoiced: 11000000,
      paid: 9200000,
      priority: Priority.HIGH,
    },
  });

  const p2 = await prisma.project.create({
    data: {
      sheetNo: "A-104",
      name: "Westlands Office Park",
      clientId: aurora.id,
      location: "Westlands, Nairobi",
      description: "8-storey mixed-use office development. Awaiting structural engineer revisions on the basement parking layout — flagged as blocking design progress.",
      status: ProjectStatus.AT_RISK,
      progress: 41,
      architectId: samuel.id,
      supervisorId: david.id,
      startDate: new Date("2025-11-01"),
      dueDate: new Date("2026-08-15"),
      budget: 64000000,
      invoiced: 22000000,
      paid: 22000000,
      priority: Priority.HIGH,
    },
  });

  const p3 = await prisma.project.create({
    data: {
      sheetNo: "A-098",
      name: "Nyali Beach Villas",
      clientId: coastal.id,
      location: "Nyali, Mombasa",
      description: "12-unit beachfront villa complex. Previously assigned architect departed — requires immediate takeover to restore continuity.",
      status: ProjectStatus.DELAYED,
      progress: 22,
      architectId: null,
      supervisorId: david.id,
      startDate: new Date("2025-09-05"),
      dueDate: new Date("2026-05-01"),
      budget: 42000000,
      invoiced: 12000000,
      paid: 8500000,
      priority: Priority.MEDIUM,
    },
  });

  const p4 = await prisma.project.create({
    data: {
      sheetNo: "A-110",
      name: "Kilimani Apartments Ph.2",
      clientId: mzima.id,
      location: "Kilimani, Nairobi",
      description: "Second phase of a 60-unit apartment complex. Finishing schedule and BOQ in final review with the client's quantity surveyor.",
      status: ProjectStatus.ON_TRACK,
      progress: 80,
      architectId: naomi.id,
      supervisorId: david.id,
      startDate: new Date("2025-12-01"),
      dueDate: new Date("2026-07-20"),
      budget: 95000000,
      invoiced: 70000000,
      paid: 65000000,
      priority: Priority.MEDIUM,
    },
  });

  const p5 = await prisma.project.create({
    data: {
      sheetNo: "A-112",
      name: "Eldoret Cathedral Annex",
      clientId: diocese.id,
      location: "Eldoret",
      description: "New annex building for community hall and offices adjoining the existing cathedral. Concept design approved by diocese board.",
      status: ProjectStatus.ON_TRACK,
      progress: 35,
      architectId: amina.id,
      supervisorId: david.id,
      startDate: new Date("2026-03-15"),
      dueDate: new Date("2027-01-10"),
      budget: 31000000,
      invoiced: 6000000,
      paid: 6000000,
      priority: Priority.LOW,
    },
  });

  console.log("✅ Projects created");

  // ─── Daily Logs ───────────────────────────────────────────────────────────
  await prisma.dailyLog.createMany({
    data: [
      {
        projectId: p1.id,
        authorId: naomi.id,
        date: new Date("2026-06-30"),
        workCompleted: "Finalised kitchen and utility layout. Coordinated with structural engineer on beam clearance above the living room.",
        challenges: "Client requested a last-minute change to the staircase orientation — needs re-checking against fire egress requirements.",
        pendingWork: "Staircase revision, electrical layout for studio.",
        nextActions: "Send revised staircase option to client by Wednesday.",
        progress: 68,
        submittedAt: new Date("2026-06-30T17:30:00"),
      },
      {
        projectId: p1.id,
        authorId: naomi.id,
        date: new Date("2026-06-27"),
        workCompleted: "Completed first-floor bedroom layouts and wardrobe detailing. Issued revised drawing set to supervisor for review.",
        challenges: "None significant.",
        pendingWork: "Kitchen layout, utility room.",
        nextActions: "Begin kitchen layout Monday.",
        progress: 63,
        submittedAt: new Date("2026-06-27T17:00:00"),
      },
      {
        projectId: p2.id,
        authorId: samuel.id,
        date: new Date("2026-06-30"),
        workCompleted: "Reviewed structural engineer's revised basement drawings. Identified three clashes with MEP routing.",
        challenges: "Structural revisions still do not fully resolve parking layout issue. Need further coordination meeting.",
        pendingWork: "Clash report, coordination meeting minutes.",
        nextActions: "Schedule meeting with structural and MEP teams for Thursday.",
        progress: 41,
        submittedAt: new Date("2026-06-30T17:45:00"),
      },
      {
        projectId: p4.id,
        authorId: naomi.id,
        date: new Date("2026-06-30"),
        workCompleted: "Issued final BOQ to QS for review. Checked window schedule against supplier quotes.",
        challenges: "One window type is out of stock — seeking alternative supplier.",
        pendingWork: "QS feedback, alternative supplier confirmation.",
        nextActions: "Follow up with QS by EOD Tuesday.",
        progress: 80,
        submittedAt: new Date("2026-06-30T16:55:00"),
      },
      {
        projectId: p5.id,
        authorId: amina.id,
        date: new Date("2026-06-30"),
        workCompleted: "Developed schematic floor plans for community hall. Presented two layout options to project team.",
        challenges: "Access route to the annex from the main cathedral needs approval from heritage board.",
        pendingWork: "Heritage board submission, structural brief.",
        nextActions: "Prepare heritage board submission documents.",
        progress: 35,
        submittedAt: new Date("2026-06-30T17:20:00"),
      },
    ],
  });

  console.log("✅ Daily logs created");

  // ─── Client Comments ──────────────────────────────────────────────────────
  await prisma.clientComment.createMany({
    data: [
      {
        projectId: p1.id,
        clientId: mwangi.id,
        author: "James Mwangi",
        content: "We would like the master bedroom to have a larger wardrobe — can we extend the layout into the dressing area? Also, can we look at adding an ensuite to bedroom 3?",
        type: CommentType.CHANGE_REQUEST,
        createdAt: new Date("2026-06-28T10:30:00"),
      },
      {
        projectId: p1.id,
        clientId: mwangi.id,
        author: "James Mwangi",
        content: "The kitchen layout presented in the meeting looks good. We approve the island design and the pantry placement.",
        type: CommentType.APPROVAL,
        createdAt: new Date("2026-06-25T14:00:00"),
        resolvedAt: new Date("2026-06-26T09:00:00"),
      },
      {
        projectId: p2.id,
        clientId: aurora.id,
        author: "Sarah Njoroge",
        content: "Concerned about the delay on the basement design. Our contractor needs final drawings by end of July otherwise we face penalties. Please advise on revised timeline.",
        type: CommentType.QUERY,
        createdAt: new Date("2026-06-29T09:15:00"),
      },
      {
        projectId: p4.id,
        clientId: mzima.id,
        author: "Peter Ndirangu",
        content: "The window specifications look fine. However, we need confirmation on the roof terrace balustrade spec before the meeting on Friday.",
        type: CommentType.QUERY,
        createdAt: new Date("2026-06-29T16:45:00"),
      },
      {
        projectId: p3.id,
        clientId: coastal.id,
        author: "Ali Hassan",
        content: "We are very concerned that the project has had no activity for several weeks. We expect a project update meeting urgently — please arrange this week.",
        type: CommentType.FEEDBACK,
        createdAt: new Date("2026-06-27T08:00:00"),
      },
    ],
  });

  console.log("✅ Client comments created");

  // ─── Payments ─────────────────────────────────────────────────────────────
  await prisma.payment.createMany({
    data: [
      { projectId: p1.id, recordedById: lewa.id, amount: 5000000, date: new Date("2026-03-15"), reference: "INV-A101-001", note: "Initial deposit on signing of contract" },
      { projectId: p1.id, recordedById: lewa.id, amount: 4200000, date: new Date("2026-05-20"), reference: "INV-A101-002", note: "Second stage payment on design completion" },
      { projectId: p2.id, recordedById: lewa.id, amount: 22000000, date: new Date("2026-02-10"), reference: "INV-A104-001", note: "Full retainer payment upfront per contract" },
      { projectId: p3.id, recordedById: lewa.id, amount: 8500000, date: new Date("2025-12-01"), reference: "INV-A098-001", note: "Deposit payment" },
      { projectId: p4.id, recordedById: lewa.id, amount: 65000000, date: new Date("2026-06-01"), reference: "INV-A110-001", note: "Cumulative payments to date" },
      { projectId: p5.id, recordedById: lewa.id, amount: 6000000, date: new Date("2026-04-10"), reference: "INV-A112-001", note: "Concept design payment" },
    ],
  });

  console.log("✅ Payments created");

  // ─── Notifications ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: lewa.id, message: "Nyali Beach Villas is unassigned and delayed — action required", type: "ERROR", read: false },
      { userId: lewa.id, message: "Client query on Westlands Office Park awaiting response", type: "WARNING", read: false },
      { userId: lewa.id, message: "4 daily logs submitted today", type: "INFO", read: false },
      { userId: david.id, message: "Karen Residence — staircase change request from client", type: "WARNING", read: false },
    ],
  });

  console.log("✅ Notifications created");
  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📋 Login credentials (all accounts use the same password):");
  console.log("   Admin:           lewa@archub.io   / Password123!");
  console.log("   Senior Architect: naomi@archub.io  / Password123!");
  console.log("   Architect:       samuel@archub.io / Password123!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
