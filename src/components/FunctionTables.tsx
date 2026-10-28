import { memo } from 'react';
import { ArrowLeft, ChevronRight, ListTree, History } from 'lucide-react';
import type { FunctionRow, FunctionSummary, MetricKey } from '../metrics';

const COLUMNS: { key: MetricKey; label: string }[] = [
  { key: 'cpu_instructions', label: 'CPU instructions' },
  { key: 'read_bytes', label: 'Read bytes' },
  { key: 'write_bytes', label: 'Write bytes' },
  { key: 'read_entries', label: 'All entries' },
  { key: 'write_entries', label: 'Read-write entries' },
];

const integer = new Intl.NumberFormat('en-US');

function formatValue(value: number | null): string {
  return value === null ? 'not reported' : integer.format(value);
}

function formatChange(change: number | null): string | null {
  if (change === null) return null;
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return '±0%';
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function formatCommit(commit: string): string {
  return commit === '' ? 'not recorded' : commit;
}

function formatCap(pct: number | null): string {
  return pct === null ? 'not recorded' : `${pct}%`;
}

const th = 'px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#00ff9d]/70 whitespace-nowrap';
const td = 'px-4 py-3 text-xs whitespace-nowrap';

function MetricCell({ row, metric }: { row: FunctionRow; metric: MetricKey }) {
  const value = row.values[metric];
  const change = formatChange(row.changePct[metric]);
  const up = (row.changePct[metric] ?? 0) > 0;
  return (
    <td className={`${td} text-right ${value === null ? 'text-[#00ff9d]/40' : 'text-white'}`}>
      {formatValue(value)}
      {change && (
        // The sign carries the direction; color only repeats it.
        <span className={`ml-2 ${up ? 'text-[#ff0080]' : 'text-[#00ff9d]/60'}`}>{change}</span>
      )}
    </td>
  );
}

interface FunctionsTableProps {
  summaries: FunctionSummary[];
  onSelect: (name: string) => void;
}

// Latest measurement of every function in the history; each row opens that function's history.
function FunctionsTableView({ summaries, onSelect }: FunctionsTableProps) {
  return (
    <section className="p-6 bg-black/40 border-t border-[#00ff9d]/20" aria-label="Functions">
      <h3 className="text-sm font-bold text-[#00ff9d] uppercase tracking-widest mb-1 flex items-center gap-2">
        <ListTree className="w-4 h-4" /> Functions
      </h3>
      <p className="text-[10px] text-[#00ff9d]/50 uppercase mb-4">
        Latest measurement of each function, with the change since its previous one. Select a function for its full history.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono">
          <thead>
            <tr className="border-b border-[#00ff9d]/20">
              <th className={th} scope="col">Function</th>
              <th className={th} scope="col">Measured at</th>
              {COLUMNS.map(c => <th key={c.key} className={`${th} text-right`} scope="col">{c.label}</th>)}
              <th className={`${th} text-right`} scope="col">Of network cap</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ name, latest, inLatestSnapshot }) => (
              <tr key={name} className="border-b border-[#00ff9d]/10 hover:bg-[#00ff9d]/5">
                <th className={`${td} text-left`} scope="row">
                  <button
                    type="button"
                    onClick={() => onSelect(name)}
                    className="flex items-center gap-1 text-[#00ff9d] font-bold hover:underline"
                    aria-label={`Show history of ${name}`}
                  >
                    {name}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </th>
                <td className={`${td} text-[#00ff9d]/70`}>
                  {formatCommit(latest.commit)}
                  {!inLatestSnapshot && <span className="ml-2 text-[#ff0080] uppercase">not in latest snapshot</span>}
                </td>
                {COLUMNS.map(c => <MetricCell key={c.key} row={latest} metric={c.key} />)}
                <td className={`${td} text-right text-[#00ff9d]/70`}>{formatCap(latest.pctOfNetworkCap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface FunctionHistoryTableProps {
  name: string;
  rows: FunctionRow[];
  onBack: () => void;
}

// Every snapshot's measurement of one function, newest first, so a jump can be traced to its commit.
function FunctionHistoryTableView({ name, rows, onBack }: FunctionHistoryTableProps) {
  const newestFirst = [...rows].reverse();
  return (
    <section className="p-6 bg-black/40 border-t border-[#00ff9d]/20" aria-label={`History of ${name}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#00ff9d] uppercase tracking-widest mb-1 flex items-center gap-2">
            <History className="w-4 h-4" /> History: <span className="normal-case">{name}</span>
          </h3>
          <p className="text-[10px] text-[#00ff9d]/50 uppercase">
            Newest first. Changes are against the previous snapshot that contained this function.
          </p>
        </div>
        <button type="button" onClick={onBack} className="glass-button px-4 py-2 flex items-center gap-2 text-xs whitespace-nowrap">
          <ArrowLeft className="w-4 h-4" /> All functions
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono">
          <thead>
            <tr className="border-b border-[#00ff9d]/20">
              <th className={th} scope="col">Commit</th>
              <th className={th} scope="col">Generated</th>
              {COLUMNS.map(c => <th key={c.key} className={`${th} text-right`} scope="col">{c.label}</th>)}
              <th className={`${th} text-right`} scope="col">Of network cap</th>
            </tr>
          </thead>
          <tbody>
            {newestFirst.map((row, i) => (
              <tr key={`${row.commit}-${i}`} className="border-b border-[#00ff9d]/10">
                <th className={`${td} text-left text-[#00ff9d] font-bold`} scope="row">{formatCommit(row.commit)}</th>
                <td className={`${td} text-[#00ff9d]/70`}>{row.generatedAt ? new Date(row.generatedAt).toLocaleString() : 'not recorded'}</td>
                {row.present ? (
                  <>
                    {COLUMNS.map(c => <MetricCell key={c.key} row={row} metric={c.key} />)}
                    <td className={`${td} text-right text-[#00ff9d]/70`}>{formatCap(row.pctOfNetworkCap)}</td>
                  </>
                ) : (
                  <td className={`${td} text-[#ff0080] uppercase`} colSpan={COLUMNS.length + 1}>Not in this snapshot</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export const FunctionsTable = memo(FunctionsTableView);
export const FunctionHistoryTable = memo(FunctionHistoryTableView);
