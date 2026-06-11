export default function PlasmaAnimation() {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {/* Outermost ambient glow */}
      <div style={{
        position: 'absolute', inset: -24,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, rgba(100,0,255,0.1) 40%, transparent 70%)',
        animation: 'reactorPulse 3s ease-in-out infinite',
      }} />

      {/* Rotating energy ring — outer */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 110, height: 110,
        borderRadius: '50%',
        border: '1.5px dashed rgba(0,212,255,0.25)',
        animation: 'energyRingSpin 8s linear infinite',
      }} />

      {/* Rotating energy ring — inner (reverse) */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 88, height: 88,
        borderRadius: '50%',
        border: '1px dashed rgba(100,0,255,0.2)',
        animation: 'energyRingSpinReverse 6s linear infinite',
      }} />

      {/* Main plasma orb */}
      <div style={{
        width: 72, height: 72,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #c0ddff 0%, #5588ff 20%, #2244cc 40%, #1100aa 65%, #050520 100%)',
        boxShadow: '0 0 40px rgba(0,140,255,0.6), 0 0 80px rgba(80,0,255,0.35), inset 0 -4px 12px rgba(0,0,0,0.4), inset 0 2px 10px rgba(255,255,255,0.25)',
        animation: 'reactorPulse 2.5s ease-in-out infinite',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Specular gloss — primary */}
        <div style={{
          position: 'absolute', top: 12, left: 14,
          width: 22, height: 14,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
          transform: 'rotate(-15deg)',
        }} />
        {/* Secondary specular */}
        <div style={{
          position: 'absolute', top: 10, left: 30,
          width: 6, height: 4,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.4)',
        }} />
        {/* Inner energy core */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 18, height: 18, marginTop: -9, marginLeft: -9,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(0,212,255,0.3) 50%, transparent 100%)',
          animation: 'pulseGlow 1.5s ease-in-out infinite alternate',
        }} />
      </div>

      {/* Orbiting energy spark 1 */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 7, height: 7, marginTop: -3.5, marginLeft: -3.5,
        borderRadius: '50%',
        background: '#00ffff',
        boxShadow: '0 0 10px #00ffff, 0 0 20px rgba(0,255,255,0.5)',
        animation: 'orbit 2s linear infinite',
        transformOrigin: '50px 3.5px',
        zIndex: 3,
      }} />

      {/* Orbiting energy spark 2 — opposite direction */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 5, height: 5, marginTop: -2.5, marginLeft: -2.5,
        borderRadius: '50%',
        background: '#cc88ff',
        boxShadow: '0 0 8px #cc88ff, 0 0 16px rgba(204,136,255,0.5)',
        animation: 'orbit 3s linear infinite reverse',
        transformOrigin: '42px 2.5px',
        zIndex: 3,
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
