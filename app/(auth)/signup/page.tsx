"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import Signup from "@/actions/signup"
import toast from "react-hot-toast"
import { validatePasswordInput, validateUsernameInput } from "@/lib/auth"

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    if (localStorage.getItem("auth_token")) {
      router.replace("/compiler")
      return
    }

    setAuthChecked(true)
  }, [router])

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const usernameError = validateUsernameInput(username)
    const passwordError = validatePasswordInput(password)
    if (usernameError || passwordError) {
      setMessage(usernameError || passwordError || "Sign up failed")
      return
    }

    setIsSubmitting(true)
    setMessage("")

    try {
      const response = await Signup({ username: username.trim(), password })
      if (response.success) {
        localStorage.setItem("auth_token", "true")
        localStorage.setItem("auth_username", response.username || username.trim())
        router.replace("/compiler")
        toast.success(response.message)
        return
      }

      setMessage(response.message || "Sign up failed")
      toast.error(response.message || "Sign up failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!authChecked) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-50" />
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ fontFamily: "'Robotomono',monospace" }}>
          Sign In
        </h2>
        <form className="space-y-4" onSubmit={handleSignup}>
          <div>
            <Label htmlFor="username" style={{ fontFamily: "'Robotomono',monospace" }}>
              Username
            </Label>
            <Input
              value={username}
              id="username"
              type="text"
              placeholder="Enter your username..."
              onChange={(event) => {
                event.stopPropagation()
                setUsername(event.target.value)
              }}
              spellCheck={false}
              autoComplete="username"
            />
          </div>
          <div>
            <Label htmlFor="password" style={{ fontFamily: "'Robotomono',monospace" }}>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1"
              autoComplete="new-password"
            />
          </div>

          {message && <p className="text-sm text-red-600 mt-1">{message}</p>}

          <Button type="submit" className="w-full mt-4" style={{ fontFamily: "'Robotomono',monospace" }} disabled={isSubmitting}>
            {isSubmitting ? "Signing up..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500" style={{ fontFamily: "'Robotomono',monospace" }}>
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:underline" style={{ fontFamily: "'Robotomono',monospace" }}>
            LogIn
          </a>
        </p>
      </Card>
    </div>
  )
}
