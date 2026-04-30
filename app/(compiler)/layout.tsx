export const metadata = { title: "Optimizer" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-transparent">{children}</div>
}
