import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/layout/app-shell";

export default function Page() {
  return (
    <AppShell>
    <div>
      <h1 className="font-display font-bold text-[19px] text-ink mb-0.5">Staff</h1>
      <p className="text-muted text-[12px] mb-5">This module ships in a later build phase.</p>
      <Card className="p-8 text-center text-muted text-[12.5px]">
        Coming up in Phase D/E of the build.
      </Card>
    </div>
  </AppShell>
  );
}
