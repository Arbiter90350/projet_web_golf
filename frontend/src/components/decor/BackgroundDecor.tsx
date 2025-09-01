import React from 'react';
import { useLocation } from 'react-router-dom';

// Composant décoratif global : fines courbes en coins (contour lines)
// - Non interactif (pointer-events: none)
// - Placé en position fixe derrière toute l'app
// - Variante automatique selon la route (auth / dashboard / instructor / admin / player)

const CornerWavesTL = () => (
  <svg className="decor-corner decor-tl" viewBox="0 0 300 300" aria-hidden focusable="false">
    <g stroke="currentColor" strokeWidth="0.8" fill="none" opacity="var(--decor-opacity)">
      <path d="M0,160 C60,120 120,120 180,160" />
      <path d="M0,140 C60,100 130,100 200,140" />
      <path d="M0,120 C70,80 150,80 220,120" />
      <path d="M0,100 C80,60 170,60 240,100" />
      <path d="M0,80  C90,40  190,40  260,80" />
      <path d="M0,60  C100,20 210,20 280,60" />
      <path d="M0,40  C110,0  230,0  300,40" />
    </g>
  </svg>
);

const CornerWavesBR = () => (
  <svg className="decor-corner decor-br" viewBox="0 0 300 300" aria-hidden focusable="false">
    <g stroke="currentColor" strokeWidth="0.8" fill="none" opacity="var(--decor-opacity)">
      <path d="M300,140 C240,180 180,180 120,140" />
      <path d="M300,160 C240,200 170,200 100,160" />
      <path d="M300,180 C230,220 150,220 80,180" />
      <path d="M300,200 C220,240 130,240 60,200" />
      <path d="M300,220 C210,260 110,260 40,220" />
      <path d="M300,240 C200,280 90,280  20,240" />
      <path d="M300,260 C190,300 70,300  0,260" />
    </g>
  </svg>
);

const DotGrid = () => (
  <svg className="decor-grid" viewBox="0 0 200 200" aria-hidden focusable="false">
    <defs>
      <pattern id="dot" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="currentColor" opacity="calc(var(--decor-opacity) * 0.7)" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot)" />
  </svg>
);

function useVariantFromPath(pathname: string): 'auth' | 'player' | 'instructor' | 'admin' | 'dashboard' | 'plain' {
  if (/^\/(login|register|forgot-password|reset-password|check-your-email|verify-email|resend-verification)/.test(pathname)) return 'auth';
  if (/^\/instructor\//.test(pathname)) return 'instructor';
  if (/^\/admin\//.test(pathname)) return 'admin';
  if (/^\/dashboard/.test(pathname)) return 'dashboard';
  if (/^\/(courses|lessons)/.test(pathname)) return 'player';
  return 'plain';
}

const BackgroundDecor: React.FC = () => {
  const { pathname } = useLocation();
  const variant = useVariantFromPath(pathname);

  // Couleur par variante (hérite via currentColor)
  let className = 'decor-root';
  switch (variant) {
    case 'auth':
      className += ' decor-auth';
      break;
    case 'player':
      className += ' decor-player';
      break;
    case 'instructor':
      className += ' decor-instructor';
      break;
    case 'admin':
      className += ' decor-admin';
      break;
    case 'dashboard':
      className += ' decor-dashboard';
      break;
    default:
      className += ' decor-plain';
  }

  return (
    <div className={className} aria-hidden>
      {/* Couche image de fond (configurée via CSS variables selon la page) */}
      <div className="decor-image" />
      {/* Coins avec ondes fines */}
      <CornerWavesTL />
      <CornerWavesBR />
      {/* Grille de points douce pour certaines variantes */}
      {(variant === 'instructor' || variant === 'admin') && <DotGrid />}
    </div>
  );
};

export default BackgroundDecor;
