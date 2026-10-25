
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { categoryPalette } from '../data/staticContent';
import type { CategorySlice } from '../types/domain';

export function DistributionMix({ mix }: {mix: CategorySlice[];}) {
  const slices = mix ?? [];
  const total = slices.reduce((sum, slice) => sum + slice.quantity, 0);

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-sm font-bold text-ink">Donations by category</h2>
      <p className="mt-0.5 text-xs text-muted">Quantities recorded in donation items</p>

      {total === 0 ?
      <p className="mt-6 text-sm text-muted">No donated goods recorded yet.</p> :

      <>
          <div className="relative mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                data={slices}
                dataKey="quantity"
                nameKey="category"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={2}
                stroke="none">
                
                  {slices.map((slice, index) =>
                <Cell key={slice.category} fill={categoryPalette[index % categoryPalette.length]} />
                )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-xl font-extrabold text-ink">{total.toLocaleString()}</p>
                <p className="text-[11px] text-muted">items donated</p>
              </div>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {slices.map((slice, index) =>
          <li key={slice.category} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-muted">
                  <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: categoryPalette[index % categoryPalette.length] }} />
              
                  {slice.category}
                </span>
                <span className="font-semibold text-ink">{slice.quantity.toLocaleString()}</span>
              </li>
          )}
          </ul>
        </>
      }
    </section>);

}