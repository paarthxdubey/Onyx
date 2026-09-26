"use client";

import { useEffect, useState } from "react";
import { Suggestion, Attempt } from "@/types";
import { SuggestionList } from "@/components/console/suggestion-list";
import { TECHNIQUE_TAG_GROUPS } from "@/components/console/technique-tags";

interface AttackComposerProps {
  sessionId: string;
  targetModel?: string;
  onAttemptComplete: (attempt: Attempt) => void;
}

const DEBOUNCE_MS = 500;

export const AttackComposer = ({
  sessionId,
  targetModel = "gemini-2.5-flash",
  onAttemptComplete,
}: AttackComposerProps) => {
  const [prompt, setPrompt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  useEffect(() => {
    if (prompt.trim().length === 0 && tags.length === 0) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsFetchingSuggestions(true);
      try {
        const params = new URLSearchParams();
        if (tags.length > 0) params.set("tag", tags.join(","));
        if (prompt.trim()) params.set("q", prompt.trim());

        const res = await fetch(`/api/suggestions?${params.toString()}`);
        if (!res.ok) throw new Error("Suggestion fetch failed");
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, tags]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setPrompt(suggestion.prompt);
    setTags(suggestion.tags);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, prompt, tags, targetModel }),
      });

      if (!res.ok) throw new Error(`Attempt failed with status ${res.status}`);

      const attempt: Attempt = await res.json();
      onAttemptComplete(attempt);
      setPrompt("");
      setTags([]);
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg">
      <div>
        <label htmlFor="prompt" className="text-sm font-medium">
          Attack prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-md border p-2 text-sm"
          placeholder="Type or paste your prompt injection attempt…"
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Technique tags</p>
        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
          {TECHNIQUE_TAG_GROUPS.map((group) => (
            <div key={group.category}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {group.category}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.tags.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-[10px] rounded px-1.5 py-0.5 border ${
                        active
                          ? "bg-black text-white border-black"
                          : "bg-muted border-transparent hover:border-muted-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Similar past attempts</p>
        <SuggestionList
          suggestions={suggestions}
          isLoading={isFetchingSuggestions}
          onSelect={handleSelectSuggestion}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !prompt.trim()}
        className="rounded-md bg-accent text-white text-sm py-2 font-medium transition-all duration-150 hover:bg-accent/90 active:scale-[0.97] disabled:opacity-50 disabled:hover:bg-accent disabled:active:scale-100"
      >
        {isSubmitting ? "Running attempt…" : "Run attempt"}
      </button>
    </div>
  );
};