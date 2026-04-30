"use client"

import Editor from "@monaco-editor/react"
import {
  Activity,
  GitBranch,
  History,
  LogOut,
  Play,
  RefreshCw,
  SearchCode,
  SquareTerminal,
  Terminal,
  Trash2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { editor } from "monaco-editor"
import toast from "react-hot-toast"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Drawer,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerContent,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"
import { Drawervalue } from "@/components/store"
import type { DashboardResponse, HistoryRun, OptimizerResult } from "@/types/compiler"

const API_BASE_URL = "/api/backend"
const DEFAULT_CODE = `#include <stdio.h>

int main() {
    int a = 5 + 3;
    printf("%d\\n", a);
    return 0;
}
`

const surfaceClass =
  "rounded-[32px] border border-white/70 bg-white/72 shadow-[0_24px_70px_rgba(148,163,184,0.16)] backdrop-blur-2xl"
const insetSurfaceClass =
  "rounded-[24px] border border-slate-200/80 bg-slate-50/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
const codeSurfaceClass =
  "rounded-[26px] border border-slate-900/10 bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
const neutralButtonClass =
  "rounded-full border border-white/80 bg-white/80 text-slate-700 shadow-[0_10px_30px_rgba(148,163,184,0.14)] hover:bg-white hover:text-slate-950"
const primaryButtonClass =
  "rounded-full border border-slate-900 bg-slate-900 text-white shadow-[0_16px_34px_rgba(15,23,42,0.22)] hover:bg-slate-800"
const dangerButtonClass =
  "rounded-full border border-rose-200 bg-white/80 text-rose-600 shadow-[0_10px_30px_rgba(244,63,94,0.08)] hover:bg-rose-50 hover:text-rose-700"

function buildHeaders(username: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)

  if (username) {
    headers.set("x-auth-username", username)
  }

  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  return headers
}

