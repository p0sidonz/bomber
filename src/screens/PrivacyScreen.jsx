export default function PrivacyScreen({ nav }) {
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
            <h1 className="logo-text text-xl sm:text-3xl mb-1 text-bm-accent">PRIVACY POLICY</h1>
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
            <h2 className="text-bm-yellow font-bold text-lg mb-2">1. Introduction</h2>
            <p>Welcome to BombRush Arena. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you play our game.</p>
          </section>

          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Information:</strong> We collect your email address when you create an account to allow you to log in across devices.</li>
              <li><strong>Profile Information:</strong> Your chosen display name and color.</li>
              <li><strong>Game Data:</strong> We store your high scores, campaign progress, and multiplayer match results.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">3. How We Use Your Data</h2>
            <p>We use the data we collect solely for operating the game, providing leaderboards, syncing your progress across devices, and maintaining the multiplayer infrastructure.</p>
          </section>

          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">4. Third-Party Services</h2>
            <p>We use Supabase as our secure backend provider for authentication and database storage. Supabase complies with modern security standards to protect your data. We do not sell your personal data to any third parties.</p>
          </section>

          <section>
            <h2 className="text-bm-yellow font-bold text-lg mb-2">5. Data Deletion</h2>
            <p>You can permanently delete your account and all associated game data at any time using the "Delete Account" option in the game.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
