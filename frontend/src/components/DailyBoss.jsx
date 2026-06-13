import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, Zap } from 'lucide-react';

export default function DailyBoss({ bossHP, playerHP, tasksTotal = 0 }) {
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

  // If there are no tasks, the audit is not passed, threat is 100%
  const effectiveBossHP = tasksTotal === 0 ? 100 : bossHP;
  const isDefeated = tasksTotal > 0 && effectiveBossHP <= 0;
  const isPlayerDead = playerHP <= 0;

  const getAuditMessage = () => {
    if (tasksTotal === 0) {
      return "CRITICAL VOID: Koi goals registered nahi hain. Bina kisi plan ya schedule ke drifting kar raha hai. Faltu inertia par jeena band kar, sabse bada failure hai ye. Pehle goals set kar. ⚠️";
    }
    if (isDefeated) {
      return "AUDIT REPORT – Good Performance: Bhai, aaj thoda sense aaya lagta hai. Sahi khel raha hai. Important tasks tick kiye, reels/bakchodi se door raha. Consistent raha toh zindagi mein kuch ban sakta hai. 🛡️";
    }
    if (isPlayerDead) {
      return "AUDIT REPORT – Budget Dead: Arre bhai, budget collapse ho chuka hai! Future freedom ko bekar cheezon pe paise uda ke bech diya tu ne. Ye spending nahi, self-sabotage hai. Sudhar ja. 💀";
    }
    if (playerHP < 60) {
      return "WARNING: Wallet leak ho raha hai. Chhote-chhote bekar kharchon pe paise uda raha hai. Emergency fund zero hone wala hai. Control kar, warna mahine ke end mein roye ga. 💸";
    }
    if (effectiveBossHP >= 100) {
      return "AUDIT REPORT – Zero Productivity: Ek bhi task nahi kiya? Pura din phone pakad ke reels aur comfort zone mein apni zindagi barbaad kar raha hai? Aise gareeb hi reh jayega. ⚠️";
    }
    if (effectiveBossHP > 60) {
      return "AUDIT REPORT – Bad Performance: Faltu timepass chal raha hai din bhar. Goals ke sath compromises karna band kar. Time waste kam kar aur phone side rakh ke kaam kar. ❌";
    }
    if (effectiveBossHP > 30) {
      return "REPORT: Half-hearted effort. 2-3 tasks tick karke medal chahiye kya? Ye toh baseline expectations hain. Fatigue aate hi scroll karna band kar. 💤";
    }
    return "REPORT: Finish line ke paas aake chor diya. Kuch tasks pending chhodna real world mein fail hone jaisa hai. Aise laziness mat dikha, task poora kar. ⏳";
  };

  const getThreatLabel = () => {
    if (tasksTotal === 0) return 'Stagnation Threat: ABSOLUTE VOID';
    if (isDefeated) return 'Audit Cleared';
    if (effectiveBossHP >= 80) return 'Stagnation Threat: CRITICAL';
    if (effectiveBossHP >= 40) return 'Stagnation Threat: ELEVATED';
    return 'Stagnation Threat: DECREASING';
  };

  return (
    <div className={`glass-card boss-card ${isDamaged ? 'boss-shake' : ''}`} style={{ border: '1px solid rgba(239, 68, 68, 0.15)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Visual scanning laser line animation */}
      {!isDefeated && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--accent-red), transparent)',
          boxShadow: '0 0 10px var(--accent-red)',
          animation: 'scan-laser 4s infinite linear',
          pointerEvents: 'none',
          zIndex: 5
        }}></div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 900, color: 'var(--accent-red)', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Activity size={14} className={isDefeated ? '' : 'fire-emoji'} />
          <span>REALITY AUDIT ENGINE v1.2</span>
        </h3>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px', 
          background: isDefeated ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: isDefeated ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${isDefeated ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
        }}>
          {isDefeated ? 'ONLINE / SAFE' : 'ACTIVE AUDIT'}
        </span>
      </div>
      
      {/* System Readout Box */}
      <div className="boss-speech-bubble" style={{ 
        maxWidth: '100%', 
        background: 'rgba(17, 24, 39, 0.9)', 
        border: `1px solid ${isDefeated ? 'var(--accent-green)' : isPlayerDead ? 'var(--accent-red)' : 'rgba(239, 68, 68, 0.3)'}`, 
        fontFamily: 'monospace',
        fontSize: '0.825rem',
        lineHeight: '1.45',
        color: '#f9fafb',
        borderRadius: '6px',
        padding: '0.85rem 1rem',
        boxShadow: isDefeated ? '0 0 15px rgba(16, 185, 129, 0.15)' : '0 0 15px rgba(239, 68, 68, 0.15)',
        animation: 'none',
        textAlign: 'left'
      }}>
        {getAuditMessage()}
      </div>

      {isDefeated && (
        <div className="victory-overlay" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'var(--accent-green)' }}>
          <div className="victory-banner" style={{ color: 'var(--accent-green)', letterSpacing: '0.05em' }}>AUDIT COMPLIANCE SECURED 🛡️</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 700 }}>PEER DRIFT METRIC: STABILIZED</p>
        </div>
      )}

      {isPlayerDead && !isDefeated && (
        <div className="victory-overlay" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--accent-red)' }}>
          <div className="victory-banner" style={{ color: 'var(--accent-red)', letterSpacing: '0.05em' }}>FINANCIAL EXHAUSTION STATE 💀</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 700 }}>AUDIT COMPLIANCE FAIL RATE: 100%</p>
        </div>
      )}

      {/* High-Tech Auditor Visual Scanner Core */}
      <div className="boss-avatar" style={{ margin: '1rem auto' }}>
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Cybernetic outer rings */}
          <circle cx="50" cy="50" r="45" stroke={isDefeated ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'} strokeWidth="1.5" strokeDasharray="5 5" />
          <circle cx="50" cy="50" r="38" stroke={isDefeated ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.4)'} strokeWidth="2" />
          <circle cx="50" cy="50" r="32" stroke={isDefeated ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'} strokeWidth="1" />
          
          {/* Target Reticle crosses */}
          <line x1="50" y1="5" x2="50" y2="25" stroke={isDefeated ? 'var(--accent-green)' : 'var(--accent-red)'} strokeWidth="1.5" style={{ opacity: 0.6 }} />
          <line x1="50" y1="75" x2="50" y2="95" stroke={isDefeated ? 'var(--accent-green)' : 'var(--accent-red)'} strokeWidth="1.5" style={{ opacity: 0.6 }} />
          <line x1="5" y1="50" x2="25" y2="50" stroke={isDefeated ? 'var(--accent-green)' : 'var(--accent-red)'} strokeWidth="1.5" style={{ opacity: 0.6 }} />
          <line x1="75" y1="50" x2="95" y2="50" stroke={isDefeated ? 'var(--accent-green)' : 'var(--accent-red)'} strokeWidth="1.5" style={{ opacity: 0.6 }} />

          {/* Central Scanner Eye */}
          <circle cx="50" cy="50" r="20" fill="rgba(11, 13, 19, 0.85)" stroke={isDefeated ? 'var(--accent-green)' : 'var(--accent-red)'} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="10" fill={isDefeated ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'} />
          
          {/* Glowing Aperture Iris */}
          <circle cx="50" cy="50" r="6" fill={isDefeated ? 'var(--accent-green)' : 'var(--accent-red)'} style={{
            filter: `drop-shadow(0 0 6px ${isDefeated ? 'var(--accent-green)' : 'var(--accent-red)'})`,
            animation: isDefeated ? 'none' : 'ping 2s infinite ease-in-out'
          }} />
          
          {/* Digital Glitch/Aperture lines */}
          {!isDefeated && (
            <>
              <line x1="40" y1="36" x2="60" y2="36" stroke="var(--accent-red)" strokeWidth="1" />
              <line x1="40" y1="64" x2="60" y2="64" stroke="var(--accent-red)" strokeWidth="1" />
            </>
          )}
        </svg>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '0.02em', color: '#fff' }}>
          {isDefeated ? 'System Stabilized' : 'The Grim Auditor'}
        </h4>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {getThreatLabel()}
        </p>
      </div>

      {/* HP Bars representing Mediocrity and Financial Reserve */}
      <div className="boss-bar-container" style={{ marginBottom: '0.75rem' }}>
        <div className="boss-bar-label">
          <span style={{ color: 'var(--accent-red)', fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.05em' }}>
            MEDIOCRITY SLIP RATE (AUDIT THREAT)
          </span>
          <span style={{ fontWeight: 800 }}>{Math.round(effectiveBossHP)}%</span>
        </div>
        <div className="hp-bar" style={{ background: 'rgba(255,255,255,0.03)', height: '8px' }}>
          <div 
            className="hp-fill boss" 
            style={{ 
              width: `${Math.max(0, effectiveBossHP)}%`, 
              background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-red))',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)'
            }}
          ></div>
        </div>
      </div>

      <div className="boss-bar-container">
        <div className="boss-bar-label">
          <span style={{ color: 'var(--accent-green)', fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.05em' }}>
            FINANCIAL FREEDOM INDEX (BUDGET RESERVE)
          </span>
          <span style={{ fontWeight: 800 }}>{Math.round(playerHP)}%</span>
        </div>
        <div className="hp-bar" style={{ background: 'rgba(255,255,255,0.03)', height: '8px' }}>
          <div 
            className="hp-fill player" 
            style={{ 
              width: `${Math.max(0, playerHP)}%`, 
              background: 'linear-gradient(90deg, var(--accent-green), var(--accent-cyan))',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
