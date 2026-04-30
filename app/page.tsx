"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (localStorage.getItem("auth_token")) {
      router.replace("/compiler")
      return
    }

    router.replace("/login")
  }, [router])

  return <div className="min-h-screen bg-slate-950" />
}
