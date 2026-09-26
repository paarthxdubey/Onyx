"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/console/topbar";
import { AttackComposer } from "@/components/console/attack-composer";
import { TargetResponse } from "@/components/console/target-response";
import { Scorecard } from "@/components/console/scorecard";
import { SessionDrawer } from "@/components/console/session-drawer";
import { Attempt } from "@/types";

const TRAJECTORY_WINDOW = 6;
const DEFAULT_TARGET_MODEL = "gemini-2.5-flash";

interface HistoryRow {
  turn: number;
  technique: string;
  score: number;
  time: string;
}

interface LeaderboardRow {
  cat: string;
  pct: number;
}

// TODO: duplicated across page.tsx, topbar.tsx, session-picker.tsx —
// consolidate into types/index.ts once that file's current contents are confirmed.
interface SessionSummary {
  sessionId: string;
  label: string;
  targetModel: string;
  createdAt: string;
  attemptCount: number;
}

export default function Page() {
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [targetModel, setTargetModel] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const [currentAttempt, setCurrentAttempt] = useState<Attempt | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const createSession = useCallback(
    async (model: string = DEFAULT_TARGET_MODEL) => {
      setIsCreatingSession(true);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetModel: model }),
        });
        const created: SessionSummary = await res.json();
        setSessions((prev) => [created, ...prev]);
        setSessionId(created.sessionId);
        setTargetModel(created.targetModel);
        setCurrentAttempt(null);
        router.replace(`/?session=${created.sessionId}`, { scroll: false });
      } catch (err) {
        console.error("Failed to create session:", err);
      } finally {
        setIsCreatingSession(false);
      }
    },
    [router]
  );

  const selectSession = useCallback(
    (id: string) => {
      const found = sessions.find((s) => s.sessionId === id);
      if (!found) return;
      setSessionId(found.sessionId);
      setTargetModel(found.targetModel);
      setCurrentAttempt(null);
      router.replace(`/?session=${found.sessionId}`, { scroll: false });
    },
    [sessions, router]
  );

  const renameSession = useCallback(async (id: string, label: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error(`Rename failed with status ${res.status}`);
      const updated: SessionSummary = await res.json();
      setSessions((prev) => prev.map((s) => (s.sessionId === id ? updated : s)));
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Delete failed with status ${res.status}`);

        const remaining = sessions.filter((s) => s.sessionId !== id);
        setSessions(remaining);

        if (id === sessionId) {
          // The active session was just deleted — fall back to the next
          // most recent remaining session, or spin up a fresh one if none left.
          if (remaining.length > 0) {
            selectSession(remaining[0].sessionId);
          } else {
            await createSession();
          }
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [sessions, sessionId, selectSession, createSession]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/sessions");
        const data = await res.json();
        const list: SessionSummary[] = data.sessions ?? [];
        if (cancelled) return;
        setSessions(list);

        const fromUrl = new URLSearchParams(window.location.search).get("session");
        const match = fromUrl ? list.find((s) => s.sessionId === fromUrl) : undefined;

        if (match) {
          setSessionId(match.sessionId);
          setTargetModel(match.targetModel);
        } else {
          await createSession();
        }
      } catch (err) {
        console.error("Failed to load sessions:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchHistoryAndLeaderboard = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [historyRes, leaderboardRes] = await Promise.all([
        fetch(`/api/history?sessionId=${sessionId}`),
        fetch("/api/leaderboard"),
      ]);
      const historyData = await historyRes.json();
      const leaderboardData = await leaderboardRes.json();
      setHistory(historyData.history ?? []);
      setLeaderboard(leaderboardData.leaderboard ?? []);
    } catch (err) {
      console.error("Failed to refresh history/leaderboard:", err);
    }
  }, [sessionId]);

  useEffect(() => {
    refetchHistoryAndLeaderboard();
  }, [refetchHistoryAndLeaderboard]);

  const handleAttemptComplete = (attempt: Attempt) => {
    setCurrentAttempt(attempt);
    refetchHistoryAndLeaderboard();
    setSessions((prev) =>
      prev.map((s) =>
        s.sessionId === sessionId ? { ...s, attemptCount: s.attemptCount + 1 } : s
      )
    );
  };

  const trajectoryPoints = history.slice(-TRAJECTORY_WINDOW).map((h) => h.score);
  const trajectoryTrend =
    trajectoryPoints.length >= 2
      ? `${
          trajectoryPoints[trajectoryPoints.length - 1] - trajectoryPoints[0] >= 0 ? "+" : ""
        }${trajectoryPoints[trajectoryPoints.length - 1] - trajectoryPoints[0]}%`
      : "—";

  return (
    <main className="grain flex min-h-screen flex-col">
      <Topbar
        sessions={sessions}
        currentSessionId={sessionId}
        currentTargetModel={targetModel}
        currentAttempt={currentAttempt}
        onSelectSession={selectSession}
        onCreateSession={() => createSession()}
        onRenameSession={renameSession}
        onDeleteSession={deleteSession}
        isCreatingSession={isCreatingSession}
      />

      <div className="flex-1 p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[300px_1fr_300px]">
          <div className="glass rounded-2xl p-5">
            {sessionId ? (
              <AttackComposer
                sessionId={sessionId}
                targetModel={targetModel ?? DEFAULT_TARGET_MODEL}
                onAttemptComplete={handleAttemptComplete}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Setting up a session…</p>
            )}
          </div>
          <div className="glass rounded-2xl p-5">
            <TargetResponse
              attempt={currentAttempt}
              turn={history.length}
              trajectoryPoints={trajectoryPoints}
              trajectoryTrend={trajectoryTrend}
            />
          </div>
          <div className="glass rounded-2xl p-5">
            <Scorecard attempt={currentAttempt} />
          </div>
        </div>
      </div>

      <SessionDrawer history={history} leaderboard={leaderboard} />
    </main>
  );
}