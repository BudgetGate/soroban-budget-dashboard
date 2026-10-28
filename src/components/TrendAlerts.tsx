import { memo } from 'react';
import { TrendingUp, CheckCircle2 } from 'lucide-react';
import { CAP_HORIZON_COMMITS, CAP_WARNING_PCT, CAP_WINDOW, CREEP_RISES, CREEP_TOTAL_PCT } from '../trends';
import type { CapTrend, CreepTrend, Trend } from '../trends';
import type { MetricKey } from '../metrics';

const METRIC_LABELS: Record<MetricKey, string> = {
  cpu_instructions: 'CPU instructions',
  read_bytes: 'Read bytes',
  write_bytes: 'Write bytes',
  read_entries: 'All entries',
  write_entries: 'Read-write entries',
};

const integer = new Intl.NumberFormat('en-US');
const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

function CapLine({ trend }: { trend: CapTrend }) {
  const latest = trend.recent[trend.recent.length - 1];
  return (
    <>
      <p>
        Share of network cap {oneDecimal(latest)}%:{' '}
        {trend.commitsToWarning === 0
          ? `at or above ${CAP_WARNING_PCT}%`
          : `projected to reach ${CAP_WARNING_PCT}% in about ${trend.commitsToWarning} commit${trend.commitsToWarning === 1 ? '' : 's'} (+${oneDecimal(trend.slope)} points per commit)`}
      </p>
      <p className="text-[#00ff9d]/50">Last {trend.recent.length}: {trend.recent.map(p => `${oneDecimal(p)}%`).join(', ')}</p>
    </>
  );
}

function CreepLine({ trend }: { trend: CreepTrend }) {
  return (
    <>
      <p>
        {METRIC_LABELS[trend.metric]} rose in each of the last {trend.values.length - 1} measurements, +{oneDecimal(trend.totalPct)}% in total
        {trend.largestStepPct <= CREEP_TOTAL_PCT && ` (no single step above ${CREEP_TOTAL_PCT}%)`}
      </p>
      <p className="text-[#00ff9d]/50">
        {trend.values.map((v, i) => `${integer.format(v)} (${trend.commits[i] || 'no commit'})`).join(' → ')}
      </p>
    </>
  );
}

interface TrendAlertsProps {
  trends: Trend[];
  capRuleApplies: boolean;
  onSelect: (name: string) => void;
}

// Functions trending toward a network cap or creeping up over several commits, which the
// single-commit regression card cannot see.
function TrendAlerts({ trends, capRuleApplies, onSelect }: TrendAlertsProps) {
  const flagged = trends.length > 0;
  return (
    <section
      aria-label="Trend alerts"
      className={`glass-panel p-6 mb-8 font-mono ${flagged ? 'border border-[#ff0080] bg-[#ff0080]/5' : 'border border-[#00ff9d]/30'}`}
    >
      <div className={`flex items-center gap-2 mb-4 ${flagged ? 'text-[#ff0080]' : 'text-[#00ff9d]'}`}>
        {flagged ? <TrendingUp className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        <h2 className="text-sm font-bold tracking-widest uppercase">Trend alerts</h2>
      </div>
      {flagged ? (
        <ul className="space-y-4">
          {trends.map(t => (
            <li key={`${t.name}-${t.kind}-${t.kind === 'creep' ? t.metric : ''}`} className="text-xs text-[#00ff9d]/80 leading-relaxed border-l-2 border-[#ff0080] pl-3">
              <button
                type="button"
                onClick={() => onSelect(t.name)}
                className="text-[#ff0080] font-bold hover:underline mb-1"
                aria-label={`Show history of ${t.name}`}
              >
                ▲ {t.name}
              </button>
              {t.kind === 'cap' ? <CapLine trend={t} /> : <CreepLine trend={t} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[#00ff9d]/80">No function is trending toward a cap or creeping up.</p>
      )}
      <p className="text-[10px] text-[#00ff9d]/50 uppercase mt-4 leading-relaxed">
        Rules: a line through the share of network cap over the last {CAP_WINDOW} measurements, alerting when it reaches {CAP_WARNING_PCT}% within {CAP_HORIZON_COMMITS} commits; creep is a metric that rose in each of the last {CREEP_RISES} measurements and by {CREEP_TOTAL_PCT}% or more in total.
        {!capRuleApplies && ` The cap rule needs ${CAP_WINDOW} measurements with a network-cap figure, which no function has here.`}
      </p>
    </section>
  );
}

export default memo(TrendAlerts);
