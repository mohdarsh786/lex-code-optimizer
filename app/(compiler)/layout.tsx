export const metadata = { title: "Optimizer" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-black min-h-screen">{children}</div>
}
