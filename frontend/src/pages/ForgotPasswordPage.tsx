import api from '../services/api';
import styles from './InfoPage.module.css';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/toast-context';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { makeForgotSchema } from '../validation/auth';

const ForgotPasswordPage = () => {
  // RHF + Zod: validation email
  const { t } = useTranslation(['auth', 'common']);
  const schema = makeForgotSchema(t);
  type ForgotForm = { email: string };
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });
  const { success } = useToast();

  const onSubmit = async (values: ForgotForm) => {
    try {
      const { data } = await api.post<{ data?: string }>(
        '/auth/forgot-password',
        { email: values.email }
      );
      // Succès: notification toast
      success(data?.data ?? t('auth:messages.reset_email_sent'));
    } catch {
      // Erreurs: déjà traitées par l'intercepteur global (toast) → ne rien dupliquer ici
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
        <h1 className={styles.title}>{t('auth:title.forgot')}</h1>
        <p className={styles.message}>{t('auth:messages.forgot_intro')}</p>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">{t('common:fields.email')}</label>
            <input
              id="email"
              type="email"
              {...register('email')}
              required
              className={styles.input}
              placeholder={t('common:email_placeholder')}
              autoComplete="email"
            />
            {errors.email && (
              <small className={styles.error} role="alert">{errors.email.message}</small>
            )}
          </div>
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? t('auth:actions.sending') : t('auth:actions.send_link')}
          </button>
        </form>
        <Link to="/login" className={styles.link}>{t('auth:links.to_login')}</Link>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
