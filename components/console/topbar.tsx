import { ShieldHalf, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SessionPicker } from '@/components/console/session-picker'
import { Attempt } from '@/types'

// TODO: duplicated across topbar.tsx, session-picker.tsx, and app/page.tsx —
// consolidate into types/index.ts once that file's current contents are confirmed.
interface SessionSummary {
  sessionId: string
  label: string
  targetModel: string
  createdAt: string
  attemptCount: number
}

interface TopbarProps {
  sessions: SessionSummary[]
  currentSessionId: string | null
  currentTargetModel: string | null
  currentAttempt: Attempt | null
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
  onRenameSession: (sessionId: string, label: string) => void
  onDeleteSession: (sessionId: string) => void
  isCreatingSession?: boolean
}

export function Topbar({
  sessions,
  currentSessionId,
  currentTargetModel,
  currentAttempt,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  isCreatingSession,
}: TopbarProps) {
  const judgeCount = currentAttempt?.judgeResults.length ?? null
  const reasoningSource = currentAttempt?.reasoning_source ?? null

  return (
    <header className="glass flex flex-wrap items-center justify-between gap-4 rounded-none border-x-0 border-t-0 px-5 py-3.5 md:px-6">
      <div className="flex items-center gap-4">
        <div className="flex size-9 items-center justify-center rounded-lg border border-border-strong bg-panel-solid text-accent">
          <ShieldHalf className="size-4.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <SessionPicker
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={onSelectSession}
              onCreateSession={onCreateSession}
              onRenameSession={onRenameSession}
              onDeleteSession={onDeleteSession}
              isCreating={isCreatingSession}
            />
            <span className="inline-block size-1 rounded-full bg-faint" aria-hidden="true" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
              live
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Cpu className="size-3.5 text-faint" aria-hidden="true" />
            <span className="font-medium">{currentTargetModel ?? '—'}</span>
          </div>
        </div>
      </div>

      {reasoningSource ? (
        <div
          className={cn(
            'group flex items-center gap-2.5 rounded-lg border px-3 py-2',
            reasoningSource === 'native'
              ? 'border-[oklch(0.74_0.09_185_/_0.35)] bg-ok-soft'
              : 'border-border-strong bg-panel-solid'
          )}
          title={
            reasoningSource === 'native'
              ? "This turn's target model exposed genuine reasoning tokens — the trace is the model's own generated reasoning, not a proxy."
              : "This turn's target model does not expose reasoning tokens, so the trace is judge-LLM narration, not the model's own thoughts."
          }
        >
          <span className="relative flex size-2">
            {reasoningSource === 'native' && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
            )}
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                reasoningSource === 'native' ? 'bg-ok' : 'bg-faint'
              )}
            />
          </span>
          <span
            className={cn(
              'font-mono text-xs',
              reasoningSource === 'native' ? 'text-ok' : 'text-muted-foreground'
            )}
          >
            reasoning_source: {reasoningSource}
          </span>
          {judgeCount !== null && (
            <span className="border-l border-border-strong pl-2.5 text-[11px] text-muted-foreground">
              {judgeCount} judge{judgeCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-panel-solid px-3 py-2">
          <span className="font-mono text-[11px] text-faint">
            reasoning_source: — · run an attempt to populate
          </span>
        </div>
      )}
    </header>
  )
}