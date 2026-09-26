'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HistoryRow {
  turn: number
  technique: string
  score: number
  time: string
}

interface LeaderboardRow {
  cat: string
  pct: number
}

interface SessionDrawerProps {
  history: HistoryRow[]
  leaderboard: LeaderboardRow[]
}

export function SessionDrawer({ history, leaderboard }: SessionDrawerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="glass rounded-none border-x-0 border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-3 text-left font-mono text-[11.5px] text-muted-foreground transition-colors hover:text-foreground md:px-6"
      >
        <ChevronRight
          className={cn('size-3.5 transition-transform', open && 'rotate-90')}
          aria-hidden="true"
        />
        session history &amp; technique leaderboard
      </button>

      {open && (
        <div className="grid gap-8 px-5 pb-6 pt-1 md:grid-cols-[1.4fr_1fr] md:px-6">
          <div>
            {history.length === 0 ? (
              <p className="text-xs text-faint py-4">No attempts logged yet.</p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {['turn', 'technique', 'score', 'time'].map((h) => (
                      <th
                        key={h}
                        className="border-b border-border px-2 py-2 text-left font-mono text-[10.5px] font-normal uppercase tracking-wide text-faint"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.turn} className="transition-colors hover:bg-panel-raised/40">
                      <td className="border-b border-border/60 px-2 py-2 font-mono text-muted-foreground">
                        {row.turn}
                      </td>
                      <td className="border-b border-border/60 px-2 py-2 text-muted-foreground">
                        {row.technique}
                      </td>
                      <td className="border-b border-border/60 px-2 py-2 font-mono text-accent tabular-nums">
                        {row.score}%
                      </td>
                      <td className="border-b border-border/60 px-2 py-2 font-mono text-faint">
                        {row.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {leaderboard.length === 0 ? (
              <p className="text-xs text-faint">No leaderboard data yet.</p>
            ) : (
              leaderboard.map((row) => (
                <div key={row.cat} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{row.cat}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-raised">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${row.pct}%` }}
                    />
                  </span>
                  <span className="w-8 text-right font-mono text-[11px] text-faint tabular-nums">
                    {row.pct}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}