export default function ContactScreen({ nav }) {
  return (
    <div className="full-screen relative overflow-hidden flex flex-col items-center justify-center pt-8 pb-4">
      {/* Background */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #f0c040 0, #f0c040 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #f0c040 0, #f0c040 1px, transparent 1px, transparent 48px)',
        backgroundSize: '48px 48px',
      }} />

      <div className="relative z-10 w-full max-w-md px-4 flex flex-col text-gray-300">
        <div className="bg-black/60 p-8 rounded-xl border border-gray-800 shadow-2xl backdrop-blur-sm text-center">
          <h1 className="logo-text text-2xl sm:text-3xl mb-2 text-bm-accent">CONTACT US</h1>
          <p className="text-[10px] text-gray-400 tracking-widest font-bold mb-8">WE'D LOVE TO HEAR FROM YOU</p>

          <div className="mb-8">
            <p className="font-['Inter',sans-serif] text-sm text-gray-300 mb-2">For support, bug reports, or business inquiries, please reach out to us at:</p>
            <a href="mailto:support@bombrush.com" className="text-xl text-bm-yellow hover:text-orange-400 transition-colors font-bold tracking-wider">
              mail@iankit.me
            </a>
          </div>

          <button 
            className="btn-pixel bg-gray-800 text-white border-gray-600 hover:bg-gray-700 w-full" 
            onClick={() => nav('auth')}
          >
            ← RETURN TO MENU
          </button>
        </div>
      </div>
    </div>
  )
}
