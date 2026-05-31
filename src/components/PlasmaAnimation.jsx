export default function PlasmaAnimation() {
  return (
    <div className="relative inline-block" style={{ width: 72, height: 72 }}>
      {/* Outer glow rings */}
      <div style={{
        position: 'absolute', inset: -8,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(100,0,255,0.3) 0%, rgba(0,100,255,0.15) 50%, transparent 70%)',
        animation: 'pulseGlow 2s ease-in-out infinite',
      }} />
      {/* Main plasma orb */}
      <div style={{
        width: 72, height: 72,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #aaccff 0%, #4466ff 30%, #1100aa 60%, #050520 100%)',
        boxShadow: '0 0 30px rgba(80,0,255,0.6), 0 0 60px rgba(80,0,255,0.3), inset 0 2px 8px rgba(255,255,255,0.3)',
        animation: 'pulseGlow 1.8s ease-in-out infinite',
        position: 'relative',
      }}>
        {/* Specular gloss */}
        <div style={{
          position: 'absolute', top: 14, left: 16,
          width: 20, height: 12,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.45)',
          transform: 'rotate(-20deg)',
        }} />
      </div>
      {/* Orbiting energy spark */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 8, height: 8, marginTop: -4, marginLeft: -4,
        borderRadius: '50%',
        background: '#00ffff',
        boxShadow: '0 0 12px #00ffff',
        animation: 'orbit 1.5s linear infinite',
        transformOrigin: '40px 4px',
      }} />
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(36px); }
          to { transform: rotate(360deg) translateX(36px); }
        }
      `}</style>
    </div>
  )
}
