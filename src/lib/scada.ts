import { supabase } from "@/integrations/supabase/client";

export type MachineState = "run" | "stop" | "hold" | "idle";

export interface Machine {
  id: string;
  code: string;
  name: string;
  model: string;
  line: string;
  sort_order: number;
}

export interface StatePeriod {
  id: string;
  machine_id: string;
  state: MachineState;
  started_at: string;
  ended_at: string | null;
}

export interface DowntimeEvent {
  id: string;
  machine_id: string;
  started_at: string;
  ended_at: string | null;
  reason: string;
  reason_code: string | null;
  category: "planned" | "failure";
  notes: string | null;
}

export interface Shift {
  id: string;
  machine_id: string | null;
  label: string;
  operator_name: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export const STATE_LABEL: Record<MachineState, string> = {
  run: "RUN",
  stop: "STOP",
  hold: "HOLD",
  idle: "IDLE",
};

export const STATE_DOT: Record<MachineState, string> = {
  run: "bg-run lamp-run",
  stop: "bg-stop lamp-alarm",
  hold: "bg-warn",
  idle: "bg-dim",
};

export const STATE_TEXT: Record<MachineState, string> = {
  run: "text-run",
  stop: "text-stop",
  hold: "text-warn",
  idle: "text-dim",
};

export const STATE_BAR: Record<MachineState, string> = {
  run: "bg-run/85",
  stop: "bg-stop/85",
  hold: "bg-warn/85",
  idle: "bg-dim/60",
};

export async function fetchMachines() {
  const { data, error } = await supabase
    .from("machines")
    .select("id, code, name, model, line, sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Machine[];
}

export async function fetchCurrentPeriods() {
  const { data, error } = await supabase
    .from("machine_state_periods")
    .select("id, machine_id, state, started_at, ended_at")
    .is("ended_at", null);
  if (error) throw error;
  return (data ?? []) as StatePeriod[];
}

export async function fetchPeriods(machineId: string, sinceIso: string) {
  const { data, error } = await supabase
    .from("machine_state_periods")
    .select("id, machine_id, state, started_at, ended_at")
    .eq("machine_id", machineId)
    .gte("started_at", sinceIso)
    .order("started_at");
  if (error) throw error;
  return (data ?? []) as StatePeriod[];
}

export async function fetchDowntime(machineId: string, sinceIso: string) {
  const { data, error } = await supabase
    .from("downtime_events")
    .select("id, machine_id, started_at, ended_at, reason, reason_code, category, notes")
    .eq("machine_id", machineId)
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DowntimeEvent[];
}

export async function fetchShifts(machineId: string) {
  const { data, error } = await supabase
    .from("shifts")
    .select("id, machine_id, label, operator_name, started_at, ended_at, notes")
    .eq("machine_id", machineId)
    .order("started_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []) as Shift[];
}

export async function endShift(shiftId: string) {
  const { error } = await supabase
    .from("shifts")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", shiftId);
  if (error) throw error;
}

export async function startShift(machineId: string, label: string, operator: string) {
  const { error } = await supabase
    .from("shifts")
    .insert({ machine_id: machineId, label, operator_name: operator });
  if (error) throw error;
}

/**
 * Records an intervention: closes the machine's open state period, opens a new
 * one with the chosen state, and logs the reason as a downtime event
 * (closing any open one when the machine goes back to running).
 */
export async function registerIntervention(
  machineId: string,
  state: MachineState,
  reason: string,
) {
  const now = new Date().toISOString();

  const closePeriod = await supabase
    .from("machine_state_periods")
    .update({ ended_at: now })
    .eq("machine_id", machineId)
    .is("ended_at", null);
  if (closePeriod.error) throw closePeriod.error;

  const openPeriod = await supabase
    .from("machine_state_periods")
    .insert({ machine_id: machineId, state, started_at: now });
  if (openPeriod.error) throw openPeriod.error;

  const closeDowntime = await supabase
    .from("downtime_events")
    .update({ ended_at: now })
    .eq("machine_id", machineId)
    .is("ended_at", null);
  if (closeDowntime.error) throw closeDowntime.error;

  if (state !== "run") {
    const logDowntime = await supabase.from("downtime_events").insert({
      machine_id: machineId,
      started_at: now,
      reason,
      category: state === "stop" ? "failure" : "planned",
      notes: reason,
    });
    if (logDowntime.error) throw logDowntime.error;
  }
}

export function hoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

export function durationSeconds(startIso: string, endIso: string | null) {
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return (end - new Date(startIso).getTime()) / 1000;
}

/** Availability = share of the window spent in "run". */
export function availability(periods: StatePeriod[], windowStartMs: number) {
  let run = 0;
  let total = 0;
  for (const p of periods) {
    const start = Math.max(new Date(p.started_at).getTime(), windowStartMs);
    const end = p.ended_at ? new Date(p.ended_at).getTime() : Date.now();
    const span = Math.max(0, end - start);
    total += span;
    if (p.state === "run") run += span;
  }
  return total > 0 ? (run / total) * 100 : 0;
}

export async function fetchAllPeriods(sinceIso: string) {
  const { data, error } = await supabase
    .from("machine_state_periods")
    .select("id, machine_id, state, started_at, ended_at")
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StatePeriod[];
}

export async function fetchAllDowntime(sinceIso: string) {
  const { data, error } = await supabase
    .from("downtime_events")
    .select("id, machine_id, started_at, ended_at, reason, reason_code, category, notes")
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DowntimeEvent[];
}

export async function fetchAllShifts(sinceIso: string) {
  const { data, error } = await supabase
    .from("shifts")
    .select("id, machine_id, label, operator_name, started_at, ended_at, notes")
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Shift[];
}

export interface MachineKpis {
  availability: number;
  runHours: number;
  downHours: number;
  stops: number;
  failures: number;
  /** Mean time to repair (minutes) over closed failure events. */
  mttrMin: number;
  /** Mean time between failures (hours): uptime + repair time per failure. */
  mtbfH: number;
  /** Mean time to failure (hours): pure uptime per failure. */
  mttfH: number;
}

/** KPIs for one machine from its state periods and downtime events in a window. */
export function machineKpis(
  periods: StatePeriod[],
  downtime: DowntimeEvent[],
  windowStartMs: number,
): MachineKpis {
  let runMs = 0;
  let totalMs = 0;
  for (const p of periods) {
    const start = Math.max(new Date(p.started_at).getTime(), windowStartMs);
    const end = p.ended_at ? new Date(p.ended_at).getTime() : Date.now();
    const span = Math.max(0, end - start);
    totalMs += span;
    if (p.state === "run") runMs += span;
  }

  const failures = downtime.filter((d) => d.category === "failure");
  const closedFailures = failures.filter((d) => d.ended_at);
  const repairSec = closedFailures.reduce(
    (acc, d) => acc + durationSeconds(d.started_at, d.ended_at),
    0,
  );

  const runH = runMs / 3600_000;
  const downH = (totalMs - runMs) / 3600_000;
  const n = closedFailures.length;
  const mttrMin = n ? repairSec / n / 60 : 0;

  return {
    availability: totalMs > 0 ? (runMs / totalMs) * 100 : 0,
    runHours: runH,
    downHours: downH,
    stops: downtime.length,
    failures: failures.length,
    mttrMin,
    mtbfH: n ? runH / n + repairSec / n / 3600 : 0,
    mttfH: n ? runH / n : 0,
  };
}
