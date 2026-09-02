import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/scada/AppShell";
import {
  fetchAllDowntime,
  fetchAllPeriods,
  fetchMachines,
  hoursAgoIso,
  machineKpis,
} from "@/lib/scada";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MTTR, MTBF & MTTF per Panel Saw" },
      {
        name: "description",
        content:
          "Reliability KPIs per machine: availability, stops, failures, MTTR, MTBF and MTTF over a selectable window.",
      },
      { property: "og:title", content: "Reports — Sawline SCADA KPIs" },
      {
        property: "og:description",
        content: "Availability, MTTR, MTBF and MTTF for every panel saw in the cell.",
      },
    ],
  }),
  component: Reports,
});

const WINDOWS = [
  { label: "8h", hours: 8 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
] as const;

function Reports() {
  const [hours, setHours] = useState<number>(24);
  const sinceIso = hoursAgoIso(hours);
  const windowStartMs = new Date(sinceIso).getTime();

  const machinesQ = useQuery({ queryKey: ["machines"], queryFn: fetchMachines });
  const periodsQ = useQuery({
    queryKey: ["all-periods", hours],
    queryFn: () => fetchAllPeriods(sinceIso),
    refetchInterval: 30000,
  });
  const downtimeQ = useQuery({
    queryKey: ["all-downtime", hours],
    queryFn: () => fetchAllDowntime(sinceIso),
    refetchInterval: 30000,
  });

  const machines = machinesQ.data ?? [];
  const periods = periodsQ.data ?? [];
  const downtime = downtimeQ.data ?? [];

  const rows = machines.map((m) => ({
    machine: m,
    kpi: machineKpis(
      periods.filter((p) => p.machine_id === m.id),
      downtime.filter((d) => d.machine_id === m.id),
      windowStartMs,
    ),
  }));

  const cellAvail = rows.length
    ? rows.reduce((a, r) => a + r.kpi.availability, 0) / rows.length
    : 0;
  const cellFailures = rows.reduce((a, r) => a + r.kpi.failures, 0);
  const cellMttr = (() => {
    const withData = rows.filter((r) => r.kpi.mttrMin > 0);
    return withData.length ? withData.reduce((a, r) => a + r.kpi.mttrMin, 0) / withData.length : 0;
  })();

  return (
    <AppShell>
      <main className="min-w-0 flex-1">
        <header className="border-b border-line/70 bg-gradient-to-b from-deep via-panel-2 to-deep px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] leading-none font-semibold tracking-tight">Reports</h1>
              <div className="mt-2 font-mono text-[12px] text-mut">
                RELIABILITY KPIs · WINDOW {WINDOWS.find((w) => w.hours === hours)?.label ?? `${hours}h`}
              </div>
            </div>
            <div className="flex gap-1 rounded-md bg-deep p-1 ring-1 ring-line/70">
              {WINDOWS.map((w) => (
                <button
                  key={w.label}
                  type="button"
                  onClick={() => setHours(w.hours)}
                  className={
                    w.hours === hours
                      ? "rounded px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] uppercase bg-raised text-ink ring-1 ring-line"
                      : "rounded px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] uppercase text-mut hover:text-ink"
                  }
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <Kpi label="Cell availability" value={`${cellAvail.toFixed(1)}%`} />
          <Kpi label="Failures" value={String(cellFailures)} />
          <Kpi label="Avg MTTR" value={`${cellMttr.toFixed(1)} min`} />
        </div>

        <div className="px-6 pb-10">
          <div className="overflow-x-auto rounded-lg ring-1 ring-line/70">
            <table className="w-full border-collapse text-left">
              <thead className="bg-deep">
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                  <th className="px-4 py-3 font-normal">Machine</th>
                  <th className="px-4 py-3 font-normal">Avail.</th>
                  <th className="px-4 py-3 font-normal">Run h</th>
                  <th className="px-4 py-3 font-normal">Down h</th>
                  <th className="px-4 py-3 font-normal">Stops</th>
                  <th className="px-4 py-3 font-normal">Failures</th>
                  <th className="px-4 py-3 font-normal">MTTR min</th>
                  <th className="px-4 py-3 font-normal">MTBF h</th>
                  <th className="px-4 py-3 font-normal">MTTF h</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ machine, kpi }) => (
                  <tr key={machine.id} className="border-t border-line/50 bg-panel-2/60">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium">{machine.name}</div>
                      <div className="font-mono text-[11px] text-mut">
                        {machine.code} · {machine.line}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">
                      {kpi.availability.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{kpi.runHours.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{kpi.downHours.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{kpi.stops}</td>
                    <td className="px-4 py-3 font-mono text-[13px] text-stop">{kpi.failures}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{kpi.mttrMin.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{kpi.mtbfH.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{kpi.mttfH.toFixed(1)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="px-4 py-6 font-mono text-[12px] text-mut" colSpan={9}>
                      {machinesQ.isLoading ? "Loading…" : "No data for this window"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-dim">
            MTTF = run hours / failures · MTBF = MTTF + MTTR · MTTR from closed failure events.
            Daily production averages will be added once production counts are ingested.
          </p>
        </div>
      </main>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel-2 p-4 ring-1 ring-line/70">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">{label}</div>
      <div className="mt-1 font-mono text-[26px] leading-none font-semibold">{value}</div>
    </div>
  );
}
