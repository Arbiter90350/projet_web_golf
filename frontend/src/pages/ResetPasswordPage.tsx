import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import styles from './InfoPage.module.css';
import { useToast } from '../contexts/toast-context';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { makeResetSchema } from '../validation/auth';

const ResetPasswordPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess } = useToast();
  const { t } = useTranslation(['auth', 'common']);

  // RHF + Zod: validation des champs password/confirmPassword
  const schema = makeResetSchema(t);
  type ResetForm = { password: string; confirmPassword: string };
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetForm>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });
  // UI: montrer/masquer mots de passe
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const onSubmit = async (values: ResetForm) => {
    try {
      const { data } = await api.put<{ message?: string }>(
        `/auth/reset-password/${token}`,
        { password: values.password }
      );
      // Succès: toast + redirection différée
      const msg = data?.message ?? t('auth:messages.reset_success');
      toastSuccess(msg);
      setTimeout(() => navigate('/login'), 2000);
    } catch {
      // Erreurs API: déjà toasts via intercepteur global
      // On évite les doublons de messages ici.
    }
  };

  return (
    <div className={styles.infoPage}>
      <div className={styles.infoContainer}>
        <div className={styles.brandHeader}>
          <img
            className={styles.logo}
            src="https://golf-rougemont.com/content/uploads/2025/04/golf-logo-vecto-ok-vert-23C796.png"
            alt="Golf de Rougemont"
            loading="eager"
            decoding="async"
          />
        </div>
        <h1 className={styles.title}>{t('auth:title.reset')}</h1>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="password">{t('common:fields.new_password')}</label>
            <input
              id="password"
              type={showPwd ? 'text' : 'password'}
              {...register('password')}
              required
              className={styles.input}
              autoComplete="new-password"
            />
            {errors.password && (
              <small className={styles.error} role="alert">{errors.password.message}</small>
            )}
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className={styles.link}
              aria-pressed={showPwd}
              style={{ alignSelf: 'flex-end', marginTop: 6 }}
            >
              {showPwd ? t('common:hide_password') : t('common:show_password')}
            </button>
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">{t('common:fields.confirm_password')}</label>
            <input
              id="confirmPassword"
              type={showConfirmPwd ? 'text' : 'password'}
              {...register('confirmPassword')}
              required
              className={styles.input}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <small className={styles.error} role="alert">{errors.confirmPassword.message}</small>
            )}
            <button
              type="button"
              onClick={() => setShowConfirmPwd((v) => !v)}
              className={styles.link}
              aria-pressed={showConfirmPwd}
              style={{ alignSelf: 'flex-end', marginTop: 6 }}
            >
              {showConfirmPwd ? t('common:hide_password') : t('common:show_password')}
            </button>
          </div>
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? t('auth:actions.resetting') : t('auth:actions.reset')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
