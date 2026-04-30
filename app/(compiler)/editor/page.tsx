"use client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Workflow } from "lucide-react"
import ReactFlow, { type Edge, type Node } from "reactflow"
import "reactflow/dist/style.css"
import { useMemo, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Drawervalue } from "@/components/store"

const nodeTypes = {}
const edgeTypes = {}

export default function VisualEditor() {
  const result = Drawervalue((value) => value.optimizerResult)
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState<"checking" | "authorized" | "unauthorized">("checking")

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      setAuthStatus("unauthorized")
      router.replace("/login")
      return
    }

    setAuthStatus("authorized")
  }, [router])

  const { nodes, edges } = useMemo(() => {
    if (!result) {
      return {
        nodes: [{ id: "empty", position: { x: 200, y: 200 }, data: { label: "run optimizer first" }, style: { background: "#333", color: "#999", border: "1px solid #555", borderRadius: "8px", padding: "12px" } }],
        edges: [],
      }
    }

    const batchColors = ["#166534", "#1e3a5f", "#4a1d6a", "#6b3410", "#1a4a4a"]
    const n: Node[] = []
    const e: Edge[] = []

    result.batches.forEach((batch: number[], batchIdx: number) => {
      batch.forEach((stmtIdx: number, posInBatch: number) => {
        n.push({
          id: String(stmtIdx),
          position: { x: 220 * posInBatch + 80, y: 160 * batchIdx + 80 },
          data: { label: result.ir[stmtIdx] || `stmt ${stmtIdx}` },
          style: {
            background: batchColors[batchIdx % batchColors.length],
            color: "white",
            border: "1px solid #444",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "13px",
          },
        })
      })
    })

    Object.entries(result.dependencies).forEach(([target, deps]) => {
      (deps as number[]).forEach(dep => {
        e.push({
          id: `e${dep}-${target}`,
          source: String(dep),
          target: String(target),
          animated: true,
          style: { stroke: "#888" },
        })
      })
    })

    return { nodes: n, edges: e }
  }, [result])

  if (authStatus !== "authorized") {
    return <div className="min-h-screen bg-black" />
  }

  return (
    <ScrollArea className="min-h-screen w-full bg-black font-sans">
      <div className="h-[70px] w-full flex items-center justify-start px-8 gap-4">
        <Workflow size={30} color="white"/>
        <div className="text-xl text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-white to-transparent">
          Dependency Graph
        </div>
      </div>
      <Separator/>

      {result && (
        <div className="p-6">
          <div className="flex gap-4 mb-4 flex-wrap">
            {result.batches.map((batch: number[], i: number) => (
              <div key={i} className="rounded bg-zinc-900 p-3 text-sm text-white">
                <span className="text-zinc-400">batch {i}:</span>{" "}
                {batch.map((idx: number) => result.ir[idx]).join(", ")}
              </div>
            ))}
          </div>
          <div className="bg-zinc-900 rounded p-3 text-sm text-white inline-block">
             seq: {result.sequential.time.toFixed(2)}s | par: {result.parallel.time.toFixed(2)}s |{" "}
            <span className="text-green-400 font-bold">
              {(result.sequential.time / result.parallel.time).toFixed(2)}x speedup
            </span>
          </div>
        </div>
      )}

      <div style={{ width: "100%", height: "500px" }} className="bg-[#0b0b0f]">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView/>
      </div>

      {result && (
        <div className="p-6">
          <div className="text-sm text-zinc-400 mb-1">IR Code</div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-zinc-900 p-4 font-mono text-sm text-green-400 [overflow-wrap:anywhere]">
            {result.ir.join("\n")}
          </pre>
        </div>
      )}
    </ScrollArea>
  )
}
