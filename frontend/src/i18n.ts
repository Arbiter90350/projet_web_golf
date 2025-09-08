// Initialisation i18n (FR par défaut)
// Tous les commentaires sont en français (exigence projet)
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Ressources locales (JSON)
import frCommon from './locales/fr/common.json';
import frAuth from './locales/fr/auth.json';
import frLegal from './locales/fr/legal.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        common: frCommon,
        auth: frAuth,
        legal: frLegal,
      },
    },
    supportedLngs: ['fr'],
    fallbackLng: 'fr',
    defaultNS: 'common',
    ns: ['common', 'auth', 'legal'],
    interpolation: { escapeValue: false },
    detection: {
      // Détection simple; on force fr si rien
      order: ['querystring', 'cookie', 'localStorage', 'navigator'],
      caches: ['localStorage', 'cookie'],
    },
  });

export default i18n;
