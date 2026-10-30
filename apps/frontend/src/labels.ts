export const LABELS = [
  { id: "bug", name: "Bug", color: "#c44848" },
  { id: "feature", name: "Feature", color: "#2f7d4a" },
  { id: "design", name: "Design", color: "#7a4ea3" },
  { id: "urgent", name: "Urgent", color: "#d9782d" },
] as const;

const BY_ID = new Map<string, (typeof LABELS)[number]>(LABELS.map((label) => [label.id, label]));

export function labelById(id: string) {
  return BY_ID.get(id);
}
