import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import styles from './RegisterPage.module.css';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { makeRegisterSchema } from '../validation/auth';

const RegisterPage = () => {
  const { t } = useTranslation(['auth', 'common']);
  const schema = makeRegisterSchema(t);
  type RegisterForm = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
  };
  const { register: rhfRegister, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });
  // Méthode d'inscription backend depuis le contexte d'auth
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = React.useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = React.useState(false);
  const [error, setError] = React.useState('');

  // Fonction utilitaire locale pour évaluer la robustesse d'un mot de passe
  // Critères simples: longueur, minuscule, majuscule, chiffre, caractère spécial
  const evaluatePassword = (pwd: string): number => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    // Normalise sur 0..4
    return Math.min(score, 4);
  };

  // Libellé lisible pour l'utilisateur
  const strengthLabel = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return t('common:password.strength.very_weak');
      case 2:
        return t('common:password.strength.weak');
      case 3:
        return t('common:password.strength.medium');
      case 4:
        return t('common:password.strength.strong');
      default:
        return '';
    }
  };

  // Score calculé à partir de la valeur du champ password
  const passwordValue = watch('password');
  const pwdScore = useMemo(() => evaluatePassword(passwordValue || ''), [passwordValue]);

  const onSubmit = async (values: RegisterForm) => {
    setError('');

    try {
      await registerUser({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      });
      navigate('/check-your-email');
    } catch (err: unknown) {
      let errorMessage = t('common:errors.unexpected_error');
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      console.error('Registration failed:', err);
      setError(errorMessage);
    }
  };

  return (
    <div className={styles.registerPage}>
      <div className={styles.registerContainer}>
        <div className={styles.brandHeader}>
          <img
            className={styles.logo}
            src="https://golf-rougemont.com/content/uploads/2025/04/golf-logo-vecto-ok-vert-23C796.png"
            alt="Golf de Rougemont"
            loading="eager"
            decoding="async"
          />
        </div>
        <h1 className={styles.title}>{t('auth:title.register')}</h1>
        {error && <p className={styles.error}>{error}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="firstName">{t('common:fields.first_name')}</label>
            <input id="firstName" type="text" {...rhfRegister('firstName')} className={styles.input} required autoComplete="given-name" />
            {errors.firstName && (
              <small className={styles.error} role="alert">{errors.firstName.message}</small>
            )}
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="lastName">{t('common:fields.last_name')}</label>
            <input id="lastName" type="text" {...rhfRegister('lastName')} className={styles.input} required autoComplete="family-name" />
            {errors.lastName && (
              <small className={styles.error} role="alert">{errors.lastName.message}</small>
            )}
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="email">{t('common:fields.email')}</label>
            <input id="email" type="email" {...rhfRegister('email')} className={styles.input} required autoComplete="email" />
            {errors.email && (
              <small className={styles.error} role="alert">{errors.email.message}</small>
            )}
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password">{t('common:fields.password')}</label>
            <input
              id="password"
              type={showPwd ? 'text' : 'password'}
              {...rhfRegister('password')}
              className={styles.input}
              required
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
            {/* Indicateur visuel de robustesse */}
            <div aria-live="polite" style={{ marginTop: 8 }}>
              <div style={{ height: 6, background: '#eee', borderRadius: 4 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(pwdScore / 4) * 100}%`,
                    background: pwdScore <= 1 ? '#e74c3c' : pwdScore === 2 ? '#f39c12' : pwdScore === 3 ? '#f1c40f' : '#27ae60',
                    borderRadius: 4,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <small style={{ display: 'block', marginTop: 4, color: '#555' }}>
                {t('common:password.strength_prefix')} {strengthLabel(pwdScore)}
              </small>
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">{t('common:fields.confirm_password')}</label>
            <input
              id="confirmPassword"
              type={showConfirmPwd ? 'text' : 'password'}
              {...rhfRegister('confirmPassword')}
              className={styles.input}
              required
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
            {isSubmitting ? t('auth:actions.registering') : t('auth:actions.register')}
          </button>
        </form>
        <Link to="/login" className={styles.link}>
          {t('auth:links.already_have_account')}
        </Link>
      </div>
    </div>
  );
};

export default RegisterPage;