async function fetchJson<T>(path: string, username: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: buildHeaders(username, init),
  })

  if (!response.ok) {
    throw new Error(`${path} request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

function formatCount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "--"
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}

function formatSeconds(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "--"
  }

  return `${value.toFixed(value < 1 ? 4 : 2)}s`
}

function formatSpeedup(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "--"
  }

  return `${value.toFixed(2)}x`
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "No runs yet"
  }

  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.valueOf())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(timestamp)
}

function truncatePreview(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}...`
}

function getOutputText(result: OptimizerResult) {
  return [result.normal_output?.stdout, result.normal_output?.stderr].filter(Boolean).join("\n\n")
}

function getOptimizerSpeedup(result: OptimizerResult | null) {
  if (!result || result.parallel.time <= 0) {
    return null
  }

  return result.sequential.time / result.parallel.time
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/75 bg-white/82 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl">
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={cn(surfaceClass, "p-6 sm:p-7")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[1.4rem] font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function RunStatus({ status }: { status: string }) {
  const isSuccess = status === "success"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      {isSuccess ? "Success" : "Error"}
    </span>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className={cn(insetSurfaceClass, "flex min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center")}>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-[0_12px_30px_rgba(148,163,184,0.14)]">
        {icon}
      </div>
      <p className="mt-4 text-base font-medium tracking-[-0.02em] text-slate-800">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function RecentRunCard({ run }: { run: HistoryRun }) {
  return <RecentRunCardWithActions run={run} />
}

function RecentRunCardWithActions({
  run,
  onDelete,
  deleteDisabled = false,
}: {
  run: HistoryRun
  onDelete?: (run: HistoryRun) => void
  deleteDisabled?: boolean
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-white/75 bg-white/82 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.14)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-950">Run #{run.id}</p>
          <p className="mt-1 text-sm text-slate-500">{formatTimestamp(run.created_at)} UTC</p>
        </div>
        <div className="flex items-center gap-2">
          <RunStatus status={run.status} />
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full border border-rose-200/90 bg-white text-rose-500 shadow-[0_10px_24px_rgba(244,63,94,0.08)] hover:bg-rose-50 hover:text-rose-600"
              onClick={() => onDelete(run)}
              disabled={deleteDisabled}
              aria-label={`Delete run ${run.id}`}
              title="Delete run"
            >
              {deleteDisabled ? <Spinner className="text-rose-500" /> : <Trash2 size={16} />}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className={cn(insetSurfaceClass, "min-w-0 p-3.5")}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Speedup</p>
          <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-emerald-700">{formatSpeedup(run.speedup)}</p>
        </div>
        <div className={cn(insetSurfaceClass, "min-w-0 p-3.5")}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Statements</p>
          <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-900">{formatCount(run.stmt_count)}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Code Preview</p>
          <pre className="mt-2 max-w-full overflow-hidden whitespace-pre-wrap rounded-[20px] border border-slate-200/80 bg-slate-50/90 p-4 font-mono text-[13px] leading-5 text-slate-700 [overflow-wrap:anywhere]">
            {truncatePreview(run.code, 150)}
          </pre>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Output Preview</p>
          <pre className="mt-2 max-w-full overflow-hidden whitespace-pre-wrap rounded-[20px] border border-emerald-100 bg-emerald-50/80 p-4 font-mono text-[13px] leading-5 text-emerald-800 [overflow-wrap:anywhere]">
            {truncatePreview(run.output || "(no output)", 120)}
          </pre>
        </div>
      </div>
    </article>
  )
}

export default function CompilerEditor() {
  const router = useRouter()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const optimizerResult = Drawervalue((value) => value.optimizerResult)
  const setOptimizerResult = Drawervalue((value) => value.setOptimizerResult)

  const [loading, setLoading] = useState(false)
  const [compileOutput, setCompileOutput] = useState("")
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRun[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [runPendingDelete, setRunPendingDelete] = useState<HistoryRun | null>(null)
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<"checking" | "authorized" | "unauthorized">("checking")
  const [viewerUsername, setViewerUsername] = useState("")

  const refreshDashboard = useCallback(
    async (username = viewerUsername) => {
      if (!username) {
        return
      }

      setDashboardLoading(true)
      setDashboardError(null)

      try {
        const data = await fetchJson<DashboardResponse>("/dashboard", username)
        setDashboard(data)
      } catch (error) {
        setDashboardError(error instanceof Error ? error.message : "Could not load dashboard stats.")
      } finally {
        setDashboardLoading(false)
      }
    },
    [viewerUsername],
  )

  const refreshHistory = useCallback(
    async (username = viewerUsername) => {
      if (!username) {
        return
      }

      setHistoryLoading(true)
      setHistoryError(null)

      try {
        const data = await fetchJson<HistoryRun[]>("/history?limit=50", username)
        setHistory(data)
      } catch (error) {
        setHistoryError(error instanceof Error ? error.message : "Could not load history.")
      } finally {
        setHistoryLoading(false)
      }
    },
    [viewerUsername],
  )

  useEffect(() => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) {
      setAuthStatus("unauthorized")
      router.replace("/login")
      return
    }

    const username = localStorage.getItem("auth_username") || "guest"
    setViewerUsername(username)
    setAuthStatus("authorized")
    void refreshDashboard(username)
  }, [refreshDashboard, router])

  useEffect(() => {
    if (!isHistoryOpen || authStatus !== "authorized") {
      return
    }

    void refreshHistory()
  }, [authStatus, isHistoryOpen, refreshHistory])

  async function handleOptimize() {
    const code = editorRef.current?.getValue()
    if (!code || !viewerUsername) {
      return null
    }

    setLoading(true)
    setCompileOutput("")
    setOptimizerResult(null)

    try {
      const data = await fetchJson<OptimizerResult>("/optimize", viewerUsername, {
        method: "POST",
        body: JSON.stringify({ code }),
      })
      setCompileOutput(
        getOutputText(data) ||
          "Program ran successfully, but it printed no output. Add printf/cout to print values.",
      )
      setOptimizerResult(data)
      await Promise.allSettled([
        refreshDashboard(viewerUsername),
        isHistoryOpen ? refreshHistory(viewerUsername) : Promise.resolve(),
      ])
      return data
    } catch {
      setCompileOutput("could not reach backend - is uvicorn running?")
      setOptimizerResult(null)
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleNavigate() {
    const code = editorRef.current?.getValue()

    if (code && !optimizerResult) {
      const data = await handleOptimize()
      if (data) {
        router.push("/editor")
      }
      return
    }

    router.push("/editor")
  }

  function handleLogout() {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_username")
    setOptimizerResult(null)
    setAuthStatus("unauthorized")
    router.replace("/login")
  }

  async function handleDeleteHistoryRun() {
    if (!runPendingDelete || !viewerUsername) {
      return
    }

    setDeletingRunId(runPendingDelete.id)
    setHistoryError(null)

    try {
      await fetchJson<{ deleted: boolean; id: string }>(`/history/${runPendingDelete.id}`, viewerUsername, {
        method: "DELETE",
      })
      toast.success("History entry deleted.")
      setHistory((currentHistory) => currentHistory.filter((run) => run.id !== runPendingDelete.id))
      await Promise.allSettled([refreshHistory(viewerUsername), refreshDashboard(viewerUsername)])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete history entry."
      setHistoryError(message)
      toast.error(message)
    } finally {
      setDeletingRunId(null)
      setRunPendingDelete(null)
    }
  }

  const latestRun = dashboard?.recent_runs[0] ?? null
  const optimizerSpeedup = getOptimizerSpeedup(optimizerResult)

  if (authStatus !== "authorized") {
    return <div className="min-h-screen bg-transparent" />
  }

  return (
    <ScrollArea className="min-h-screen w-full">
      <div className="relative min-h-screen overflow-hidden text-slate-900">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[34rem] w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.18)_0%,rgba(96,165,250,0.08)_28%,transparent_72%)] blur-3xl" />
          <div className="absolute left-[8%] top-[8rem] h-48 w-48 rounded-full bg-white/70 blur-3xl" />
          <div className="absolute right-[10%] top-[16rem] h-72 w-72 rounded-full bg-sky-200/25 blur-3xl" />
        </div>

        <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-[18px] bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]">
                <Terminal size={22} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-500">Lex Optimizer</p>
                <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.05em] text-slate-950">Compiler Workspace</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 xl:ml-auto">
              <div className="rounded-full border border-white/80 bg-white/75 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.12)]">
                Signed in as <span className="font-semibold text-slate-900">{viewerUsername}</span>
              </div>

              <Button
                variant="default"
                className={primaryButtonClass}
                size="sm"
                onClick={() => void handleOptimize()}
                disabled={loading}
              >
                {loading ? <Spinner className="text-sky-200" /> : <Play size={14} className="text-sky-300" />}
                {loading ? "Optimizing..." : "Optimize"}
              </Button>

              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className={neutralButtonClass}>
                    <SquareTerminal size={14} className="text-slate-500" />
                    Output
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="border-t border-white/70 bg-[rgba(248,250,252,0.94)] text-slate-900 backdrop-blur-3xl">
                  <DrawerHeader className="border-b border-slate-200/70 px-6 pb-4 pt-6 text-left">
                    <DrawerTitle className="flex items-center gap-3 text-[1.5rem] font-semibold tracking-[-0.04em] text-slate-950">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <SquareTerminal size={18} />
                      </div>
                      Compilation Output
                    </DrawerTitle>
                    <DrawerDescription className="text-base text-slate-500">
                      Stdout and stderr from g++ compilation and execution.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="px-6 py-6">
                    <div className="min-h-[240px] max-h-[420px] overflow-auto rounded-[28px] border border-slate-900/10 bg-slate-950 p-5 text-sm text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      {compileOutput ? (
                        <pre className="whitespace-pre-wrap font-mono [overflow-wrap:anywhere]">{compileOutput}</pre>
                      ) : (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center">
                          <SearchCode size={44} className="text-slate-500" />
                          <div>
                            <p className="text-base font-medium text-white">Compile code to see output</p>
                            <p className="mt-2 text-sm text-slate-400">This drawer becomes a full-width console when you need more space.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <DrawerFooter className="border-t border-slate-200/70 px-6 py-4 sm:flex-row sm:justify-end">
                    <DrawerClose asChild>
                      <Button variant="outline" className={neutralButtonClass}>
                        <X size={16} className="text-slate-500" />
                        Close
                      </Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>

              <Button
                variant="outline"
                className={neutralButtonClass}
                size="sm"
                onClick={() => setIsHistoryOpen(true)}
              >
                <History size={15} className="text-amber-500" />
                History
              </Button>

              <Button
                variant="outline"
                className={neutralButtonClass}
                size="sm"
                onClick={() => void handleNavigate()}
              >
                <GitBranch size={15} className="text-sky-500" />
                Dep Graph
              </Button>

              <Button
                variant="outline"
                className={dangerButtonClass}
                size="sm"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                Log Out
              </Button>
            </div>
          </div>
        </header>

        <main className="relative mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 lg:gap-8">
          <section className="relative overflow-hidden rounded-[38px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(241,245,249,0.66))] p-7 shadow-[0_28px_80px_rgba(148,163,184,0.18)] backdrop-blur-2xl sm:p-8">
            <div className="absolute inset-y-0 right-0 w-[32rem] bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.16),transparent_70%)]" />
            <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
              <div>
                <p className="text-sm font-medium text-sky-700">Crystal-clear workflow, less visual noise</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
                  A workspace for optimizing, inspecting, and revisiting C++ runs.
                </h2>

                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="rounded-full border border-white/80 bg-white/78 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_30px_rgba(148,163,184,0.14)]">
                    {dashboardLoading ? "Refreshing metrics..." : `${formatCount(dashboard?.summary.total_runs)} total runs`}
                  </div>
                  <div className="rounded-full border border-white/80 bg-white/78 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_30px_rgba(148,163,184,0.14)]">
                    {latestRun ? `Last run ${formatTimestamp(dashboard?.summary.last_run_at)} UTC` : "Ready for your first run"}
                  </div>
                  <div className="rounded-full border border-white/80 bg-white/78 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_30px_rgba(148,163,184,0.14)]">
                    {optimizerResult ? `${optimizerResult.batches.length} execution batches ready` : "Run the optimizer to populate analysis"}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className={cn(insetSurfaceClass, "p-5")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold tracking-[-0.02em] text-slate-900">Most recent run</p>
                    {latestRun ? <RunStatus status={latestRun.status} /> : null}
                  </div>
                  <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                    {dashboard?.summary.last_run_at ? formatTimestamp(dashboard.summary.last_run_at) : "No history yet"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {dashboard?.summary.last_run_at ? "Latest optimization recorded in UTC." : "Run the optimizer once to start building history."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                  <div className={cn(insetSurfaceClass, "p-5")}>
                    <div className="flex items-center gap-2 text-slate-900">
                      <Activity size={16} className="text-sky-600" />
                      <p className="text-sm font-semibold tracking-[-0.02em]">Live optimizer</p>
                    </div>
                    <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                      {optimizerResult ? formatSpeedup(optimizerSpeedup) : "--"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {optimizerResult ? `${optimizerResult.ir.length} IR statements in memory.` : "Speedup appears after the next optimization run."}
                    </p>
                  </div>

                  <div className={cn(insetSurfaceClass, "p-5")}>
                    <p className="text-sm font-semibold tracking-[-0.02em] text-slate-900">Average timing</p>
                    <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                      {dashboardLoading ? "..." : formatSeconds(dashboard?.summary.avg_parallel_time)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Parallel mean, with sequential mean at {dashboardLoading ? "..." : formatSeconds(dashboard?.summary.avg_sequential_time)}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Runs"
              value={dashboardLoading ? "..." : formatCount(dashboard?.summary.total_runs)}
              helper="Saved optimizer executions for this signed-in account."
            />
            <MetricCard
              label="Successful Runs"
              value={dashboardLoading ? "..." : formatCount(dashboard?.summary.successful_runs)}
              helper="Runs completed without backend or compiler errors."
            />
            <MetricCard
              label="Average Speedup"
              value={dashboardLoading ? "..." : formatSpeedup(dashboard?.summary.avg_speedup)}
              helper="Mean sequential-to-parallel performance improvement."
            />
            <MetricCard
              label="Best Speedup"
              value={dashboardLoading ? "..." : formatSpeedup(dashboard?.summary.best_speedup)}
              helper="Highest recorded optimization result in history."
            />
          </section>

          {dashboardError && (
            <div className="rounded-[26px] border border-rose-200 bg-rose-50/85 px-5 py-4 text-sm text-rose-700 shadow-[0_16px_40px_rgba(244,63,94,0.08)]">
              {dashboardError}
            </div>
          )}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.92fr)]">
            <section className={cn(surfaceClass, "overflow-hidden")}>
              <div className="flex flex-col gap-4 border-b border-slate-200/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Workspace</p>
                  <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.04em] text-slate-950">C++ Editor</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Write code, optimize it, and inspect dependency batches with a focused visual hierarchy.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-600">
                    File <span className="font-semibold text-slate-900">main.cpp</span>
                  </div>
                  {latestRun ? (
                    <div className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-600">
                      Latest speedup <span className="font-semibold text-slate-900">{formatSpeedup(latestRun.speedup)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/90 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="size-3 rounded-full bg-rose-400/80" />
                      <span className="size-3 rounded-full bg-amber-400/80" />
                      <span className="size-3 rounded-full bg-emerald-400/80" />
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Live Editing Surface</p>
                  </div>
                  <Editor
                    height="72vh"
                    defaultLanguage="cpp"
                    theme="vs"
                    onMount={(instance) => {
                      editorRef.current = instance
                    }}
                    defaultValue={DEFAULT_CODE}
                    options={{
                      fontSize: 15,
                      fontFamily: "var(--font-geist-mono)",
                      lineHeight: 24,
                      minimap: { enabled: false },
                      wordWrap: "on",
                      automaticLayout: true,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      cursorSmoothCaretAnimation: "on",
                      scrollBeyondLastLine: false,
                      lineNumbers: "on",
                      tabSize: 4,
                      padding: { top: 20, bottom: 20 },
                      scrollbar: { alwaysConsumeMouseWheel: false },
                    }}
                  />
                </div>
              </div>
            </section>

            <div className="space-y-6">
              <Panel title="Program Output" subtitle="Compiler and executable output from the latest run, kept readable and high-contrast.">
                <div className={cn(codeSurfaceClass, "min-h-[260px] overflow-auto p-5")}>
                  {compileOutput ? (
                    <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-emerald-300 [overflow-wrap:anywhere]">{compileOutput}</pre>
                  ) : (
                    <EmptyState
                      icon={<SquareTerminal size={28} className="text-slate-500" />}
                      title="Run the optimizer to view compiler output."
                      description="The latest stdout and stderr will appear here in a focused console view."
                    />
                  )}
                </div>
              </Panel>

              <Panel title="Optimizer Analysis" subtitle="IR, batches, timings, and computed values for the current run.">
                {optimizerResult ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className={cn(insetSurfaceClass, "p-4")}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Statements</p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{optimizerResult.ir.length}</p>
                      </div>
                      <div className={cn(insetSurfaceClass, "p-4")}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Batches</p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{optimizerResult.batches.length}</p>
                      </div>
                      <div className={cn(insetSurfaceClass, "p-4")}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Speedup</p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-emerald-700">{formatSpeedup(optimizerSpeedup)}</p>
                      </div>
                    </div>

                    <div className={cn(insetSurfaceClass, "p-4")}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">IR Representation</p>
                      <pre className="mt-3 whitespace-pre-wrap font-mono text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                        {optimizerResult.ir.join("\n") || "No IR generated."}
                      </pre>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className={cn(insetSurfaceClass, "p-4")}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Execution Batches</p>
                        <pre className="mt-3 whitespace-pre-wrap font-mono text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                          {optimizerResult.batches
                            .map(
                              (batch, index) =>
                                `batch ${index}: [${optimizerResult.ir
                                  .filter((_, statementIndex) => batch.includes(statementIndex))
                                  .join(", ")}]`,
                            )
                            .join("\n") || "No batches generated."}
                        </pre>
                      </div>
                      <div className={cn(insetSurfaceClass, "p-4")}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Performance</p>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                          <p>Sequential: {formatSeconds(optimizerResult.sequential.time)}</p>
                          <p>Parallel: {formatSeconds(optimizerResult.parallel.time)}</p>
                          <p className="font-semibold text-emerald-700">Speedup: {formatSpeedup(optimizerSpeedup)}</p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(insetSurfaceClass, "p-4")}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Computed Values</p>
                      <pre className="mt-3 whitespace-pre-wrap font-mono text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                        {Object.entries(optimizerResult.sequential.results)
                          .map(([key, value]) => `${key} = ${value}`)
                          .join("\n") || "No computed values."}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<Activity size={28} className="text-slate-500" />}
                    title="Analysis appears after the next run."
                    description="We’ll show IR, execution batches, timings, and computed values as soon as the optimizer finishes."
                  />
                )}
              </Panel>
            </div>
          </section>

          <Panel
            title="Recent Runs"
            subtitle="Saved runs for the current signed-in user, presented in a cleaner visual stack for quick review."
            action={
              <Button
                variant="outline"
                className={neutralButtonClass}
                onClick={() => void refreshDashboard()}
                disabled={dashboardLoading}
              >
                <RefreshCw size={16} className={dashboardLoading ? "animate-spin text-slate-500" : "text-slate-500"} />
                Refresh
              </Button>
            }
          >
            {dashboard?.recent_runs.length ? (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                {dashboard.recent_runs.map((run) => (
                  <RecentRunCard key={run.id} run={run} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<History size={28} className="text-slate-500" />}
                title="No runs saved yet for this user."
                description="Once you optimize code, your recent executions will appear here for quick comparison."
              />
            )}
          </Panel>
        </main>
      </div>

      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-xl sm:p-6">
          <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[34px] border border-white/70 bg-[rgba(248,250,252,0.92)] shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-3xl">
            <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">History</p>
                <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.05em] text-slate-950">Execution History</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Saved runs for {viewerUsername}.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className={neutralButtonClass}
                  onClick={() => void refreshHistory()}
                  disabled={historyLoading}
                >
                  <RefreshCw size={16} className={historyLoading ? "animate-spin text-slate-500" : "text-slate-500"} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  className={dangerButtonClass}
                  onClick={() => setIsHistoryOpen(false)}
                >
                  <X size={16} />
                  Close
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              {historyError && (
                <div className="mb-4 rounded-[24px] border border-rose-200 bg-rose-50/85 px-4 py-3 text-sm text-rose-700">
                  {historyError}
                </div>
              )}

              {historyLoading ? (
                <div className={cn(insetSurfaceClass, "px-4 py-4 text-sm text-slate-600")}>Loading runs...</div>
              ) : history.length ? (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                  {history.map((run) => (
                    <RecentRunCardWithActions
                      key={run.id}
                      run={run}
                      onDelete={setRunPendingDelete}
                      deleteDisabled={deletingRunId === run.id}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<History size={28} className="text-slate-500" />}
                  title="No history found for this user."
                  description="Your saved optimizer runs will appear here as soon as they are created."
                />
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={Boolean(runPendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setRunPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent className="border border-white/80 bg-[rgba(255,255,255,0.95)] text-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-3xl">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="text-[1.35rem] font-semibold tracking-[-0.04em] text-slate-950">
              Delete this history item?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This removes run {runPendingDelete?.id} from your saved optimizer history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950"
              disabled={Boolean(deletingRunId)}
            >
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              className="rounded-full border border-rose-200 bg-rose-600 text-white hover:bg-rose-500 hover:text-white"
              onClick={handleDeleteHistoryRun}
              disabled={Boolean(deletingRunId)}
            >
              {deletingRunId ? <Spinner className="mr-1 text-white" /> : <Trash2 size={16} className="mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  )
}
