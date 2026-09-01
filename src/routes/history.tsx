import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/scada/AppShell";
import {
  STATE_LABEL,
  STATE_TEXT,
  durationSeconds,
  fetchAllDowntime,
  fetchAllPeriods,
  fetchAllShifts,
  fetchMachines,
  formatDuration,
  hoursAgoIso,
  type MachineState,
} from "@/lib/scada";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Activity Register for the Panel Saw Cell" },
      {
        name: "description",
        content:
          "Chronological register of state changes, downtime events and operator shifts across all panel saws.",
      },
      { property: "og:title", content: "History — Sawline SCADA" },
      {
        property: "og:description",
        content: "Every state change, downtime event and shift, newest first, filterable by type.",
      },
    ],
  }),
  component: History,
});

type Kind = "state" | "downtime" | "shift";

interface Entry {
  id: string;
  kind: Kind;
  machineId: string | null;
  at: string;
  end: string | null;
  title: string;
  detail: string;
  tone: string;
}

const FILTERS: { label: string; value: Kind | "all" }[] = [
  { label: "All", value: "all" },
  { label: "States", value: "state" },
  { label: "Downtime", value: "downtime" },
  { label: "Shifts", value: "shift" },
];

const KIND_LABEL: Record<Kind, string> = {
  state: "STATE",
  downtime: "DOWNTIME",
  shift: "SHIFT",
};

function History() {
  const [hours, setHours] = useState(24);
  const [kind, setKind] = useState<Kind | "all">("all");
  const sinceIso = hoursAgoIso(hours);

  const machinesQ = useQuery({ queryKey: ["machines"], queryFn: fetchMachines });
  const periodsQ = useQuery({
    queryKey: ["all-periods", hours],
    queryFn: () => fetchAllPeriods(sinceIso),
    refetchInterval: 15000,
  });
  const downtimeQ = useQuery({
    queryKey: ["all-downtime", hours],
    queryFn: () => fetchAllDowntime(sinceIso),
    refetchInterval: 15000,
  });
  const shiftsQ = useQuery({
    queryKey: ["all-shifts", hours],
    queryFn: () => fetchAllShifts(sinceIso),
    refetchInterval: 30000,
  });

  const machineLabel = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of machinesQ.data ?? []) map[m.id] = `${m.code} · ${m.name}`;
    return map;
  }, [machinesQ.data]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];

    for (const p of periodsQ.data ?? []) {
      const state = p.state as MachineState;
      list.push({
        id: `s-${p.id}`,
        kind: "state",
        machineId: p.machine_id,
        at: p.started_at,
        end: p.ended_at,
        title: `Entered ${STATE_LABEL[state]}`,
        detail: p.ended_at ? "closed" : "ongoing",
        tone: STATE_TEXT[state],
      });
    }

    for (const d of downtimeQ.data ?? []) {
      list.push({
        id: `d-${d.id}`,
        kind: "downtime",
        machineId: d.machine_id,
        at: d.started_at,
        end: d.ended_at,
        title: d.reason,
        detail: [d.reason_code, d.category, d.notes].filter(Boolean).join(" · "),
        tone: d.category === "failure" ? "text-stop" : "text-warn",
      });
    }

    for (const s of shiftsQ.data ?? []) {
      list.push({
        id: `h-${s.id}`,
        kind: "shift",
        machineId: s.machine_id,
        at: s.started_at,
        end: s.ended_at,
        title: `${s.label} — ${s.operator_name}`,
        detail: s.ended_at ? "finished" : "open",
        tone: "text-info",
      });
    }

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [periodsQ.data, downtimeQ.data, shiftsQ.data]);

  const visible = kind === "all" ? entries : entries.filter((e) => e.kind === kind);
  const loading = periodsQ.isLoading || downtimeQ.isLoading || shiftsQ.isLoading;

  return (
    <AppShell>
      <main className="min-w-0 flex-1">
        <header className="border-b border-line/70 bg-gradient-to-b from-deep via-panel-2 to-deep px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] leading-none font-semibold tracking-tight">History</h1>
              <div className="mt-2 font-mono text-[12px] text-mut">
                {visible.length} RECORDS · LAST {hours}h
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 rounded-md bg-deep p-1 ring-1 ring-line/70">
                {[8, 24, 168].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className={
                      h === hours
                        ? "rounded bg-raised px-3 py-1.5 font-mono text-[11px] uppercase text-ink ring-1 ring-line"
                        : "rounded px-3 py-1.5 font-mono text-[11px] uppercase text-mut hover:text-ink"
                    }
                  >
                    {h}h
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-md bg-deep p-1 ring-1 ring-line/70">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setKind(f.value)}
                    className={
                      f.value === kind
                        ? "rounded bg-raised px-3 py-1.5 font-mono text-[11px] uppercase text-ink ring-1 ring-line"
                        : "rounded px-3 py-1.5 font-mono text-[11px] uppercase text-mut hover:text-ink"
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="px-6 py-6">
          <div className="overflow-x-auto rounded-lg ring-1 ring-line/70">
            <table className="w-full border-collapse text-left">
              <thead className="bg-deep">
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                  <th className="px-4 py-3 font-normal">When</th>
                  <th className="px-4 py-3 font-normal">Type</th>
                  <th className="px-4 py-3 font-normal">Machine</th>
                  <th className="px-4 py-3 font-normal">Activity</th>
                  <th className="px-4 py-3 font-normal">Detail</th>
                  <th className="px-4 py-3 font-normal">Duration</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id} className="border-t border-line/50 bg-panel-2/60">
                    <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-mut">
                      {new Date(e.at).toLocaleString([], {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] tracking-[0.1em] text-dim">
                      {KIND_LABEL[e.kind]}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {e.machineId ? machineLabel[e.machineId] ?? "—" : "CELL"}
                    </td>
                    <td className={`px-4 py-3 text-[13px] ${e.tone}`}>{e.title}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-mut">{e.detail || "—"}</td>
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {formatDuration(durationSeconds(e.at, e.end))}
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td className="px-4 py-6 font-mono text-[12px] text-mut" colSpan={6}>
                      {loading ? "Loading activity…" : "No activity in this window"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
