export default function TosScreen({ nav }) {
  return (
    <div className="full-screen relative overflow-hidden flex flex-col items-center pt-8 pb-4">
      {/* Background */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #f0c040 0, #f0c040 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #f0c040 0, #f0c040 1px, transparent 1px, transparent 48px)',
        backgroundSize: '48px 48px',
      }} />

      <div className="relative z-10 w-full max-w-2xl px-4 flex flex-col h-full text-gray-300">
        <div className="flex items-center justify-between mb-8 shrink-0 bg-black/40 p-4 rounded-xl border border-gray-800 shadow-2xl backdrop-blur-sm">
          <div>
            <h1 className="logo-text text-xl sm:text-3xl mb-1 text-bm-accent">TERMS OF SERVICE</h1>
            <p className="text-[10px] text-gray-500 tracking-widest font-bold">LAST UPDATED: MAY 2026</p>
          </div>
          <button 
            className="btn-pixel bg-gray-800 text-white border-gray-600 hover:bg-gray-700" 
            onClick={() => nav('auth')}
          >
            ← BACK
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-4 space-y-6 text-sm font-['Inter',sans-serif]">
          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">1. Acceptance of Terms</h2>
            <p>By accessing and playing BombRush Arena, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our services.</p>
          </section>

          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">2. User Conduct</h2>
            <p>You agree not to use the game for any unlawful purpose or in any way that interrupts, damages, or impairs the service. Cheating, hacking, or exploiting bugs to gain an unfair advantage on the leaderboards or in multiplayer matches is strictly prohibited and may result in account termination.</p>
          </section>

          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">3. Intellectual Property</h2>
            <p>The game mechanics, visual assets, code, and audio are protected by intellectual property laws. You may not distribute, modify, or reproduce any part of the game without explicit permission.</p>
          </section>

          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">4. Disclaimer of Warranty</h2>
            <p>The game is provided "as is" without warranty of any kind. We do not guarantee uninterrupted access to the game or that the servers will always be available.</p>
          </section>

          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">5. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the game after any such changes constitutes your consent to such changes.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
