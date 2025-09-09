// Gabarits HTML d'e-mails alignés avec l'identité visuelle du site (Rougemont)
// - Couleurs et styles en inline CSS (compatibilité clients mail)
// - Aucun script ni ressource externe obligatoire
// - Images: facultatives via PUBLIC_ORIGIN (si défini)

const BRAND = {
  bg: '#f3f7f6', // --brand-bg
  primary: '#1d8786', // --brand-primary
  primaryHover: '#163b3f', // --brand-primary-hover
  textStrong: '#163b3f', // --text-strong
  textMuted: '#7ea89e', // --text-muted
  cardBg: '#ffffff', // --card-bg
};

/**
 * Construit le layout d'email HTML.
 * @param {object} params
 * @param {string} params.title - Titre principal
 * @param {string} params.previewText - Texte d'aperçu (preheader)
 * @param {string} params.contentHtml - Contenu HTML (corps)
 * @param {string} [params.publicOrigin] - Origine publique pour les images (ex: https://golf-rougemont.com)
 * @returns {string} HTML complet
 */
function renderLayout({ title, previewText, contentHtml, publicOrigin }) {
  const logoUrl = publicOrigin ? `${publicOrigin}/icons/icon-192.png` : '';
  const safePreview = (previewText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    /* Réinitialisation minimale */
    body { margin: 0; padding: 0; background: ${BRAND.bg}; }
    a { color: ${BRAND.primary}; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <!-- Preheader (masqué visuellement) -->
  <div style="display:none;visibility:hidden;opacity:0;overflow:hidden;height:0;width:0;">${safePreview}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding: 32px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px;background:${BRAND.cardBg};border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.12);">
          <tr>
            <td align="center" style="padding: 28px 22px 10px 22px;">
              ${logoUrl ? `<img src="${logoUrl}" width="72" height="72" alt="Golf Rougemont" style="display:block;border:0;outline:none;text-decoration:none;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.10);" />` : ''}
              <h1 style="margin: 14px 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 22px; color: ${BRAND.textStrong};">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 22px 6px 22px; font-family: Arial, Helvetica, sans-serif; color: ${BRAND.textMuted}; font-size: 14px;">
              Golf de Rougemont‑le‑Château
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 22px 28px 22px; font-family: Arial, Helvetica, sans-serif; color: ${BRAND.textStrong}; font-size: 15px; line-height: 1.6;">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 22px 22px 22px; font-family: Arial, Helvetica, sans-serif; color: ${BRAND.textMuted}; font-size: 12px; border-top: 1px solid #e5e7eb;">
              Cet e‑mail vous est envoyé automatiquement. Merci de ne pas y répondre directement.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email de vérification d'adresse e‑mail.
 * @param {object} params
 * @param {string} params.verificationUrl
 * @param {('fr'|'en')} [params.locale='fr']
 * @param {string} [params.publicOrigin]
 * @returns {{ subject: string, html: string }}
 */
function verificationEmail({ verificationUrl, locale = 'fr', publicOrigin }) {
  const isFr = (locale || 'fr').toLowerCase().startsWith('fr');

  const title = isFr ? 'Vérification de votre adresse e‑mail' : 'Verify your email address';
  const preview = isFr
    ? 'Confirmez votre adresse e‑mail pour activer votre compte.'
    : 'Confirm your email address to activate your account.';

  const btnLabel = isFr ? 'Vérifier mon adresse e‑mail' : 'Verify my email';
  const altText = isFr ? 'Si le bouton ne s’affiche pas, utilisez ce lien :' : 'If the button does not appear, use this link:';

  const buttonHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 12px 0;">
      <tr>
        <td align="center" bgcolor="${BRAND.primary}" style="border-radius:8px;">
          <a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;color:#ffffff;background:${BRAND.primary};border:1px solid ${BRAND.primary};border-radius:8px;font-weight:bold;">
            ${btnLabel}
          </a>
        </td>
      </tr>
    </table>`;

  const content = `
    <p>${isFr ? 'Bonjour,' : 'Hello,'}</p>
    <p>${isFr
      ? 'Merci de votre inscription. Pour finaliser la création de votre compte, veuillez confirmer votre adresse e‑mail en cliquant sur le bouton ci‑dessous.'
      : 'Thanks for signing up. To finish creating your account, please confirm your email address by clicking the button below.'}
    </p>
    ${buttonHtml}
    <p>${altText} <br /><a href="${verificationUrl}">${verificationUrl}</a></p>
  `;

  const html = renderLayout({ title, previewText: preview, contentHtml: content, publicOrigin });
  const subject = isFr ? 'Vérification de votre adresse e‑mail' : 'Email Verification';

  return { subject, html };
}

module.exports = {
  verificationEmail,
  renderLayout,
};
