// Middleware de rate limiting standardisé
// Toutes les valeurs sont configurées pour la sécurité tout en évitant les faux positifs.
// Commentaires en français conformément aux règles du projet.

const rateLimit = require('express-rate-limit');

// Convertit minutes/heures en millisecondes
const minutes = (n) => n * 60 * 1000;
const hours = (n) => n * 60 * 60 * 1000;

// Lecture robuste d'entiers depuis l'environnement (avec bornes)
const toInt = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const envInt = (name, def, min, max) => clamp(toInt(process.env[name], def), min, max);

// Format de réponse commun (ne pas divulguer d'infos sensibles)
const defaultHandler = (req, res /*, next*/) => {
  return res.status(429).json({
    status: 'error',
    message: 'Trop de requêtes, veuillez réessayer plus tard.'
  });
};

// Paramètres configurables via variables d'environnement (valeurs par défaut entre parenthèses)
// Global: RL_GLOBAL_MAX (300), RL_GLOBAL_WINDOW_MIN (1)
const RL_GLOBAL_MAX = envInt('RL_GLOBAL_MAX', 300, 10, 10000);
const RL_GLOBAL_WINDOW_MIN = envInt('RL_GLOBAL_WINDOW_MIN', 1, 1, 60);

// Auth: RL_AUTH_MAX (10), RL_AUTH_WINDOW_MIN (15)
const RL_AUTH_MAX = envInt('RL_AUTH_MAX', 10, 3, 100);
const RL_AUTH_WINDOW_MIN = envInt('RL_AUTH_WINDOW_MIN', 15, 1, 120);

// Forgot password: RL_FORGOT_MAX (5), RL_FORGOT_WINDOW_MIN (15)
const RL_FORGOT_MAX = envInt('RL_FORGOT_MAX', 5, 1, 50);
const RL_FORGOT_WINDOW_MIN = envInt('RL_FORGOT_WINDOW_MIN', 15, 1, 120);

// Register: RL_REGISTER_MAX (5), RL_REGISTER_WINDOW_MIN (60)
const RL_REGISTER_MAX = envInt('RL_REGISTER_MAX', 5, 1, 50);
const RL_REGISTER_WINDOW_MIN = envInt('RL_REGISTER_WINDOW_MIN', 60, 5, 24 * 60);

// Resend verification: RL_VERIFY_MAX (5), RL_VERIFY_WINDOW_MIN (30)
const RL_VERIFY_MAX = envInt('RL_VERIFY_MAX', 5, 1, 50);
const RL_VERIFY_WINDOW_MIN = envInt('RL_VERIFY_WINDOW_MIN', 30, 5, 24 * 60);

// Limiteur global (edge): protège l'API entière contre les abus généraux
// Valeurs par défaut: 300 req / 1 min / IP
const generalLimiter = rateLimit({
  windowMs: minutes(RL_GLOBAL_WINDOW_MIN),
  max: RL_GLOBAL_MAX,
  standardHeaders: true, // Retourne les en-têtes RateLimit-* standard
  legacyHeaders: false,  // Désactive X-RateLimit-*
  handler: defaultHandler,
});

// Limiteur authentification (login): protège contre le brute force
// 10 tentatives / 15 min / IP (par défaut)
const authLimiter = rateLimit({
  windowMs: minutes(RL_AUTH_WINDOW_MIN),
  max: RL_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});

// Limiteur mot de passe oublié: plus strict
// 5 tentatives / 15 min / IP (par défaut)
const forgotPasswordLimiter = rateLimit({
  windowMs: minutes(RL_FORGOT_WINDOW_MIN),
  max: RL_FORGOT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});

// Limiteur inscription: évite spam d'inscriptions
// 5 tentatives / 60 min / IP (par défaut)
const registerLimiter = rateLimit({
  windowMs: minutes(RL_REGISTER_WINDOW_MIN),
  max: RL_REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});

// Limiteur renvoi vérification email: évite spam d'emails
// 5 tentatives / 30 min / IP (par défaut)
const verifyLimiter = rateLimit({
  windowMs: minutes(RL_VERIFY_WINDOW_MIN),
  max: RL_VERIFY_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});

module.exports = {
  generalLimiter,
  authLimiter,
  forgotPasswordLimiter,
  registerLimiter,
  verifyLimiter,
};
