"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";

// TODO: duplicated in topbar.tsx and app/page.tsx — consolidate into
// types/index.ts as a shared `SessionSummary` export once that file's
// current contents are confirmed.
interface SessionSummary {
  sessionId: string;
  label: string;
  targetModel: string;
  createdAt: string;
  attemptCount: number;
}

interface SessionPickerProps {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRenameSession: (sessionId: string, label: string) => void;
  onDeleteSession: (sessionId: string) => void;
  isCreating?: boolean;
}

export function SessionPicker({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  isCreating = false,
}: SessionPickerProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const current = sessions.find((s) => s.sessionId === currentSessionId) ?? null;

  const startRename = () => {
    if (!current) return;
    setRenameValue(current.label);
    setIsRenaming(true);
  };

  const confirmRename = () => {
    const trimmed = renameValue.trim();
    if (current && trimmed && trimmed !== current.label) {
      onRenameSession(current.sessionId, trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => setIsRenaming(false);

  const handleDelete = () => {
    if (!current) return;
    // Cascades to every attempt in this session server-side — see
    // app/api/sessions/[sessionId]/route.ts. Native confirm() is deliberately
    // blunt here since this action is irreversible.
    const confirmed = window.confirm(
      `Delete "${current.label}"? This also deletes all ${current.attemptCount} attempt(s) in it. This cannot be undone.`
    );
    if (confirmed) onDeleteSession(current.sessionId);
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmRename();
            if (e.key === "Escape") cancelRename();
          }}
          className="rounded-md border border-border-strong bg-panel-solid px-2 py-1 font-mono text-[11px] text-muted-foreground"
        />
        <button
          type="button"
          onClick={confirmRename}
          className="rounded-md border border-border-strong bg-panel-solid p-1 text-muted-foreground hover:text-ok"
          aria-label="Confirm rename"
        >
          <Check className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={cancelRename}
          className="rounded-md border border-border-strong bg-panel-solid p-1 text-muted-foreground hover:text-warn"
          aria-label="Cancel rename"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={currentSessionId ?? ""}
        onChange={(e) => onSelectSession(e.target.value)}
        className="rounded-md border border-border-strong bg-panel-solid px-2 py-1 font-mono text-[11px] text-muted-foreground"
        disabled={sessions.length === 0}
      >
        {sessions.length === 0 && <option value="">no sessions yet</option>}
        {sessions.map((s) => (
          <option key={s.sessionId} value={s.sessionId}>
            {s.label} · {s.targetModel} · {s.attemptCount} attempts
          </option>
        ))}
      </select>

      {current && (
        <>
          <button
            type="button"
            onClick={startRename}
            className="rounded-md border border-border-strong bg-panel-solid p-1 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            aria-label="Rename session"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md border border-border-strong bg-panel-solid p-1 text-muted-foreground transition-colors hover:border-warn hover:text-warn"
            aria-label="Delete session"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onCreateSession}
        disabled={isCreating}
        className="rounded-md border border-border-strong bg-panel-solid px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {isCreating ? "creating…" : "+ new session"}
      </button>
    </div>
  );
}