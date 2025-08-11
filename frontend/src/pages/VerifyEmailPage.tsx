import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import axios from 'axios';
import styles from './InfoPage.module.css';
import { useTranslation } from 'react-i18next';

const VerifyEmailPage = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const { t } = useTranslation(['auth']);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage(t('auth:messages.verify_error'));
        return;
      }

      try {
        const res = await api.get(`/auth/verify-email/${token}`);
        setStatus('success');
        setMessage(res.data.message || t('auth:messages.verify_success'));
      } catch (err: unknown) {
        let errorMessage = t('auth:messages.verify_error');
        if (axios.isAxiosError(err) && err.response?.data?.message) {
          errorMessage = err.response.data.message;
        }
        setStatus('error');
        setMessage(errorMessage);
      }
    };

    verifyEmail();
  }, [token, t]);

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return <p className={styles.message}>{t('auth:messages.verify_in_progress')}</p>;
      case 'success':
        return (
          <>
            <h1 className={styles.title}>{t('auth:title.verify_success')}</h1>
            <p className={styles.message}>{message}</p>
            <Link to="/login" className={styles.link}>{t('auth:links.you_can_login_now')}</Link>
          </>
        );
      case 'error':
        return (
          <>
            <h1 className={styles.title}>{t('auth:title.verify_error')}</h1>
            <p className={styles.message}>{message}</p>
            <Link to="/login" className={styles.link}>{t('auth:links.to_login')}</Link>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.infoPage}>
      <div className={styles.infoContainer}>
        {renderContent()}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
