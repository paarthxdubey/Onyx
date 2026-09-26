import { TrendingUp, Terminal } from 'lucide-react'
import { TrajectoryChart } from './trajectory-chart'
import { Attempt } from '@/types'

interface TargetResponseProps {
  attempt: Attempt | null
  turn?: number
  trajectoryPoints: number[]
  trajectoryTrend: string
}

export function TargetResponse({
  attempt,
  turn,
  trajectoryPoints,
  trajectoryTrend,
}: TargetResponseProps) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
        Target response
      </h2>

      {attempt ? (
        <div className="glass-inset rounded-xl p-4">
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-faint">
            turn {turn ?? 1}
          </span>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
            {attempt.targetResponse}
          </p>
        </div>
      ) : (
        <div className="glass-inset flex flex-col items-center justify-center gap-2.5 rounded-xl p-8 text-center">
          <Terminal className="size-5 text-faint" aria-hidden="true" />
          <p className="text-[12.5px] text-faint">
            The target model's response will appear here once you run an attempt.
          </p>
        </div>
      )}

      <div className="glass rounded-xl p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">compliance trend, last 6 turns</span>
          {trajectoryPoints.length > 0 && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-accent">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              {trajectoryTrend}
            </span>
          )}
        </div>
        {trajectoryPoints.length > 0 ? (
          <TrajectoryChart points={trajectoryPoints} trend={trajectoryTrend} />
        ) : (
          <p className="py-4 text-center text-[11.5px] text-faint">
            No attempts logged yet this session — the trend line will build up as you run attacks.
          </p>
        )}
      </div>
    </section>
  )
}