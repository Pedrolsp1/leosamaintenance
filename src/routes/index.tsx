import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Radio } from "lucide-react";

import { AppShell } from "@/components/scada/AppShell";
import { MachineModal } from "@/components/scada/MachineModal";
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

  const [openId, setOpenId] = useState<string | null>(null);
  const openMachine = machines.find((m) => m.id === openId) ?? null;


  return (
    <AppShell>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3">
        <div className="shrink-0 rounded-md bg-panel-2 px-4 py-2.5 ring-1 ring-info/25">
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.18em] text-info uppercase">
            <Radio className="size-3" />
            Monitoramento em tempo real
          </div>
          <h2 className="mt-1 text-[16px] leading-none font-bold tracking-tight uppercase">
            Visão geral do sistema — {machines.length} ativos
          </h2>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 lg:grid-cols-3">
          {machines.map((m) => {
            const p = periods[m.id];
            const state = p?.state ?? "idle";
            const badge = BADGE[state];
            return (
              <Link
                key={m.id}
                to="/machine/$machineId"
                params={{ machineId: m.id }}
                className="flex min-h-0 flex-col rounded-md bg-panel-2 p-2 ring-1 ring-line/70 transition-colors hover:bg-raised hover:ring-info/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold tracking-[0.12em] uppercase">
                    {m.name}
                  </span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase ring-1 ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="mt-1.5 grid min-h-0 flex-1 place-items-center overflow-hidden rounded-sm bg-ink/95 p-1">
                  <img
                    src={machineArt}
                    alt={`Esquema técnico da máquina ${m.name}`}
                    loading="lazy"
                    width={1024}
                    height={576}
                    className="h-full max-h-full w-full object-contain"
                  />
                </div>

                <dl className="mt-1.5 shrink-0 space-y-1">
                  <div className="flex items-center justify-between rounded-sm bg-raised/70 px-2 py-1 ring-1 ring-line/60">
                    <dt className="font-mono text-[10px] text-info">Próxima revisão</dt>
                    <dd className="font-mono text-[10px] text-mut">—</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-sm bg-raised/70 px-2 py-1 ring-1 ring-line/60">
                    <dt className="font-mono text-[10px] text-info">Última intervenção</dt>
                    <dd className="font-mono text-[10px] text-ink">
                      {p ? formatClock(p.started_at) : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className="font-mono text-[9px] tracking-[0.12em] text-dim uppercase">
                      {m.code} · {m.line}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-ink">
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
