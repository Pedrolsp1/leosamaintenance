import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";

import machineArt from "@/assets/panel-saw.png";
import {
  durationSeconds,
  formatClock,
  formatDuration,
  registerIntervention,
  type Machine,
  type MachineState,
} from "@/lib/scada";

const BADGE: Record<MachineState, { label: string; cls: string }> = {
  run: { label: "Rodando", cls: "bg-run/15 text-run ring-run/40" },
  stop: { label: "Em manutenção", cls: "bg-stop/15 text-stop ring-stop/45" },
  hold: { label: "Em espera", cls: "bg-warn/15 text-warn ring-warn/45" },
  idle: { label: "Parada", cls: "bg-raised text-mut ring-line" },
};

const STATE_OPTIONS: MachineState[] = ["run", "stop", "hold", "idle"];

export function MachineModal({
  machine,
  state,
  startedAt,
  onClose,
}: {
  machine: Machine;
  state: MachineState;
  startedAt: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(false);
  const [nextState, setNextState] = useState<MachineState>(state);
  const [reason, setReason] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(durationSeconds(startedAt, null));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => registerIntervention(machine.id, nextState, reason.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-periods"] });
      setForm(false);
      setReason("");
    },
  });

  const badge = BADGE[state];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Ativo ${machine.name}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-lg bg-panel-2 ring-1 ring-info/30">
        <header className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
          <div>
            <h2 className="font-mono text-[13px] font-bold tracking-[0.12em] uppercase">
              {machine.name}
            </h2>
            <p className="font-mono text-[9px] tracking-[0.12em] text-dim uppercase">
              {machine.code} · {machine.line} · {machine.model}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase ring-1 ${badge.cls}`}
            >
              {badge.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="grid size-6 place-items-center rounded-sm text-mut ring-1 ring-line/70 hover:bg-raised hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </header>

        <div className="space-y-2 p-3">
          <div className="grid place-items-center overflow-hidden rounded-sm bg-ink/95 p-1">
            <img
              src={machineArt}
              alt={`Esquema técnico da máquina ${machine.name}`}
              width={1024}
              height={576}
              className="h-32 w-full object-contain"
            />
          </div>

          <dl className="space-y-1">
            <div className="flex items-center justify-between rounded-sm bg-raised/70 px-2 py-1.5 ring-1 ring-line/60">
              <dt className="font-mono text-[10px] text-info">Próxima revisão</dt>
              <dd className="font-mono text-[10px] text-mut">—</dd>
            </div>
            <div className="flex items-center justify-between rounded-sm bg-raised/70 px-2 py-1.5 ring-1 ring-line/60">
              <dt className="font-mono text-[10px] text-info">Última intervenção</dt>
              <dd className="font-mono text-[10px] text-ink">
                {startedAt ? formatClock(startedAt) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-sm bg-raised/70 px-2 py-1.5 ring-1 ring-line/60">
              <dt className="font-mono text-[10px] text-info">Tempo no status</dt>
              <dd className="font-mono text-[13px] font-semibold tabular-nums text-ink">
                {elapsed === null ? "--:--:--" : formatDuration(elapsed)}
              </dd>
            </div>
          </dl>

          {form ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="space-y-2 rounded-sm bg-raised/50 p-2.5 ring-1 ring-info/25"
            >
              <div>
                <label className="font-mono text-[9px] tracking-[0.12em] text-dim uppercase">
                  Novo status
                </label>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {STATE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNextState(s)}
                      className={`rounded-sm px-1 py-1.5 font-mono text-[9px] tracking-[0.08em] uppercase ring-1 ${
                        nextState === s ? BADGE[s].cls : "bg-panel-2 text-mut ring-line/70"
                      }`}
                    >
                      {BADGE[s].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  htmlFor="intervention-reason"
                  className="font-mono text-[9px] tracking-[0.12em] text-dim uppercase"
                >
                  Motivo / explicação
                </label>
                <textarea
                  id="intervention-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Descreva o que aconteceu…"
                  className="mt-1 w-full resize-none rounded-sm bg-deep px-2 py-1.5 font-mono text-[11px] text-ink ring-1 ring-line/70 outline-none placeholder:text-dim focus:ring-info/50"
                />
              </div>
              {save.isError ? (
                <p className="font-mono text-[10px] text-stop">
                  Não foi possível registrar. Tente novamente.
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="flex-1 rounded-sm bg-info/15 px-2 py-2 font-mono text-[10px] tracking-[0.12em] text-info uppercase ring-1 ring-info/40 hover:bg-info/25 disabled:opacity-40"
                >
                  {save.isPending ? "Registrando…" : "Salvar registro"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(false)}
                  className="rounded-sm px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-mut uppercase ring-1 ring-line/70 hover:bg-raised"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setNextState(state);
                  setForm(true);
                }}
                className="rounded-sm bg-info/15 px-2 py-2 font-mono text-[10px] tracking-[0.12em] text-info uppercase ring-1 ring-info/40 hover:bg-info/25"
              >
                Registrar intervenção
              </button>
              <Link
                to="/machine/$machineId"
                params={{ machineId: machine.id }}
                className="flex items-center justify-center gap-1.5 rounded-sm bg-raised px-2 py-2 font-mono text-[10px] tracking-[0.12em] text-ink uppercase ring-1 ring-line/70 hover:ring-info/40"
              >
                Vista detalhada
                <ExternalLink className="size-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
