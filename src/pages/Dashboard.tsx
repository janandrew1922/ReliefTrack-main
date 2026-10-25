
import { AlertBanner } from '../components/AlertBanner';
import { KpiCards } from '../components/KpiCards';
import { OperationsPanel } from '../components/OperationsPanel';
import { DonationChart } from '../components/DonationChart';
import { RepackShifts } from '../components/RepackShifts';
import { LogisticsTable } from '../components/LogisticsTable';
import { DistributionMix } from '../components/DistributionMix';
import { ActivityFeed } from '../components/ActivityFeed';
import { ReliefMap } from '../components/ReliefMap';
import { ErrorBlock, LoadingBlock } from '../components/StateViews';
import { getDashboard } from '../services/reliefService';
import { useResource } from '../hooks/useResource';

export function Dashboard({ onOperationChanged }: { onOperationChanged?: () => void }) {
  const { data, loading, error, reload } = useResource(getDashboard);

  return (
    <div className="max-w-[1400px] space-y-5 p-5 md:p-7">
      {loading && <LoadingBlock label="Loading operations overview" rows={4} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data &&
      <>
          <AlertBanner alerts={data.alerts} />
          <KpiCards kpis={data.kpis} />
        </>
      }

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <ReliefMap heightClassName="h-[400px]" showVehicles />
          {data && <DonationChart trend={data.donationTrend} />}
          <OperationsPanel onChanged={onOperationChanged ?? reload} />
        </div>
        <div className="space-y-5">
          <RepackShifts />
          {data && <DistributionMix mix={data.categoryMix} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LogisticsTable />
        </div>
        {data && <ActivityFeed activity={data.activity} />}
      </div>
    </div>);

}
