
import { Link } from 'react-router-dom';
import styles from './InfoPage.module.css';
import { useTranslation } from 'react-i18next';

const CheckYourEmailPage = () => {
  const { t } = useTranslation(['auth']);
  return (
    <div className={styles.infoPage}>
      <div className={styles.infoContainer}>
        <h1 className={styles.title}>{t('auth:title.check_email')}</h1>
        <p className={styles.message}>{t('auth:messages.check_email_line1')}</p>
        <p className={styles.message}>{t('auth:messages.check_email_line2')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link to="/resend-verification" className={styles.link}>{t('auth:links.resend_verification')}</Link>
          <Link to="/login" className={styles.link}>{t('auth:links.to_login')}</Link>
        </div>
      </div>
    </div>
  );
};

export default CheckYourEmailPage;
