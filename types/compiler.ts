export interface OptimizerResult {
  ir: string[]
  dependencies: Record<string, number[]>
  batches: number[][]
  sequential: { results: Record<string, number>; time: number }
  parallel: { results: Record<string, number>; time: number }
  normal_output: { stdout: string; stderr: string }
}

export interface HistoryRun {
  id: string
  code: string
  output: string
  status: string
  sequential_time: number | null
  parallel_time: number | null
  speedup: number | null
  stmt_count: number | null
  created_at: string
}

export interface DashboardSummary {
  total_runs: number
  successful_runs: number
  avg_speedup: number | null
  best_speedup: number | null
  avg_sequential_time: number | null
  avg_parallel_time: number | null
  avg_stmt_count: number | null
  last_run_at: string | null
}

export interface DashboardResponse {
  summary: DashboardSummary
  recent_runs: HistoryRun[]
}
