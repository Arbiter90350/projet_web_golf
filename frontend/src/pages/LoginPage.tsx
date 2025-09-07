import { useState } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginPage.module.css';
import { useToast } from '../contexts/toast-context';
import axios from 'axios';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { makeLoginSchema } from '../validation/auth';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

// Typage léger de la réponse d'erreur axios que nous consommons ici
type ErrorData = { message?: string } | undefined;

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { error: toastError, success: toastSuccess } = useToast();
  const { t } = useTranslation(['auth', 'common']);
  // Formulaire géré par react-hook-form + zod pour la validation
  const schema = makeLoginSchema(t);
  type LoginForm = { email: string; password: string };
  const { register, handleSubmit, formState: { errors }, getValues } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });
  // État local pour gérer le cas d'email non vérifié (403)
  const [needsVerification, setNeedsVerification] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  // Destination initiale (si l'utilisateur a été redirigé par une route protégée)
  type RedirectState = { from?: { pathname: string } } | null;
  const state = location.state as RedirectState;
  const from = state?.from?.pathname || '/';

  const onSubmit = async (values: LoginForm) => {
    if (isLoading) return;
    try {
      await login(values.email, values.password);
      // Redirection vers la destination d'origine ou vers "/"
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
      // Si le backend répond 403 avec un message lié à la vérification email,
      // on propose de renvoyer l'email de vérification directement.
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const msg = (error.response?.data as ErrorData)?.message as string | undefined;
        if (status === 403 && msg && /verify|vérifi/i.test(msg)) {
          setNeedsVerification(msg);
          return;
        }
      }
      // Sinon: toast générique
      toastError(t('auth:messages.login_failed'));
    }
  };

  // Action: renvoi de l'email de vérification
  const handleResendVerification = async () => {
    const email = getValues('email');
    if (!email) {
      toastError(t('auth:messages.enter_email_first'));
      return;
    }
    try {
      setResendLoading(true);
      const { data } = await api.post<{ status?: string; message?: string }>(
        '/auth/resend-verification',
        { email }
      );
      const info = data?.message ?? t('auth:messages.resend_info_generic');
      setResendInfo(info);
      toastSuccess(info);
    } catch (err) {
      // Gestion centralisée via intercepteur + filet de sécurité
      console.error('Resend verification failed:', err);
      toastError(t('auth:messages.send_failed'));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        <div className={styles.brandHeader}>
          <img
            className={styles.logo}
            src="https://golf-rougemont.com/content/uploads/2025/04/golf-logo-vecto-ok-vert-23C796.png"
            alt="Golf de Rougemont"
            loading="eager"
            decoding="async"
          />
        </div>
        <h1 className={styles.title}>{t('auth:title.login')}</h1>
        {/* Bouton d'installation PWA (Android/Chrome/Edge) */}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
          <PWAInstallPrompt
            label={t('common:actions.install_app', { defaultValue: "Installer l'application" })}
            className={styles.button}
          />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">{t('common:fields.email')}</label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className={styles.input}
              required
              autoComplete="email"
            />
            {errors.email && (
              <small className={styles.error} role="alert">{errors.email.message}</small>
            )}
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password">{t('common:fields.password')}</label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              className={styles.input}
              required
              autoComplete="current-password"
            />
            {errors.password && (
              <small className={styles.error} role="alert">{errors.password.message}</small>
            )}
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className={styles.link}
              aria-pressed={showPassword}
              style={{ alignSelf: 'flex-end', marginTop: 6 }}
            >
              {showPassword ? t('common:hide_password') : t('common:show_password')}
            </button>
          </div>
          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? t('auth:actions.logging_in') : t('auth:actions.login')}
          </button>
        </form>
        {/* Panneau d'aide si email non vérifié */}
        {needsVerification && (
          <div className={styles.error} role="alert" style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8 }}>{needsVerification}</div>
            <button
              type="button"
              onClick={handleResendVerification}
              className={styles.button}
              disabled={resendLoading}
            >
              {resendLoading ? t('auth:actions.resending') : t('auth:actions.resend')}
            </button>
            {resendInfo && (
              <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>{resendInfo}</div>
            )}
          </div>
        )}
        <div className={styles.links}>
          <Link to="/forgot-password" className={styles.link}>
            {t('auth:links.forgot_password')}
          </Link>
          <Link to="/register" className={styles.link}>
            {t('auth:links.to_register')}
          </Link>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;