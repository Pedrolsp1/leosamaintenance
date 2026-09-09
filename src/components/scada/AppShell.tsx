import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, FileBarChart2, History as HistoryIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import leoLogo from "@/assets/leo-logo.png.asset.json";
import plControlsLogo from "@/assets/plcontrols-logo.png.asset.json";
import { fetchCurrentPeriods, fetchMachines, type MachineState } from "@/lib/scada";



const NAV = [
  { to: "/", label: "Sinóptico", icon: LayoutDashboard },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/history", label: "History", icon: HistoryIcon },
] as const;

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-[12px] font-semibold text-ink">
        {now ? now.toLocaleDateString("pt-BR") : "--/--/----"}{" "}
        <span className="text-info">{now ? now.toLocaleTimeString("pt-BR") : "--:--:--"}</span>
      </div>
      <div className="font-mono text-[10px] tracking-[0.14em] text-mut uppercase">
        Level access — Engineer
      </div>
    </div>
  );
}

function LineHealth() {
  const machinesQ = useQuery({ queryKey: ["machines"], queryFn: fetchMachines });
  const currentQ = useQuery({
    queryKey: ["current-periods"],
    queryFn: fetchCurrentPeriods,
    refetchInterval: 5000,
  });

  const { pct, running, total } = useMemo(() => {
    const machines = machinesQ.data ?? [];
    const state: Record<string, MachineState> = {};
    for (const p of currentQ.data ?? []) state[p.machine_id] = p.state;
    const run = machines.filter((m) => state[m.id] === "run").length;
    return {
      running: run,
      total: machines.length,
      pct: machines.length ? (run / machines.length) * 100 : 0,
    };
  }, [machinesQ.data, currentQ.data]);

  const r = 30;
  const c = 2 * Math.PI * r;
  const runLen = (pct / 100) * c;

  return (
    <div className="m-2 rounded-md bg-panel-2 p-2.5 ring-1 ring-line/70">
      <div className="font-mono text-[9px] tracking-[0.14em] text-dim uppercase">Line health</div>
      <div className="relative mx-auto mt-1.5 size-[84px]">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="9" className="stroke-stop/85" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            strokeWidth="9"
            strokeLinecap="butt"
            className="stroke-run"
            strokeDasharray={`${runLen} ${c - runLen}`}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-lg leading-none font-bold text-ink">
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div className="mt-1.5 text-center font-mono text-[9px] tracking-[0.12em] text-mut uppercase">
        {running}/{total} rodando
      </div>
    </div>
  );
}


export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-shell text-ink">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b-2 border-info/30 bg-deep px-4">
        <img
          src={leoLogo.url}
          alt="Leo S.A."
          width={140}
          height={48}
          className="h-10 w-auto shrink-0 object-contain"
        />
        <h1 className="flex-1 text-center text-[20px] leading-none font-bold tracking-[0.14em] uppercase text-ink">
          Gerenciador de Manutenção
        </h1>
        <div className="flex w-[212px] shrink-0 items-center justify-end gap-3">
          <Clock />
          <span className="size-8 shrink-0 rounded-full bg-info/70 ring-2 ring-info/30" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[212px] shrink-0 flex-col border-r border-line/70 bg-deep">
          <LineHealth />
          <nav className="space-y-1 px-2 pt-1">

            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="flex items-center gap-3 rounded-md px-3 py-3 text-mut hover:bg-raised/60 hover:text-ink data-[status=active]:border-l-2 data-[status=active]:border-l-info data-[status=active]:bg-raised data-[status=active]:text-ink data-[status=active]:ring-1 data-[status=active]:ring-info/25 data-[status=active]:ring-inset"
              >
                <item.icon className="size-4 shrink-0" />
                <span className="font-mono text-[12px] tracking-[0.14em] uppercase">
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto">
            {aside}
            <div className="m-2 rounded-md bg-panel-2 p-2.5 ring-1 ring-line/70">
              <div className="font-mono text-[9px] tracking-[0.14em] text-dim uppercase">
                Powered by
              </div>
              <img
                src={plControlsLogo.url}
                alt="P.L. Controls & Automation"
                width={180}
                height={95}
                className="mx-auto mt-1 h-14 w-auto object-contain"
              />
            </div>
          </div>

        </aside>
        {children}
      </div>
    </div>
  );
}
