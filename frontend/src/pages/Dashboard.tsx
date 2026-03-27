export default function Dashboard() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-display tracking-tight">
              Welcome back, Aisha
            </h1>
            <p className="text-sm text-muted-foreground">
              Your study path is ready. Keep the streak going.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 px-4 py-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            Streak: 7 days
          </div>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/70 p-5 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Today</p>
              <p className="mt-2 text-lg font-medium">Math + Biology</p>
              <p className="text-xs text-muted-foreground">2 focus blocks</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">XP</p>
              <div className="h-2 rounded-full bg-[#E6D7C5] overflow-hidden">
                <div className="h-full w-[65%] bg-[#FF8C00]" />
              </div>
              <p className="text-xs text-muted-foreground">650 / 1000 XP to Level 4</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Badges</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Focus 5", "Quiz Ace", "Week 1"].map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-[#FF8C00]/30 bg-white/80 px-3 py-1 text-xs"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <section className="rounded-2xl border border-[#E6D7C5] bg-[#FFF4CC]/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display">Your roadmap</h2>
              <span className="text-xs text-muted-foreground">Week 2 of 6</span>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "Functions", status: "In progress" },
                { title: "Derivatives", status: "Up next" },
                { title: "Applications", status: "Locked" },
              ].map((node) => (
                <div
                  key={node.title}
                  className="rounded-2xl border border-[#E6D7C5] bg-white/80 p-4 shadow-sm"
                >
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Math</p>
                  <h3 className="mt-2 text-lg font-medium">{node.title}</h3>
                  <span className="mt-3 inline-flex rounded-full border border-[#FF8C00]/30 bg-[#FFEC99]/70 px-3 py-1 text-xs">
                    {node.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#E6D7C5] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Next session</p>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">25 min Focus Sprint</p>
                  <p className="text-xs text-muted-foreground">Starts when you are ready</p>
                </div>
                <button className="rounded-xl bg-[#FF8C00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e07b00] transition-colors">
                  Start now
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
