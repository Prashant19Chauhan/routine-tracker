import React, { useEffect, useState } from 'react';

export default function DailyBoss({ bossHP, playerHP }) {
  const [isDamaged, setIsDamaged] = useState(false);
  const [prevHP, setPrevHP] = useState(bossHP);

  useEffect(() => {
    if (bossHP < prevHP) {
      setIsDamaged(true);
      const timer = setTimeout(() => setIsDamaged(false), 500);
      setPrevHP(bossHP);
      return () => clearTimeout(timer);
    }
    setPrevHP(bossHP);
  }, [bossHP, prevHP]);

  const isDefeated = bossHP <= 0;
  const isPlayerDead = playerHP <= 0;

  const getBossTaunt = () => {
    if (isDefeated) return "NO! My shadow shield is shattered! Curse your consistency... 💀";
    if (isPlayerDead) return "Bwahaha! Your budget is dead! I claim your streak! 💀";
    if (playerHP < 60) return "Keep spending money! Your wallet is bleeding! 💸";
    if (bossHP >= 100) return "Not a single routine completed? Sloth is my favorite flavor... 😴";
    if (bossHP <= 30) return "Huff... huff... your discipline is burning me! Stop! 😫";
    return "Is that all? I smell a broken streak tonight... 🍽️";
  };

  return (
    <div className={`glass-card boss-card ${isDamaged ? 'boss-shake' : ''}`}>
      <h3 style={{ textTransform: 'uppercase', fontSize: '1rem', fontWeight: 800, color: 'var(--accent-red)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        Daily Active Boss
      </h3>
      
      {/* Speech Bubble */}
      <div className="boss-speech-bubble">
        {getBossTaunt()}
      </div>

      {isDefeated && (
        <div className="victory-overlay">
          <div className="victory-banner">BOSS DEFEATED! ⚔️</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>+2.0 SCORE PATH GAINED</p>
        </div>
      )}

      {isPlayerDead && !isDefeated && (
        <div className="victory-overlay" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--accent-red)' }}>
          <div className="victory-banner" style={{ color: 'var(--accent-red)' }}>DEFEATED BY BUDGET! 💀</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Streak at Risk - Rectify spending!</p>
        </div>
      )}

      {/* SVG Boss Avatar */}
      <div className="boss-avatar">
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Monster Body */}
          <path d="M50 15 L80 45 L70 80 L30 80 L20 45 Z" fill={isDefeated ? '#475569' : '#1e1b4b'} stroke={isDefeated ? '#64748b' : '#ef4444'} strokeWidth="3" />
          {/* Glowing Eyes */}
          <circle cx="40" cy="45" r="5" fill={isDefeated ? '#94a3b8' : '#ff1744'} className={isDefeated ? '' : 'fire-emoji'} />
          <circle cx="60" cy="45" r="5" fill={isDefeated ? '#94a3b8' : '#ff1744'} className={isDefeated ? '' : 'fire-emoji'} />
          {/* Spikes */}
          <path d="M50 5 L45 15 L55 15 Z" fill={isDefeated ? '#64748b' : '#f97316'} />
          <path d="M20 45 L10 40 L18 50 Z" fill={isDefeated ? '#64748b' : '#f97316'} />
          <path d="M80 45 L90 40 L82 50 Z" fill={isDefeated ? '#64748b' : '#f97316'} />
          {/* Mean Mouth */}
          {isDefeated ? (
            <line x1="40" y1="65" x2="60" y2="65" stroke="#64748b" strokeWidth="2" />
          ) : (
            <path d="M35 60 Q50 75 65 60" stroke="#ef4444" strokeWidth="3" fill="none" />
          )}
        </svg>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
          {isDefeated ? 'Slain Beast' : 'Procrastination Shadow'}
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {isDefeated ? 'HP depleted. Streak protected.' : 'Level 24 Habit Raider'}
        </p>
      </div>

      {/* HP Bars */}
      <div className="boss-bar-container">
        <div className="boss-bar-label">
          <span style={{ color: 'var(--accent-red)' }}>BOSS HP</span>
          <span>{Math.round(bossHP)}/100</span>
        </div>
        <div className="hp-bar">
          <div className="hp-fill boss" style={{ width: `${Math.max(0, bossHP)}%` }}></div>
        </div>
      </div>

      <div className="boss-bar-container">
        <div className="boss-bar-label">
          <span style={{ color: 'var(--accent-green)' }}>YOUR HP (BUDGET SLOTS)</span>
          <span>{Math.round(playerHP)}/100</span>
        </div>
        <div className="hp-bar">
          <div className="hp-fill player" style={{ width: `${Math.max(0, playerHP)}%` }}></div>
        </div>
      </div>
    </div>
  );
}
