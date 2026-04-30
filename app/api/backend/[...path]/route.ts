import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

function buildBackendUrl(pathSegments: string[], request: NextRequest) {
  const normalizedBase = BACKEND_URL.endsWith("/") ? BACKEND_URL.slice(0, -1) : BACKEND_URL
  const targetUrl = new URL(`${normalizedBase}/${pathSegments.join("/")}`)

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value)
  })

  return targetUrl
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers()
  const contentType = request.headers.get("content-type")
  const authUsername = request.headers.get("x-auth-username")

  if (contentType) {
    headers.set("content-type", contentType)
  }

  if (authUsername) {
    headers.set("x-auth-username", authUsername)
  }

  return headers
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  const targetUrl = buildBackendUrl(path, request)

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: buildProxyHeaders(request),
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    cache: "no-store",
  })

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context)
}
