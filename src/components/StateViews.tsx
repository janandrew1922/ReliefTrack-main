
import { AlertTriangleIcon, InboxIcon, RefreshCwIcon } from 'lucide-react';

export function LoadingBlock({ label = 'Loading…', rows = 3 }: {label?: string;rows?: number;}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) =>
        <div key={index} className="animate-pulse space-y-2">
            <div className="h-3 w-1/3 rounded bg-gray-100" />
            <div className="h-2.5 w-3/4 rounded bg-gray-100" />
          </div>
        )}
      </div>
    </div>);

}

export function ErrorBlock({ message, onRetry }: {message: string;onRetry?: () => void;}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-rose-800">Could not load this data</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-700">{message}</p>
          {onRetry &&
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100">
            
              <RefreshCwIcon className="h-3.5 w-3.5" /> Try again
            </button>
          }
        </div>
      </div>
    </div>);

}

export function EmptyBlock({ message }: {message: string;}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-8 text-center">
      <InboxIcon className="mx-auto h-6 w-6 text-muted" />
      <p className="mt-2 text-sm text-muted">{message}</p>
    </div>);

}