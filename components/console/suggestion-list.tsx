// Renders the "similar past attempts" list returned by GET /api/suggestions.
// Purely presentational — fetching/debouncing lives in AttackComposer.

import { Suggestion } from "@/types";

interface SuggestionListProps {
  suggestions: Suggestion[];
  isLoading: boolean;
  onSelect: (suggestion: Suggestion) => void;
}

export const SuggestionList = ({
  suggestions,
  isLoading,
  onSelect,
}: SuggestionListProps) => {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Searching past attempts…</p>;
  }

  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No similar attempts yet — tag your prompt or keep typing.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {suggestions.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onSelect(s)}
            className="w-full text-left rounded-md border p-2 hover:bg-muted transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm line-clamp-2">{s.prompt}</span>
              <span className="text-xs font-mono shrink-0">
                {s.historicalSuccessRate}%
              </span>
            </div>
            {s.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {s.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] rounded bg-muted px-1.5 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};