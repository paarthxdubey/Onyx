// Tag vocabulary for the composer's tag picker, mirrored from
// data/seed-techniques.json's 7 categories. Kept as a static client-side
// list rather than fetched from /api/techniques — no such endpoint exists
// yet, and this list changes rarely enough that hardcoding is the
// "not too complex" call. Revisit if the taxonomy grows past v1.

export const TECHNIQUE_TAG_GROUPS: { category: string; tags: string[] }[] = [
    {
      category: "Persona Manipulation",
      tags: ["persona-override", "jailbreak-classic", "alter-ego", "authority-claim", "fake-mode", "logic-trick"],
    },
    {
      category: "Role-Play / Fictional Framing",
      tags: ["role-play", "emotional-appeal", "fictional-wrapper", "narrative", "virtualization", "layered-framing"],
    },
    {
      category: "Encoding & Obfuscation",
      tags: ["encoding", "obfuscation", "filter-evasion", "token-smuggling", "translation", "language-switching"],
    },
    {
      category: "Prompt Injection",
      tags: ["prompt-injection", "instruction-override", "indirect", "tool-use-risk", "system-prompt-leak", "formatting-trick"],
    },
    {
      category: "Context Manipulation",
      tags: ["hypothetical-framing", "academic-framing", "multi-turn", "escalation", "context-manipulation", "many-shot", "in-context-learning", "distraction", "competing-objectives", "format-coercion"],
    },
    {
      category: "Output Coercion",
      tags: ["output-coercion", "refusal-suppression", "format-coercion", "payload-splitting", "fragmentation", "filter-evasion"],
    },
    {
      category: "Authority & Social Engineering",
      tags: ["authority-claim", "social-engineering", "urgency"],
    },
  ];