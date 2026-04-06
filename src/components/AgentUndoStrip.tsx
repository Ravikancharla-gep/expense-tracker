import { X } from 'lucide-react';
import type { AgentUndo } from '../hooks/useExpenseStore';
import { formatRupeesFull } from '../utils/format';

type Props = {
  items: AgentUndo[];
  /** Newest item id — highlighted briefly after add */
  highlightId?: string | null;
  onRemove: (u: AgentUndo) => void;
  resolveAmount?: (u: AgentUndo) => number | undefined;
  maskNumbers?: boolean;
};

function formatQuickLine(u: AgentUndo, amount: number | undefined, mask: boolean): string {
  const amt = mask ? '***' : formatRupeesFull(amount ?? 0);
  if (u.kind === 'income') {
    return `Income: ${u.label} — ${amt}`;
  }
  const cat = u.category ?? 'Other';
  return `${cat}: ${u.label} — ${amt}`;
}

export function AgentUndoStrip({ items, highlightId, onRemove, resolveAmount, maskNumbers = false }: Props) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
        Recent quick adds
      </p>
      <ul className="mt-2 flex flex-wrap items-center gap-2">
        {items.map((u) => {
          const amt = resolveAmount?.(u);
          const line = formatQuickLine(u, amt, maskNumbers);
          const isNew = highlightId === u.id;
          return (
            <li
              key={`${u.kind}-${u.id}`}
              className={`inline-flex max-w-full items-center gap-1 rounded-lg border py-1 pl-2 pr-1 text-[11px] leading-tight text-ink-200 transition ${
                isNew
                  ? 'border-teal-400/50 bg-teal-500/20 shadow-[0_0_16px_-6px_rgba(45,212,191,0.45)]'
                  : 'border-white/10 bg-ink-900/80'
              }`}
            >
              <span className="max-w-[min(100%,14rem)] truncate sm:max-w-[18rem]">{line}</span>
              <button
                type="button"
                onClick={() => onRemove(u)}
                className="shrink-0 rounded p-1 text-ink-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                title="Remove entry"
                aria-label="Remove entry"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
