import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { AppShell } from "@/components/scada/AppShell";
import {
  STATE_DOT,
  STATE_LABEL,
  STATE_TEXT,
  durationSeconds,
  fetchCurrentPeriods,
  fetchMachines,
  formatDuration,
  type MachineState,
} from "@/lib/scada";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sinóptico — Sawline SCADA Panel Saw Cell" },
      {
        name: "description",
        content:
          "Live synoptic view of all six panel saws: running state, time in state and line health at a glance.",
      },
      { property: "og:title", content: "Sinóptico — Sawline SCADA" },
      {
        property: "og:description",
        content: "Every panel saw's running state on one screen; click a machine for full detail.",
      },
    ],
  }),
  component: Sinoptico,
});

function Sinoptico() {
  const machinesQ = useQuery({ queryKey: ["machines"], queryFn: fetchMachines });
  const currentQ = useQuery({
    queryKey: ["current-periods"],
    queryFn: fetchCurrentPeriods,
    refetchInterval: 5000,
  });

  const machines = machinesQ.data ?? [];
  const periods = useMemo(() => {
    const map: Record<string, { state: MachineState; started_at: string }> = {};
    for (const p of currentQ.data ?? []) map[p.machine_id] = { state: p.state, started_at: p.started_at };
    return map;
  }, [currentQ.data]);

  const running = machines.filter((m) => periods[m.id]?.state === "run").length;
  const lineHealth = machines.length ? (running / machines.length) * 100 : 0;

  return (
    <AppShell
      aside={
        <div className="mx-3 mt-4 rounded-md bg-panel-2 p-3 ring-1 ring-line/60">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
            Line health
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl leading-none font-semibold">
              {Math.round(lineHealth)}%
            </span>
            <span className="text-[11px] text-mut">machines running</span>
          </div>
        </div>
      }
    >
      <main className="min-w-0 flex-1">
        <header className="border-b border-line/70 bg-gradient-to-b from-deep via-panel-2 to-deep px-6 py-5">
          <h1 className="text-[26px] leading-none font-semibold tracking-tight">Sinóptico</h1>
          <div className="mt-2 font-mono text-[12px] text-mut">
            {machines.length} MACHINES · {running} RUNNING · POLL 5s
          </div>
        </header>

        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {machines.map((m) => {
            const p = periods[m.id];
            const state = p?.state ?? "idle";
            return (
              <Link
                key={m.id}
                to="/machine/$machineId"
                params={{ machineId: m.id }}
                className={`rounded-lg bg-panel-2 p-4 ring-1 transition-colors hover:bg-raised ${
                  state === "run"
                    ? "ring-run/35"
                    : state === "stop"
                      ? "ring-stop/40"
                      : "ring-line/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[17px] leading-tight font-semibold tracking-tight">
                      {m.name}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-mut">
                      {m.code} · {m.line} · {m.model}
                    </div>
                  </div>
                  <span className={`mt-1 size-3.5 shrink-0 rounded-full ${STATE_DOT[state]}`} />
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <span
                    className={`font-mono text-[13px] tracking-[0.16em] uppercase ${STATE_TEXT[state]}`}
                  >
                    {STATE_LABEL[state]}
                  </span>
                  <span className="font-mono text-[22px] leading-none font-semibold text-ink">
                    {p ? formatDuration(durationSeconds(p.started_at, null)) : "--:--:--"}
                  </span>
                </div>
              </Link>
            );
          })}
          {!machines.length && (
            <p className="font-mono text-[12px] text-mut">
              {machinesQ.isLoading ? "Loading machines…" : "No machines registered yet"}
            </p>
          )}
        </div>
      </main>
    </AppShell>
  );
}
