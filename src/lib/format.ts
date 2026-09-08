export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  const digits = amount >= 100 || index === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${units[index]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(unixSeconds * 1000));
}

export function shortPath(path: string, max = 58): string {
  if (path.length <= max) return path;
  const head = path.slice(0, Math.floor(max * 0.44));
  const tail = path.slice(-Math.floor(max * 0.44));
  return `${head}…${tail}`;
}
