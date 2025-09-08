import { useTranslation } from 'react-i18next';

// Page Mentions Légales
// - Tout le contenu vient d'i18n (namespace "legal").
// - Aucun texte en dur pour respecter l'i18n et faciliter d'éventuelles traductions futures.
// - Mise en page simple et lisible.

export default function LegalMentionsPage() {
  const { t } = useTranslation(['legal']);

  // Utilitaire pour récupérer des tableaux depuis i18n
  const arr = (key: string): string[] => t(key, { returnObjects: true }) as unknown as string[];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ marginBottom: 8 }}>{t('legal:title')}</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{t('legal:last_updated')}</div>
      <p style={{ marginBottom: 20 }}>{t('legal:intro')}</p>

      {/* 1. Éditeur */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>{t('legal:sections.publisher.title')}</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
          {arr('legal:sections.publisher.content').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </section>

      {/* 2. Hébergement */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>{t('legal:sections.hosting.title')}</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
          {arr('legal:sections.hosting.content').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </section>

      {/* 3. Propriété intellectuelle */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>{t('legal:sections.ip.title')}</h2>
        {arr('legal:sections.ip.content').map((line, idx) => (
          <p key={idx} style={{ marginBottom: 8 }}>{line}</p>
        ))}
      </section>

      {/* 4. Données personnelles (RGPD) */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>{t('legal:sections.data_protection.title')}</h2>
        <p style={{ marginBottom: 12 }}>{t('legal:sections.data_protection.commitment')}</p>

        <h3 style={{ marginBottom: 6 }}>{t('legal:sections.data_protection.purposes_title')}</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6, marginBottom: 12 }}>
          {arr('legal:sections.data_protection.purposes').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 6 }}>{t('legal:sections.data_protection.legal_bases_title')}</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6, marginBottom: 12 }}>
          {arr('legal:sections.data_protection.legal_bases').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 6 }}>{t('legal:sections.data_protection.data_categories_title')}</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6, marginBottom: 12 }}>
          {arr('legal:sections.data_protection.data_categories').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 6 }}>{t('legal:sections.data_protection.recipients_title')}</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6, marginBottom: 12 }}>
          {arr('legal:sections.data_protection.recipients').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 6 }}>{t('legal:sections.data_protection.processors_title')}</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6, marginBottom: 12 }}>
          {arr('legal:sections.data_protection.processors').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 6 }}>{t('legal:sections.data_protection.storage_title')}</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6, marginBottom: 12 }}>
          {arr('legal:sections.data_protection.storage').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 6 }}>{t('legal:sections.data_protection.retention_title')}</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6, marginBottom: 12 }}>
          {arr('legal:sections.data_protection.retention').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 6 }}>{t('legal:sections.data_protection.rights_title')}</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6, marginBottom: 12 }}>
          {arr('legal:sections.data_protection.rights').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>

        <p style={{ marginTop: 8 }}>{t('legal:sections.data_protection.cnil')}</p>
      </section>

      {/* 5. Cookies et traceurs */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>{t('legal:sections.cookies.title')}</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
          {arr('legal:sections.cookies.items').map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </section>

      {/* 6. Responsabilité */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>{t('legal:sections.liability.title')}</h2>
        {arr('legal:sections.liability.content').map((line, idx) => (
          <p key={idx} style={{ marginBottom: 8 }}>{line}</p>
        ))}
      </section>

      {/* 7. Droit applicable */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>{t('legal:sections.law.title')}</h2>
        {arr('legal:sections.law.content').map((line, idx) => (
          <p key={idx} style={{ marginBottom: 8 }}>{line}</p>
        ))}
      </section>

      {/* Contact */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>{t('legal:sections.contact.title')}</h2>
        {arr('legal:sections.contact.content').map((line, idx) => (
          <p key={idx} style={{ marginBottom: 8 }}>{line}</p>
        ))}
      </section>
    </div>
  );
}
