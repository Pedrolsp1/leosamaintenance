import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { AppShell } from "@/components/scada/AppShell";
import { MachineDetail } from "@/components/scada/MachineDetail";
import {
  STATE_DOT,
  STATE_LABEL,
  STATE_TEXT,
  fetchCurrentPeriods,
  fetchMachines,
  type MachineState,
} from "@/lib/scada";

export const Route = createFileRoute("/machine/$machineId")({
  head: () => ({
    meta: [
      { title: "Machine Detail — Sawline SCADA" },
      {
        name: "description",
        content:
          "Running-state timeline, availability, stops, MTTR, downtime reasons and shift record for a single panel saw.",
      },
      { property: "og:title", content: "Machine Detail — Sawline SCADA" },
      {
        property: "og:description",
        content: "Full machine detail: state timeline, availability, MTTR and downtime reasons.",
      },
    ],
  }),
  component: MachinePage,
});

function MachinePage() {
  const { machineId } = Route.useParams();

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

  const selected = machines.find((m) => m.id === machineId) ?? null;

  return (
    <AppShell
      aside={
        <div className="px-3 pt-4 pb-2">
          <div className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
            Machines · {machines.length}
          </div>
          <div className="mt-2 space-y-1">
            {machines.map((m) => {
              const state = states[m.id] ?? "idle";
              return (
                <Link
                  key={m.id}
                  to="/machine/$machineId"
                  params={{ machineId: m.id }}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left hover:bg-raised/50 data-[status=active]:border-l-2 data-[status=active]:border-l-run data-[status=active]:bg-raised data-[status=active]:ring-1 data-[status=active]:ring-line data-[status=active]:ring-inset"
                >
                  <span className={`size-2.5 shrink-0 rounded-full ${STATE_DOT[state]}`} />
                  <span className="flex-1">
                    <span className="block text-[13px] leading-tight font-medium">{m.name}</span>
                    <span className="block font-mono text-[11px] leading-tight text-mut">
                      {m.code} · {m.line}
                    </span>
                  </span>
                  <span className={`font-mono text-[10px] ${STATE_TEXT[state]}`}>
                    {STATE_LABEL[state]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      }
    >
      {selected ? (
        <MachineDetail machine={selected} state={states[selected.id] ?? "idle"} />
      ) : (
        <main className="grid flex-1 place-items-center">
          <p className="font-mono text-[12px] text-mut">
            {machinesQ.isLoading ? "Loading machine…" : "Machine not found"}
          </p>
        </main>
      )}
    </AppShell>
  );
}
