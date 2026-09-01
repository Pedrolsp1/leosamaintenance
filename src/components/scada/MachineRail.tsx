import {
  STATE_DOT,
  STATE_LABEL,
  STATE_TEXT,
  type Machine,
  type MachineState,
} from "@/lib/scada";

interface Props {
  machines: Machine[];
  states: Record<string, MachineState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  lineHealth: number;
}

export function MachineRail({ machines, states, selectedId, onSelect, lineHealth }: Props) {
  return (
    <aside className="w-[236px] shrink-0 border-r border-line/70 bg-deep">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-2.5 border-b border-line/60 bg-deep/95 px-4">
        <div className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-info/80 to-info/20 ring-1 ring-info/40">
          <span className="font-mono text-[11px] font-semibold text-deep">S</span>
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">SAWLINE SCADA</div>
          <div className="font-mono text-[10px] tracking-[0.08em] text-mut">PANEL SAW CELL</div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2">
        <div className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
          Machines · {machines.length}
        </div>
        <nav className="mt-2 space-y-1">
          {machines.map((m) => {
            const state = states[m.id] ?? "idle";
            const active = m.id === selectedId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                className={
                  active
                    ? "flex w-full items-center gap-3 rounded-md border-l-2 border-l-run bg-raised px-2.5 py-2.5 text-left ring-1 ring-line ring-inset"
                    : "flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left hover:bg-raised/50"
                }
              >
                <span className={`size-2.5 shrink-0 rounded-full ${STATE_DOT[state]}`} />
                <span className="flex-1">
                  <span className="block text-[13px] leading-tight font-medium">{m.name}</span>
                  <span className="block font-mono text-[11px] leading-tight text-mut">
                    {m.code} · {m.line}
                  </span>
                </span>
                <span className={`font-mono text-[10px] ${STATE_TEXT[state]}`}>
                  {STATE_LABEL[state]}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mx-3 mt-3 rounded-md bg-panel-2 p-3 ring-1 ring-line/60">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">Line health</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl leading-none font-semibold">
            {Math.round(lineHealth)}%
          </span>
          <span className="text-[11px] text-mut">machines running</span>
        </div>
      </div>
    </aside>
  );
}
