import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  STATE_BAR,
  STATE_LABEL,
  STATE_TEXT,
  availability,
  durationSeconds,
  endShift,
  fetchDowntime,
  fetchPeriods,
  fetchShifts,
  formatClock,
  formatDuration,
  hoursAgoIso,
  type Machine,
  type MachineState,
  type StatePeriod,
} from "@/lib/scada";

const WINDOW_HOURS = 8;

function useNow(activeMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), activeMs);
    return () => clearInterval(id);
  }, [activeMs]);
  return now;
}

function Timeline({ periods, windowStartMs }: { periods: StatePeriod[]; windowStartMs: number }) {
  const total = Date.now() - windowStartMs;
  return (
    <div className="relative mt-1 h-16 overflow-hidden rounded-lg bg-deep/50 ring-1 ring-line/60">
      <div className="absolute inset-0 flex">
        {periods.map((p) => {
          const start = Math.max(new Date(p.started_at).getTime(), windowStartMs);
          const end = p.ended_at ? new Date(p.ended_at).getTime() : Date.now();
          const width = (Math.max(0, end - start) / total) * 100;
          if (width <= 0) return null;
          return (
            <div
              key={p.id}
              className={`h-full ${STATE_BAR[p.state]}`}
              style={{ width: `${width}%` }}
              title={`${STATE_LABEL[p.state]} · ${formatClock(p.started_at)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function MachineDetail({ machine, state }: { machine: Machine; state: MachineState }) {
  const now = useNow();
  const queryClient = useQueryClient();
  const sinceIso = hoursAgoIso(WINDOW_HOURS);
  const windowStartMs = new Date(sinceIso).getTime();

  const periodsQ = useQuery({
    queryKey: ["periods", machine.id],
    queryFn: () => fetchPeriods(machine.id, sinceIso),
    refetchInterval: 5000,
  });
  const downtimeQ = useQuery({
    queryKey: ["downtime", machine.id],
    queryFn: () => fetchDowntime(machine.id, sinceIso),
    refetchInterval: 10000,
  });
  const shiftsQ = useQuery({
    queryKey: ["shifts", machine.id],
    queryFn: () => fetchShifts(machine.id),
    refetchInterval: 30000,
  });

  const periods = periodsQ.data ?? [];
  const downtime = downtimeQ.data ?? [];
  const shifts = shiftsQ.data ?? [];
  const openShift = shifts.find((s) => !s.ended_at) ?? null;
  const current = periods.find((p) => !p.ended_at) ?? null;

  const closeShift = useMutation({
    mutationFn: (id: string) => endShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts", machine.id] }),
  });

  const avail = availability(periods, windowStartMs);
  const stops = downtime.length;
  const failures = downtime.filter((d) => d.category === "failure").length;
  const closed = downtime.filter((d) => d.ended_at);
  const mttrMin = closed.length
    ? closed.reduce((acc, d) => acc + durationSeconds(d.started_at, d.ended_at), 0) /
      closed.length /
      60
    : 0;
  const activeFault = downtime.find((d) => !d.ended_at && d.category === "failure") ?? null;
  const inState = current && now !== null ? durationSeconds(current.started_at, null) : null;

  return (
    <main className="min-w-0 flex-1">
      <header className="relative border-b border-line/70 bg-gradient-to-b from-deep via-panel-2 to-deep px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[26px] leading-none font-semibold tracking-tight">
                {machine.name}
              </h1>
              <span className="rounded bg-info/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase text-info ring-1 ring-info/30">
                {machine.model}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-mut">
              <span>
                {machine.line} · {machine.code}
              </span>
              <span className="text-dim">/</span>
              <span>WINDOW {WINDOW_HOURS}h</span>
              <span className="text-dim">/</span>
              <span>TAG: RUNNING STATE</span>
            </div>
          </div>

          <div className="flex items-stretch gap-3">
            <div
              className={`flex min-w-[190px] flex-col justify-center rounded-lg px-5 py-3 ring-1 ${
                state === "run" ? "bg-run/10 ring-run/40" : "bg-stop/10 ring-stop/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`size-3 shrink-0 rounded-full ${
                    state === "run" ? "bg-run lamp-run" : "bg-stop lamp-alarm"
                  }`}
                />
                <span
                  className={`font-mono text-[11px] tracking-[0.16em] uppercase ${STATE_TEXT[state]}`}
                >
                  {state === "run" ? "Running" : STATE_LABEL[state]}
                </span>
              </div>
              <div className="mt-1 font-mono text-[34px] leading-none font-semibold tabular-nums text-ink">
                {inState === null ? "--:--:--" : formatDuration(inState)}
              </div>
              <div className="mt-0.5 font-mono text-[10px] tracking-[0.12em] uppercase text-mut">
                time in state
              </div>
            </div>
            <div className="flex min-w-[120px] flex-col justify-center rounded-lg bg-panel-2 px-4 py-3 ring-1 ring-line/70">
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-dim">Stops</div>
              <div className="font-mono text-[22px] leading-none font-semibold tabular-nums text-ink">
                {stops}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-mut">last {WINDOW_HOURS}h</div>
            </div>
            <div className="flex min-w-[120px] flex-col justify-center rounded-lg bg-panel-2 px-4 py-3 ring-1 ring-line/70">
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-dim">Since</div>
              <div className="font-mono text-[22px] leading-none font-semibold tabular-nums text-ink">
                {current ? formatClock(current.started_at) : "--:--"}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-mut">state start</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md bg-deep/60 px-3 py-2 font-mono text-[11px] ring-1 ring-line/60">
          <span className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${state === "run" ? "bg-run lamp-run" : "bg-stop lamp-alarm"}`}
            />
            STATE {STATE_LABEL[state]}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-info" />
            AVAILABILITY {avail.toFixed(1)}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${activeFault ? "bg-stop" : "bg-run"}`} />
            {activeFault ? `ACTIVE FAULT ${activeFault.reason_code ?? ""}` : "NO ACTIVE FAULT"}
          </span>
          <span className="ml-auto text-dim">
            POLL 5s · {now === null ? "--:--:--" : new Date(now).toLocaleTimeString()}
          </span>
        </div>
      </header>

      <div className="space-y-5 px-6 py-5">
        <section className="rounded-lg bg-panel-2 p-4 ring-1 ring-line/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold tracking-tight">
                Running state · last {WINDOW_HOURS} h
              </h2>
              <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-dim">
                {formatClock(sinceIso)} → now
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-mut">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-run" />
                Run
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-stop" />
                Stop
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-warn" />
                Hold
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-dim" />
                Idle
              </span>
            </div>
          </div>
          <Timeline periods={periods} windowStartMs={windowStartMs} />
        </section>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 rounded-lg bg-panel-2 p-4 ring-1 ring-line/70">
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-dim">
              Availability
            </div>
            <div className="mt-1 font-mono text-[32px] leading-none font-semibold tabular-nums text-ink">
              {avail.toFixed(1)}
              <span className="text-[18px] text-mut">%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-deep">
              <div className="h-full bg-run/90" style={{ width: `${Math.min(100, avail)}%` }} />
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-mut">last {WINDOW_HOURS} h</div>
          </div>

          <div className="col-span-3 rounded-lg bg-panel-2 p-4 ring-1 ring-line/70">
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-dim">Stops</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-[32px] leading-none font-semibold tabular-nums text-ink">
                {stops}
              </span>
              {activeFault ? (
                <span className="size-2 shrink-0 self-center rounded-full bg-stop lamp-alarm" />
              ) : null}
            </div>
            <div className="mt-2 font-mono text-[11px] text-mut">
              {failures} fail · {stops - failures} planned
            </div>
            <div className="mt-1 font-mono text-[10px] text-stop">
              {activeFault ? `active fault: ${activeFault.reason_code ?? "—"}` : "\u00a0"}
            </div>
          </div>

          <div className="col-span-3 rounded-lg bg-panel-2 p-4 ring-1 ring-line/70">
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-dim">MTTR</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-[32px] leading-none font-semibold tabular-nums text-ink">
                {Math.round(mttrMin)}
              </span>
              <span className="font-mono text-[16px] text-mut">min</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-deep">
              <div
                className="h-full bg-info/90"
                style={{ width: `${Math.min(100, mttrMin * 2)}%` }}
              />
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-mut">
              avg of {closed.length} closed stops
            </div>
          </div>

          <div className="col-span-3 rounded-lg bg-gradient-to-br from-raised to-panel-2 p-4 ring-1 ring-line/70">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-dim">
                Current shift
              </div>
              {openShift ? (
                <span className="rounded bg-run/15 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase text-run ring-1 ring-run/30">
                  Live
                </span>
              ) : (
                <span className="rounded bg-dim/15 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase text-dim ring-1 ring-line/60">
                  Closed
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-md bg-info/15 font-mono text-[11px] text-info ring-1 ring-info/30">
                {(openShift?.operator_name ?? "--")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-medium">{openShift?.operator_name ?? "No operator"}</div>
                <div className="font-mono text-[11px] text-mut">{openShift?.label ?? "—"}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="rounded-md bg-deep/50 px-2 py-1.5 ring-1 ring-line/50">
                <div className="text-[9px] tracking-[0.1em] uppercase text-dim">Start</div>
                <div className="tabular-nums text-ink">
                  {openShift ? formatClock(openShift.started_at) : "--:--"}
                </div>
              </div>
              <button
                type="button"
                disabled={!openShift || closeShift.isPending}
                onClick={() => openShift && closeShift.mutate(openShift.id)}
                className="rounded-md bg-info/10 px-2 py-1.5 text-left ring-1 ring-info/30 transition-colors hover:bg-info/20 disabled:opacity-40"
              >
                <div className="text-[9px] tracking-[0.1em] uppercase text-dim">Action</div>
                <div className="text-info">End shift</div>
              </button>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg bg-panel-2 ring-1 ring-line/70">
          <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
            <h2 className="text-[13px] font-semibold tracking-tight">Downtime events</h2>
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-dim">
              last {WINDOW_HOURS} h
            </span>
          </div>
          <div className="grid grid-cols-[84px_120px_1fr_120px_80px] gap-3 border-b border-line/50 px-4 py-2 font-mono text-[10px] tracking-[0.1em] uppercase text-dim">
            <span>Time</span>
            <span>Duration</span>
            <span>Reason</span>
            <span>Code</span>
            <span className="text-right">Type</span>
          </div>
          <ul className="divide-y divide-line/50">
            {downtime.length === 0 ? (
              <li className="px-4 py-6 text-center font-mono text-[12px] text-mut">
                No downtime recorded in this window
              </li>
            ) : (
              downtime.map((d) => (
                <li
                  key={d.id}
                  className="grid grid-cols-[84px_120px_1fr_120px_80px] items-center gap-3 px-4 py-2.5 hover:bg-raised/40"
                >
                  <span className="font-mono text-[12px] tabular-nums text-mut">
                    {formatClock(d.started_at)}
                  </span>
                  <span
                    className={`font-mono text-[12px] tabular-nums ${d.ended_at ? "text-ink" : "text-stop"}`}
                  >
                    {formatDuration(durationSeconds(d.started_at, d.ended_at))}
                  </span>
                  <span className="text-[13px] leading-tight text-ink">{d.reason}</span>
                  <span className="font-mono text-[12px] text-mut">{d.reason_code ?? "—"}</span>
                  <span className="justify-self-end">
                    <span
                      className={
                        d.category === "planned"
                          ? "rounded bg-info/12 px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase text-info ring-1 ring-info/30"
                          : "rounded bg-stop/12 px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase text-stop ring-1 ring-stop/30"
                      }
                    >
                      {d.category}
                    </span>
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
