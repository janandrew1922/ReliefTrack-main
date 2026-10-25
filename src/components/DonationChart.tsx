
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { TrendPoint } from '../types/domain';

export function DonationChart({ trend }: {trend: TrendPoint[];}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-bold text-ink">Donations this week</h2>
          <p className="text-xs text-muted mt-0.5">Cash vs. in-kind goods (₱ thousands)</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-700" /> Cash
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-400" /> Goods
          </span>
        </div>
      </div>

      <div className="h-56 mt-4 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f766e" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="goodsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5eead4" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#5eead4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef3f1" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5b716d' }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5b716d' }} width={36} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e3ebe8',
                fontSize: 12,
                boxShadow: '0 8px 24px rgba(15,46,42,0.08)'
              }} />
            
            <Area type="monotone" dataKey="cash" stroke="#0f766e" strokeWidth={2.5} fill="url(#cashFill)" />
            <Area type="monotone" dataKey="goods" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#goodsFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>);

}