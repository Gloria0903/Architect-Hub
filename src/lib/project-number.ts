import { prisma } from "@/lib/prisma";

export async function generateProjectSheetNo(): Promise<string> {
  const latest = await prisma.project.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      sheetNo: true,
    },
  });

  if (!latest) {
    return "A-001";
  }

  const match = latest.sheetNo.match(/A-(\d+)/);

  if (!match) {
    return "A-001";
  }

  const next = Number(match[1]) + 1;

  return `A-${String(next).padStart(3, "0")}`;
}