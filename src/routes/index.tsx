import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { MachineDetail } from "@/components/scada/MachineDetail";
import { MachineRail } from "@/components/scada/MachineRail";
import { fetchCurrentPeriods, fetchMachines, type MachineState } from "@/lib/scada";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sawline SCADA — Panel Saw Monitoring & Maintenance" },
      {
        name: "description",
        content:
          "Live running state, downtime reasons and shift logging for six panel saws: Akron 1400 and Selco SK4.",
      },
      { property: "og:title", content: "Sawline SCADA — Panel Saw Monitoring" },
      {
        property: "og:description",
        content:
          "Machine detail with running-state timeline, availability, MTTR, downtime reason codes and shift records.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const machinesQ = useQuery({ queryKey: ["machines"], queryFn: fetchMachines });
  const currentQ = useQuery({
    queryKey: ["current-periods"],
    queryFn: fetchCurrentPeriods,
    refetchInterval: 5000,
  });

  const machines = machinesQ.data ?? [];
  const states = useMemo(() => {
    const map: Record<string, MachineState> = {};
    for (const p of currentQ.data ?? []) map[p.machine_id] = p.state;
    return map;
  }, [currentQ.data]);

  const selected = machines.find((m) => m.id === selectedId) ?? machines[0] ?? null;
  const running = machines.filter((m) => states[m.id] === "run").length;
  const lineHealth = machines.length ? (running / machines.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-shell text-ink">
      <div className="flex min-h-screen">
        <MachineRail
          machines={machines}
          states={states}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          lineHealth={lineHealth}
        />
        {selected ? (
          <MachineDetail machine={selected} state={states[selected.id] ?? "idle"} />
        ) : (
          <main className="grid flex-1 place-items-center">
            <p className="font-mono text-[12px] text-mut">
              {machinesQ.isLoading ? "Loading machines…" : "No machines registered yet"}
            </p>
          </main>
        )}
      </div>
    </div>
  );
}
