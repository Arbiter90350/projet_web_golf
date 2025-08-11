import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../contexts/toast-context';
import styles from './InfoPage.module.css';
import { useTranslation } from 'react-i18next';

// Page de renvoi de l'email de vérification
// - Utilise le provider de toasts pour les messages utilisateur
// - N'expose pas d'information sensible (réponse générique)
const ResendVerificationPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();
  const { t } = useTranslation(['auth', 'common']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      await api.post('/auth/resend-verification', { email });
      success(t('auth:messages.resend_info_generic'));
    } catch {
      // L'intercepteur global affichera une erreur générique
      error(t('auth:messages.send_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.infoPage}>
      <div className={styles.infoContainer}>
        <h1 className={styles.title}>{t('auth:title.resend_verification')}</h1>
        <p className={styles.message}>{t('auth:messages.resend_intro')}</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
          <input
            type="email"
            required
            placeholder={t('common:email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #ccc', minWidth: 260 }}
          />
          <button type="submit" disabled={loading} className={styles.link} style={{ cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? t('auth:actions.resending') : t('auth:actions.resend')}
          </button>
        </form>
        <div style={{ marginTop: 16 }}>
          <Link to="/login" className={styles.link}>{t('auth:links.to_login')}</Link>
        </div>
      </div>
    </div>
  );
};

export default ResendVerificationPage;
