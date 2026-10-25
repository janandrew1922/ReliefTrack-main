
import { CheckIcon, LoaderIcon } from 'lucide-react';
import { donationStageLabel, stageOrder } from '../../data/staticContent';
import type { TrackedDonation, TrackStage } from '../../types/domain';

export function DonationTimeline({ donation }: {donation: TrackedDonation;}) {
  const currentIndex = stageOrder.indexOf(donation.stage);
  const updateFor = (stage: TrackStage) => [...donation.updates].reverse().find((update) => update.stage === stage);

  return (
    <ol>
      {stageOrder.map((stage, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const update = updateFor(stage);
        const isLast = index === stageOrder.length - 1;

        return (
          <li key={stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                done ?
                'bg-brand-700 text-white' :
                current ?
                'bg-brand-100 text-brand-800 ring-2 ring-brand-600' :
                'bg-gray-100 text-gray-400'}`
                }>
                
                {done ? <CheckIcon className="h-4 w-4" /> : current ? <LoaderIcon className="h-4 w-4" /> : index + 1}
              </span>
              {!isLast && <span className={`my-1 w-px flex-1 ${done ? 'bg-brand-600' : 'bg-line'}`} />}
            </div>

            <div className={`min-w-0 ${isLast ? 'pb-0' : 'pb-6'}`}>
              <p className={`text-sm font-semibold ${done || current ? 'text-ink' : 'text-muted'}`}>
                  {donationStageLabel(stage, donation.type)}
              </p>
              {update ?
              <>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{update.message}</p>
                  {update.location && <p className="mt-1 text-xs font-semibold text-brand-700">Last checkpoint: {update.location}</p>}
                  <p className="mt-1 text-[11px] font-medium text-muted">{update.time}</p>
                </> :

              <p className="mt-1 text-xs text-muted">Waiting for this step.</p>
              }
              {current &&
              <span className="mt-2 inline-block rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700">
                  Happening now
                </span>
              }
            </div>
          </li>);

      })}
    </ol>);

}
