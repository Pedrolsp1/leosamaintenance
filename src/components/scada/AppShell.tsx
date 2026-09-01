import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Sinóptico", hint: "Machine overview" },
  { to: "/reports", label: "Reports", hint: "KPIs & availability" },
  { to: "/history", label: "History", hint: "Activity register" },
] as const;

export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="min-h-screen bg-shell text-ink">
      <div className="flex min-h-screen">
        <aside className="flex w-[236px] shrink-0 flex-col border-r border-line/70 bg-deep">
          <div className="flex h-14 items-center gap-2.5 border-b border-line/60 px-4">
            <div className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-info/80 to-info/20 ring-1 ring-info/40">
              <span className="font-mono text-[11px] font-semibold text-deep">S</span>
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight">SAWLINE SCADA</div>
              <div className="font-mono text-[10px] tracking-[0.08em] text-mut">PANEL SAW CELL</div>
            </div>
          </div>

          <nav className="px-3 pt-3">
            <div className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
              Spaces
            </div>
            <div className="mt-2 space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="block rounded-md px-2.5 py-2 hover:bg-raised/50 data-[status=active]:border-l-2 data-[status=active]:border-l-info data-[status=active]:bg-raised data-[status=active]:ring-1 data-[status=active]:ring-line data-[status=active]:ring-inset"
                >
                  <span className="block text-[13px] leading-tight font-medium">{item.label}</span>
                  <span className="block font-mono text-[11px] leading-tight text-mut">
                    {item.hint}
                  </span>
                </Link>
              ))}
            </div>
          </nav>

          {aside}
        </aside>
        {children}
      </div>
    </div>
  );
}
