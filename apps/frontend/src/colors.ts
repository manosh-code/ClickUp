export const BOARD_COLORS = ["#1f3a5f", "#0f5f5a", "#6e3b2e", "#5c3d6e", "#2f5d3a", "#3e4c5a"] as const;

export function isLightColor(hex: string): boolean {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62;
}
