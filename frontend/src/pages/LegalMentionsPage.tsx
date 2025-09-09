import { useTranslation } from 'react-i18next';
import styles from './LegalMentionsPage.module.css';

// Page Mentions Légales
// - Tout le contenu vient d'i18n (namespace "legal").
// - Aucun texte en dur pour respecter l'i18n et faciliter d'éventuelles traductions futures.
// - Mise en page simple et lisible.

export default function LegalMentionsPage() {
  const { t } = useTranslation(['legal']);

  // Utilitaire pour récupérer des tableaux depuis i18n
  const arr = (key: string): string[] => t(key, { returnObjects: true }) as unknown as string[];
  const cnilText = (t('legal:sections.data_protection.cnil') as unknown as string) || '';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1>{t('legal:title')}</h1>
        <div className={styles.lastUpdated}>{t('legal:last_updated')}</div>
        <div className={styles.section}><p>{t('legal:intro')}</p></div>

        {/* 1. Éditeur */}
        <section className={styles.section}>
          <h2>{t('legal:sections.publisher.title')}</h2>
          <ul className={styles.list}>
            {arr('legal:sections.publisher.content').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </section>

        {/* 2. Hébergement */}
        <section className={styles.section}>
          <h2>{t('legal:sections.hosting.title')}</h2>
          <ul className={styles.list}>
            {arr('legal:sections.hosting.content').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </section>

        {/* 3. Propriété intellectuelle */}
        <section className={styles.section}>
          <h2>{t('legal:sections.ip.title')}</h2>
          {arr('legal:sections.ip.content').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </section>

        {/* 4. Données personnelles (RGPD) */}
        <section className={styles.section}>
          <h2>{t('legal:sections.data_protection.title')}</h2>
          <p>{t('legal:sections.data_protection.commitment')}</p>

          <h3>{t('legal:sections.data_protection.purposes_title')}</h3>
          <ul className={styles.list}>
            {arr('legal:sections.data_protection.purposes').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>

          <h3>{t('legal:sections.data_protection.legal_bases_title')}</h3>
          <ul className={styles.list}>
            {arr('legal:sections.data_protection.legal_bases').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>

          <h3>{t('legal:sections.data_protection.data_categories_title')}</h3>
          <ul className={styles.list}>
            {arr('legal:sections.data_protection.data_categories').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>

          <h3>{t('legal:sections.data_protection.recipients_title')}</h3>
          <ul className={styles.list}>
            {arr('legal:sections.data_protection.recipients').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>

          <h3>{t('legal:sections.data_protection.processors_title')}</h3>
          <ul className={styles.list}>
            {arr('legal:sections.data_protection.processors').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>

          <h3>{t('legal:sections.data_protection.storage_title')}</h3>
          <ul className={styles.list}>
            {arr('legal:sections.data_protection.storage').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>

          {arr('legal:sections.data_protection.retention').length > 0 && (
            <>
              <h3>{t('legal:sections.data_protection.retention_title')}</h3>
              <ul className={styles.list}>
                {arr('legal:sections.data_protection.retention').map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </>
          )}

          <h3>{t('legal:sections.data_protection.rights_title')}</h3>
          <ul className={styles.list}>
            {arr('legal:sections.data_protection.rights').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>

          {cnilText && cnilText.trim().length > 0 && (
            <p>{cnilText}</p>
          )}
        </section>

        {/* 5. Cookies et traceurs */}
        <section className={styles.section}>
          <h2>{t('legal:sections.cookies.title')}</h2>
          <ul className={styles.list}>
            {arr('legal:sections.cookies.items').map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </section>

        {/* 6. Responsabilité */}
        <section className={styles.section}>
          <h2>{t('legal:sections.liability.title')}</h2>
          {arr('legal:sections.liability.content').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </section>

        {/* 7. Droit applicable */}
        <section className={styles.section}>
          <h2>{t('legal:sections.law.title')}</h2>
          {arr('legal:sections.law.content').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </section>

        {/* 8. Modifications des CGU */}
        <section className={styles.section}>
          <h2>{t('legal:sections.terms_updates.title')}</h2>
          {arr('legal:sections.terms_updates.content').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </section>

        {/* Contact */}
        <section className={styles.section}>
          <h2>{t('legal:sections.contact.title')}</h2>
          {arr('legal:sections.contact.content').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </section>
      </div>
    </div>
  );
}
