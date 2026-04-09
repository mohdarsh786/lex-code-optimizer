import subprocess
import tempfile
import os
import sqlite3
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from optimizer import parse_to_ir, build_dep_graph, find_batches, run_sequential, run_parallel

with sqlite3.connect("history.db") as conn:
    conn.execute("CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, code TEXT, output TEXT)")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CodeInput(BaseModel):
    code: str


def compile_and_run(cpp_source):
    build_root = os.path.join(os.getcwd(), ".compile_tmp")
    os.makedirs(build_root, exist_ok=True)
    job_id = uuid.uuid4().hex
    src = os.path.join(build_root, f"{job_id}.cpp")
    binary = os.path.join(build_root, f"{job_id}")
    binary_candidate_paths = [binary, f"{binary}.exe"]

    with open(src, "w", encoding="utf-8") as f:
        f.write(cpp_source)

    try:
        compile_env = os.environ.copy()
        compile_env["TMP"] = build_root
        compile_env["TEMP"] = build_root
        compile_env["TMPDIR"] = build_root

        comp = subprocess.run(
            ["g++", "-std=c++17", "-O0", "-o", binary, src],
            capture_output=True,
            text=True,
            timeout=20,
            env=compile_env,
        )
        if comp.returncode != 0:
            return {"stdout": "", "stderr": comp.stderr}
        executable_path = next((p for p in binary_candidate_paths if os.path.exists(p)), binary)
        execution = subprocess.run([executable_path], capture_output=True, text=True, timeout=20)
        return {"stdout": execution.stdout, "stderr": execution.stderr}
    except FileNotFoundError:
        return {
            "stdout": "",
            "stderr": "g++ not found. Install a C++ compiler (e.g., MinGW-w64) and ensure g++ is on PATH.",
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Compilation or execution timed out."}
    except Exception as exc:
        return {"stdout": "", "stderr": f"Unexpected backend error: {exc}"}
    finally:
        for path in (src, *binary_candidate_paths):
            if os.path.exists(path):
                os.unlink(path)


@app.post("/optimize")
def optimize(body: CodeInput):
    compilation = compile_and_run(body.code)

    output_text = compilation.get("stdout", "") or compilation.get("stderr", "")
    with sqlite3.connect("history.db") as conn:
        conn.execute("INSERT INTO history (code, output) VALUES (?, ?)", (body.code, output_text))

    try:
        stmts = parse_to_ir(body.code)
        graph = build_dep_graph(stmts)
        batches = find_batches(stmts, graph)
        seq_results, seq_time = run_sequential(stmts)
        par_results, par_time = run_parallel(stmts, batches)
    except Exception as exc:
        stmts = []
        graph = {}
        batches = []
        seq_results = {}
        par_results = {}
        seq_time = 0.0
        par_time = 0.0
        existing_stderr = compilation.get("stderr", "")
        parse_error = f"Optimizer parse/run error: {exc}"
        compilation["stderr"] = f"{existing_stderr}\n{parse_error}".strip()

    return {
        "normal_output": compilation,
        "ir": [f"{s.target} = {s.op1} + {s.op2}" if s.op2 else f"{s.target} = {s.op1}" for s in stmts],
        "dependencies": graph,
        "batches": batches,
        "sequential": {"results": seq_results, "time": seq_time},
        "parallel": {"results": par_results, "time": par_time},
    }

@app.get("/history")
def get_history():
    with sqlite3.connect("history.db") as conn:
        conn.row_factory = sqlite3.Row
        return [dict(r) for r in conn.execute("SELECT id, code, output FROM history ORDER BY id DESC LIMIT 50").fetchall()]
