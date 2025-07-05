export interface RequestResult {
  url: string;
  status: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export function percentile(data: number[], p: number): number {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a - b);
  const index = Math.floor((p / 100) * sorted.length);
  return sorted[index];
}

export function average(data: number[]): number {
  return data.length ? data.reduce((a, b) => a + b, 0) / data.length : 0;
} 