import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ChartPoint, MetricKey } from '../metrics';

export interface MetricSeries {
  key: MetricKey;
  name: string;
  color: string;
  // A dashed line tells the series apart without relying on color.
  dashed?: boolean;
}

interface MetricChartProps {
  title: string;
  unit: string;
  data: ChartPoint[];
  series: MetricSeries[];
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function MetricChart({ title, unit, data, series }: MetricChartProps) {
  const reported = data.some(point => series.some(s => point[s.key] !== null));

  return (
    <section className="p-6 bg-black/40 border-t border-[#00ff9d]/20" aria-label={title}>
      <h3 className="text-sm font-bold text-[#00ff9d] uppercase tracking-widest mb-4">
        {title} <span className="text-[#00ff9d]/60 font-normal">({unit})</span>
      </h3>
      {reported ? (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,255,157,0.1)" vertical={false} />
              <XAxis
                dataKey="commit"
                stroke="#00ff9d"
                tick={{ fill: '#00ff9d', fontSize: 10, fontFamily: 'monospace' }}
                tickMargin={12}
                axisLine={{ stroke: '#00ff9d', strokeOpacity: 0.3 }}
                tickLine={false}
              />
              <YAxis
                stroke="#00ff9d"
                tick={{ fill: '#00ff9d', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(value: number) => compact.format(value)}
                axisLine={{ stroke: '#00ff9d', strokeOpacity: 0.3 }}
                tickLine={false}
                tickMargin={12}
                allowDecimals={false}
                label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#00ff9d', fontSize: 10, fontFamily: 'monospace' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(3, 3, 3, 0.9)',
                  border: '1px solid #00ff9d',
                  borderRadius: '0px',
                  padding: '12px',
                  fontFamily: 'monospace'
                }}
                itemStyle={{ color: '#ffffff', padding: '4px 0', fontSize: '12px' }}
                labelStyle={{ color: '#00ff9d', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}
                formatter={(value) => `${Number(value).toLocaleString()} ${unit}`}
                cursor={{ stroke: 'rgba(0,255,157,0.5)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              {series.length > 1 && (
                <Legend
                  wrapperStyle={{ paddingTop: '24px', fontFamily: 'monospace', fontSize: '12px' }}
                  iconType="plainline"
                />
              )}
              {series.map(s => (
                <Line
                  key={s.key}
                  type="step"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  dot={{ r: 4, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: s.color }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-[#00ff9d]/60 uppercase">Not reported in these snapshots.</p>
      )}
    </section>
  );
}

export default MetricChart;
