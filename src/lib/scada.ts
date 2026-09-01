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
