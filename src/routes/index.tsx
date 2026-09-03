import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Radio } from "lucide-react";

import { AppShell } from "@/components/scada/AppShell";
import machineArt from "@/assets/panel-saw.png";
import {
  durationSeconds,
  fetchCurrentPeriods,
  fetchMachines,
  formatClock,
  formatDuration,
  type MachineState,
} from "@/lib/scada";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral do Sistema — Gerenciador de Manutenção" },
      {
        name: "description",
        content:
          "Painel de monitoramento em tempo real dos ativos: estado de cada serra, próxima revisão e última intervenção.",
      },
      { property: "og:title", content: "Visão Geral do Sistema — Gerenciador de Manutenção" },
      {
        property: "og:description",
        content: "Estado em tempo real de todos os ativos da célula de corte em uma única tela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sinoptico,
});

const BADGE: Record<MachineState, { label: string; cls: string }> = {
  run: { label: "Rodando", cls: "bg-run/15 text-run ring-run/40" },
  stop: { label: "Em manutenção", cls: "bg-stop/15 text-stop ring-stop/45" },
  hold: { label: "Em espera", cls: "bg-warn/15 text-warn ring-warn/45" },
  idle: { label: "Parada", cls: "bg-raised text-mut ring-line" },
};

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
    for (const p of currentQ.data ?? [])
      map[p.machine_id] = { state: p.state, started_at: p.started_at };
    return map;
  }, [currentQ.data]);

  const running = machines.filter((m) => periods[m.id]?.state === "run").length;
  const lineHealth = machines.length ? (running / machines.length) * 100 : 0;

  return (
    <AppShell
      aside={
        <div className="m-3 rounded-md bg-panel-2 p-3 ring-1 ring-line/70">
          <div className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">
            Line health
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl leading-none font-semibold text-run">
              {Math.round(lineHealth)}%
            </span>
            <span className="text-[11px] text-mut">machines running</span>
          </div>
        </div>
      }
    >
      <main className="min-w-0 flex-1 p-5">
        <div className="rounded-md bg-panel-2 px-5 py-4 ring-1 ring-info/25">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-info uppercase">
            <Radio className="size-3" />
            Monitoramento em tempo real
          </div>
          <h2 className="mt-2 text-[22px] leading-none font-bold tracking-tight uppercase">
            Visão geral do sistema — {machines.length} ativos
          </h2>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {machines.map((m) => {
            const p = periods[m.id];
            const state = p?.state ?? "idle";
            const badge = BADGE[state];
            return (
              <Link
                key={m.id}
                to="/machine/$machineId"
                params={{ machineId: m.id }}
                className="rounded-md bg-panel-2 p-3 ring-1 ring-line/70 transition-colors hover:bg-raised hover:ring-info/40"
              >
                <div className="text-center font-mono text-[13px] font-semibold tracking-[0.14em] uppercase">
                  {m.name}
                </div>

                <div
                  className={`mt-3 rounded-sm px-2.5 py-1.5 font-mono text-[10px] tracking-[0.16em] uppercase ring-1 ${badge.cls}`}
                >
                  {badge.label}
                </div>

                <div className="mt-3 rounded-sm bg-ink/95 p-2">
                  <img
                    src={machineArt}
                    alt={`Esquema técnico da máquina ${m.name}`}
                    loading="lazy"
                    width={1088}
                    height={608}
                    className="h-auto w-full"
                  />
                </div>

                <dl className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between rounded-sm bg-raised/70 px-2.5 py-1.5 ring-1 ring-line/60">
                    <dt className="font-mono text-[11px] text-info">Próxima revisão</dt>
                    <dd className="font-mono text-[11px] text-mut">—</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-sm bg-raised/70 px-2.5 py-1.5 ring-1 ring-line/60">
                    <dt className="font-mono text-[11px] text-info">Última intervenção</dt>
                    <dd className="font-mono text-[11px] text-ink">
                      {p ? formatClock(p.started_at) : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between px-2.5 pt-0.5">
                    <span className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">
                      {m.code} · {m.line}
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-ink">
                      {p ? formatDuration(durationSeconds(p.started_at, null)) : "--:--:--"}
                    </span>
                  </div>
                </dl>
              </Link>
            );
          })}
          {!machines.length && (
            <p className="font-mono text-[12px] text-mut">
              {machinesQ.isLoading ? "Carregando máquinas…" : "Nenhuma máquina registrada"}
            </p>
          )}
        </div>
      </main>
    </AppShell>
  );
}
