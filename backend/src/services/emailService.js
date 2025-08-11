// Service d'email multi-fournisseur (SMTP OVH par défaut, SendGrid en option)
// ATTENTION: toutes les variables sensibles doivent venir des variables d'environnement
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');
require('dotenv').config();

// Création d'un transport SMTP (OVH Exchange)
function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) return null;

  // OVH Exchange: STARTTLS via port 587
  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
  });
}

/**
 * Envoie un email via SendGrid.
 * @param {string} to - Adresse email du destinataire.
 * @param {string} subject - Sujet de l'email.
 * @param {string} html - Contenu HTML de l'email.
 */
const sendEmail = async (to, subject, html) => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  const isProd = (process.env.NODE_ENV || 'development') === 'production';

  if (!to || !subject || !html) {
    throw new Error('Paramètres email invalides (to/subject/html)');
  }

  // Fournisseur SMTP (OVH Exchange par défaut)
  if (provider === 'smtp') {
    const from = process.env.EMAIL_FROM; // ex: "Golf Rougemont <noreply@golf-rougemont.com>"
    const transport = createSmtpTransport();

    if (!from || !transport) {
      if (!isProd) {
        logger.info('[email:DEV:SMTP] Aucun envoi réel. Aperçu du message', { to, subject });
        return;
      }
      throw new Error('Configuration SMTP manquante (EMAIL_FROM/SMTP_*)');
    }

    try {
      await transport.sendMail({
        from,
        to,
        subject,
        html,
        // Certains serveurs exigent que l'enveloppe (MAIL FROM) corresponde au compte authentifié
        // IMPORTANT: si on fournit une enveloppe, il faut aussi y inclure les destinataires,
        // sinon Nodemailer lève "No recipients defined (EENVELOPE)".
        // On normalise donc le champ `to` en tableau pour l'enveloppe.
        envelope: {
          from: process.env.SMTP_USER,
          to: Array.isArray(to)
            ? to
            : (typeof to === 'string'
                ? to.split(',').map((addr) => addr.trim()).filter(Boolean)
                : []),
        },
      });
      logger.info('[email:SMTP] Envoyé', { to });
      return;
    } catch (error) {
      logger.error('[email:SMTP] Échec d\'envoi', { to, message: error?.message, code: error?.code });
      throw new Error('L\'email n\'a pas pu être envoyé (SMTP).');
    }
  }

  // Fournisseur SendGrid (optionnel)
  if (provider === 'sendgrid') {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      if (!isProd) {
        logger.info('[email:DEV:SG] Aucun envoi réel. Aperçu du message', { to, subject });
        return;
      }
      throw new Error('Configuration SendGrid manquante (SENDGRID_API_KEY/EMAIL_FROM)');
    }

    try {
      sgMail.setApiKey(apiKey);
      await sgMail.send({ to, from, subject, html });
      logger.info('[email:SG] Envoyé', { to });
      return;
    } catch (error) {
      logger.error('[email:SG] Échec d\'envoi', { to, message: error?.message, code: error?.code });
      throw new Error('L\'email n\'a pas pu être envoyé (SendGrid).');
    }
  }

  throw new Error(`Fournisseur d'email inconnu: ${provider}`);
};

module.exports = { sendEmail };
