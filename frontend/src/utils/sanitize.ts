// Utilitaire minimal de sanitation HTML côté client (sans dépendance externe)
// Objectif: autoriser une mise en forme simple (gras, italique, souligné, listes, titres, liens)
// en supprimant les balises/scripts dangereux et les attributs d'événements.
// Note: cette sanitation est volontairement restrictive.

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'ul', 'ol', 'li',
  'h1','h2','h3','h4','h5','h6','blockquote', 'hr', 'span', 'a'
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  span: new Set([]),
};

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
  if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode('');

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    // Remplacer les balises non autorisées par leur texte intérieur
    const fragment = document.createDocumentFragment();
    el.childNodes.forEach((child) => {
      const clean = sanitizeNode(child);
      if (clean) fragment.appendChild(clean);
    });
    return fragment;
  }

  const cleanEl = document.createElement(tag);
  // Nettoyer les attributs: pas d'on*, pas de style inline
  for (const { name, value } of Array.from(el.attributes)) {
    const lower = name.toLowerCase();
    if (lower.startsWith('on') || lower === 'style') continue;
    const allowed = (ALLOWED_ATTRS[tag] && ALLOWED_ATTRS[tag].has(lower));
    if (allowed) {
      // Cas particulier <a>: forcer rel="noreferrer noopener" si target=_blank
      if (tag === 'a' && lower === 'href') {
        try {
          // Autoriser seulement http(s) et mailto
          const safe = value.trim();
          if (/^(https?:|mailto:)/i.test(safe)) {
            cleanEl.setAttribute('href', safe);
          }
        } catch {
          // ignore
        }
      } else if (tag === 'a' && lower === 'target') {
        cleanEl.setAttribute('target', value === '_blank' ? '_blank' : '_self');
      } else if (tag === 'a' && lower === 'rel') {
        cleanEl.setAttribute('rel', 'noreferrer noopener');
      } else {
        cleanEl.setAttribute(lower, value);
      }
    }
  }

  // Sanitize children récursivement
  el.childNodes.forEach((child) => {
    const clean = sanitizeNode(child);
    if (clean) cleanEl.appendChild(clean);
  });

  // Garantir rel si target _blank
  if (tag === 'a' && cleanEl.getAttribute('target') === '_blank') {
    cleanEl.setAttribute('rel', 'noreferrer noopener');
  }

  return cleanEl;
}

export function sanitizeHtml(input: string | null | undefined): string {
  const html = (input ?? '').toString();
  if (!html) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    const frag = document.createDocumentFragment();
    body.childNodes.forEach((n) => {
      const clean = sanitizeNode(n);
      if (clean) frag.appendChild(clean);
    });
    const container = document.createElement('div');
    container.appendChild(frag);
    return container.innerHTML;
  } catch {
    // En cas d'erreur, fallback texte brut
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
}
