import os
import subprocess
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import ASCENDING, DESCENDING, MongoClient

from optimizer import parse_to_ir, build_dep_graph, find_batches, run_sequential, run_parallel

load_dotenv()

RECENT_RUN_LIMIT = 6
RUN_HISTORY_COLLECTION = "optimizer_runs"
DEFAULT_DATABASE_NAME = "Compiler"
MONGODB_URI = os.environ.get("MONGODB_URI")

_MONGO_CLIENT = None


def get_mongo_client():
    global _MONGO_CLIENT

    if _MONGO_CLIENT is None:
        if not MONGODB_URI:
            raise RuntimeError("Missing MONGODB_URI in environment variables")
        _MONGO_CLIENT = MongoClient(MONGODB_URI)

    return _MONGO_CLIENT


def get_database():
    client = get_mongo_client()
    database = client.get_default_database()
    if database is not None:
        return database
    return client[DEFAULT_DATABASE_NAME]


def get_history_collection():
    return get_database()[RUN_HISTORY_COLLECTION]


def init_history_store():
    collection = get_history_collection()
    collection.create_index([("username", ASCENDING), ("created_at", DESCENDING)])
    collection.create_index([("id", ASCENDING)], unique=True)


def get_request_username(request: Request):
    username = (request.headers.get("x-auth-username") or "").strip()
    return username or "guest"


def format_timestamp(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def serialize_history_doc(document):
    return {
        "id": document["id"],
        "code": document["code"],
        "output": document["output"],
        "status": document.get("status", "success"),
        "sequential_time": document.get("sequential_time"),
        "parallel_time": document.get("parallel_time"),
        "speedup": document.get("speedup"),
        "stmt_count": document.get("stmt_count"),
        "created_at": format_timestamp(document.get("created_at")),
    }


def get_recent_runs(username, limit=RECENT_RUN_LIMIT):
    cursor = (
        get_history_collection()
        .find({"username": username}, {"_id": 0})
        .sort("created_at", DESCENDING)
        .limit(limit)
    )
    return [serialize_history_doc(document) for document in cursor]


def delete_history_run(username, run_id):
    result = get_history_collection().delete_one({"username": username, "id": run_id})
    return result.deleted_count


def get_dashboard_summary(username):
    pipeline = [
        {"$match": {"username": username}},
        {
            "$group": {
                "_id": None,
                "total_runs": {"$sum": 1},
                "successful_runs": {
                    "$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}
                },
                "avg_speedup": {"$avg": "$speedup"},
                "best_speedup": {"$max": "$speedup"},
                "avg_sequential_time": {"$avg": "$sequential_time"},
                "avg_parallel_time": {"$avg": "$parallel_time"},
                "avg_stmt_count": {"$avg": "$stmt_count"},
                "last_run_at": {"$max": "$created_at"},
            }
        },
    ]
    row = next(iter(get_history_collection().aggregate(pipeline)), None)

    if not row:
        return {
            "total_runs": 0,
            "successful_runs": 0,
            "avg_speedup": None,
            "best_speedup": None,
            "avg_sequential_time": None,
            "avg_parallel_time": None,
            "avg_stmt_count": None,
            "last_run_at": None,
        }

    return {
        "total_runs": row.get("total_runs", 0),
        "successful_runs": row.get("successful_runs", 0),
        "avg_speedup": row.get("avg_speedup"),
        "best_speedup": row.get("best_speedup"),
        "avg_sequential_time": row.get("avg_sequential_time"),
        "avg_parallel_time": row.get("avg_parallel_time"),
        "avg_stmt_count": row.get("avg_stmt_count"),
        "last_run_at": format_timestamp(row.get("last_run_at")),
    }


def persist_history_run(
    username,
    code,
    output,
    status,
    sequential_time,
    parallel_time,
    speedup,
    stmt_count,
):
    get_history_collection().insert_one(
        {
            "id": uuid.uuid4().hex[:12],
            "username": username,
            "code": code,
            "output": output,
            "status": status,
            "sequential_time": sequential_time,
            "parallel_time": parallel_time,
            "speedup": speedup,
            "stmt_count": stmt_count,
            "created_at": datetime.now(timezone.utc),
        }
    )


init_history_store()

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

    with open(src, "w", encoding="utf-8") as file_handle:
        file_handle.write(cpp_source)

    try:
        compile_env = os.environ.copy()
        compile_env["TMP"] = build_root
        compile_env["TEMP"] = build_root
        compile_env["TMPDIR"] = build_root

        compilation = subprocess.run(
            ["g++", "-std=c++17", "-O0", "-o", binary, src],
            capture_output=True,
            text=True,
            timeout=20,
            env=compile_env,
        )
        if compilation.returncode != 0:
            return {"stdout": "", "stderr": compilation.stderr}

        executable_path = next(
            (path for path in binary_candidate_paths if os.path.exists(path)),
            binary,
        )
        execution = subprocess.run(
            [executable_path],
            capture_output=True,
            text=True,
            timeout=20,
        )
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
def optimize(body: CodeInput, request: Request):
    username = get_request_username(request)
    compilation = compile_and_run(body.code)

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

    output_text = "\n\n".join(
        part for part in (compilation.get("stdout", ""), compilation.get("stderr", "")) if part
    )
    speedup = (seq_time / par_time) if par_time else None
    status = "error" if compilation.get("stderr") else "success"

    try:
        persist_history_run(
            username=username,
            code=body.code,
            output=output_text,
            status=status,
            sequential_time=seq_time,
            parallel_time=par_time,
            speedup=speedup,
            stmt_count=len(stmts),
        )
    except Exception as exc:
        print(f"history persistence error: {exc}")

    return {
        "normal_output": compilation,
        "ir": [
            f"{statement.target} = {statement.op1} + {statement.op2}"
            if statement.op2
            else f"{statement.target} = {statement.op1}"
            for statement in stmts
        ],
        "dependencies": graph,
        "batches": batches,
        "sequential": {"results": seq_results, "time": seq_time},
        "parallel": {"results": par_results, "time": par_time},
    }


@app.get("/history")
def get_history(request: Request, limit: int = Query(default=50, ge=1, le=200)):
    username = get_request_username(request)
    return get_recent_runs(username, limit)


@app.delete("/history/{run_id}")
def delete_history(run_id: str, request: Request):
    username = get_request_username(request)
    deleted_count = delete_history_run(username, run_id)

    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="History run not found.")

    return {"deleted": True, "id": run_id}


@app.get("/dashboard")
def get_dashboard(request: Request):
    username = get_request_username(request)
    return {
        "summary": get_dashboard_summary(username),
        "recent_runs": get_recent_runs(username),
    }
