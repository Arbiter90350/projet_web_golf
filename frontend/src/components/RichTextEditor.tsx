import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeHtml, toSafeHtml } from '../utils/sanitize';

// Éditeur riche minimal avec barre d'outils flottante (gras/italique/souligné/H1/H2/H3/clear)
// - Utilise contentEditable
// - Sanitize à l'entrée (paste) et à la sortie (onChange)
// - Conserve les retours à la ligne si le contenu est du texte simple
// - Aucun style inline autorisé (conforme à la CSP et à sanitize)

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

const BUTTON_STYLE: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  background: 'white',
  borderRadius: 6,
  height: 30,
  padding: '0 8px',
  cursor: 'pointer',
};

const TOOLBAR_STYLE: React.CSSProperties = {
  position: 'absolute',
  zIndex: 1000,
  display: 'flex',
  gap: 6,
  padding: 6,
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
};

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 140 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const [internalHtml, setInternalHtml] = useState<string>('');
  // Mémoriser la dernière sélection (range) pour pouvoir la restaurer lors d'un clic sur la toolbar
  const lastRangeRef = useRef<Range | null>(null);
  const isMouseDownRef = useRef(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // MàJ interne depuis la prop (contrôlée) sans perdre la sélection si focus externe
  useEffect(() => {
    setInternalHtml(value || '');
  }, [value]);

  // Synchroniser le contenu DOM sans casser la sélection: mise à jour impérative seulement si nécessaire
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const safe = toSafeHtml(internalHtml);
    if (el.innerHTML !== safe) {
      el.innerHTML = safe;
    }
  }, [internalHtml]);

  const applyCommand = useCallback((cmd: string, value?: string) => {
    // Utiliser la sélection courante si valide dans cet éditeur, sinon retomber sur lastRangeRef
    const el = editorRef.current;
    if (!el) return;
    let rng: Range | null = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const cur = sel.getRangeAt(0);
      const sNode = cur.startContainer instanceof Element ? cur.startContainer : cur.startContainer?.parentElement;
      const eNode = cur.endContainer instanceof Element ? cur.endContainer : cur.endContainer?.parentElement;
      if (!cur.collapsed && sNode && eNode && el.contains(sNode) && el.contains(eNode)) {
        rng = cur.cloneRange();
      }
    }
    if (!rng && lastRangeRef.current && !lastRangeRef.current.collapsed) {
      const sNode = lastRangeRef.current.startContainer instanceof Element ? lastRangeRef.current.startContainer : lastRangeRef.current.startContainer?.parentElement;
      const eNode = lastRangeRef.current.endContainer instanceof Element ? lastRangeRef.current.endContainer : lastRangeRef.current.endContainer?.parentElement;
      if (sNode && eNode && el.contains(sNode) && el.contains(eNode)) {
        rng = lastRangeRef.current.cloneRange();
      }
    }
    if (!rng) return;

    // Restaurer la sélection et garder le focus dans l'éditeur
    el.focus({ preventScroll: true });
    if (sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(rng);
      } catch {
        // ignore
      }
    }
    try {
      // Forcer l'usage des balises (pas de styles inline) pour la compatibilité avec la sanitation
      document.execCommand('styleWithCSS', false, 'false');
    } catch { /* no-op */ }

    if (cmd === 'formatBlock' && value) {
      // Compat: tenter plusieurs formats (Chrome/Firefox/Safari)
      const candidates = [value, value.toLowerCase(), `<${value}>`, `<${value.toLowerCase()}>`];
      let applied = false;
      for (const v of candidates) {
        try {
          if (document.execCommand('formatBlock', false, v)) { applied = true; break; }
        } catch { /* ignore */ }
      }
      if (!applied) {
        // Fallback: wrap sélection dans un élément block
        try {
          const wrapper = document.createElement(value.toLowerCase());
          rng.surroundContents(wrapper);
        } catch { /* no-op */ }
      }
    } else {
      document.execCommand(cmd, false, value);
    }
    // Après mutation, envoyer la version nettoyée
    const html = editorRef.current?.innerHTML || '';
    const safe = sanitizeHtml(html);
    onChange(safe);
  }, [onChange]);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    let toInsert = '';
    if (html) {
      toInsert = sanitizeHtml(html);
    } else if (text) {
      // Conserver les retours à la ligne
      toInsert = toSafeHtml(text);
    }
    if (toInsert) {
      document.execCommand('insertHTML', false, toInsert);
    }
  }, []);

  const updateToolbarPosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setShowToolbar(false);
      return;
    }
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      setShowToolbar(false);
      return;
    }
    const editorEl = editorRef.current;
    if (!editorEl) return;
    const common = range.commonAncestorContainer as Node;
    const commonEl = (common.nodeType === 1 ? (common as Element) : common.parentElement) as Element | null;
    if (!commonEl || !editorEl.contains(commonEl)) {
      setShowToolbar(false);
      return;
    }
    // Utiliser le dernier rectangle de la sélection (plus stable quand la sélection traverse plusieurs lignes)
    let rect = range.getBoundingClientRect();
    const rects = range.getClientRects?.();
    if (rects && rects.length > 0) {
      rect = rects[rects.length - 1];
    }
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setShowToolbar(false);
      return;
    }
    // Mémoriser la sélection pour la toolbar
    lastRangeRef.current = range.cloneRange();
    const wrapper = editorRef.current?.parentElement as HTMLElement | null; // wrapper has position:relative
    if (!wrapper) return;
    const wrapRect = wrapper.getBoundingClientRect();
    const tb = toolbarRef.current;
    const tbW = tb?.offsetWidth ?? 260;
    const tbH = tb?.offsetHeight ?? 38;

    let left = (rect.left - wrapRect.left) + rect.width / 2 - tbW / 2; // centré relatif au wrapper
    let top = (rect.top - wrapRect.top) - tbH - 8; // au-dessus par défaut

    // Si manque de place en haut, placer en dessous
    if (top < 8) top = (rect.bottom - wrapRect.top) + 8;

    // Clamp dans le wrapper (marge 8px)
    const maxLeft = Math.max(8, (wrapRect.width - tbW - 8));
    const maxTop = Math.max(8, (wrapRect.height - tbH - 8));
    left = Math.max(8, Math.min(left, maxLeft));
    top = Math.max(8, Math.min(top, maxTop));

    setToolbarPos({ top, left });
    setShowToolbar(true);

    // Re-mesurer après affichage effectif de la toolbar (premier render)
    requestAnimationFrame(() => {
      const tb2 = toolbarRef.current;
      const tb2W = tb2?.offsetWidth ?? tbW;
      const tb2H = tb2?.offsetHeight ?? tbH;
      let l2 = (rect.left - wrapRect.left) + rect.width / 2 - tb2W / 2;
      let t2 = (rect.top - wrapRect.top) - tb2H - 8;
      if (t2 < 8) t2 = (rect.bottom - wrapRect.top) + 8;
      const maxLeft2 = Math.max(8, (wrapRect.width - tb2W - 8));
      const maxTop2 = Math.max(8, (wrapRect.height - tb2H - 8));
      l2 = Math.max(8, Math.min(l2, maxLeft2));
      t2 = Math.max(8, Math.min(t2, maxTop2));
      setToolbarPos({ top: t2, left: l2 });
    });
  }, []);

  const onSelectionChange = useCallback(() => {
    if (isMouseDownRef.current) return; // ignorer pendant le drag pour éviter scintillement
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) {
      setShowToolbar(false);
      lastRangeRef.current = null;
      return;
    }
    const rng = sel.getRangeAt(0);
    const container = rng.commonAncestorContainer as HTMLElement;
    const within = editor.contains(container.nodeType === 1 ? container : container.parentElement);
    if (!within) {
      setShowToolbar(false);
      lastRangeRef.current = null;
      return;
    }
    // Mémoriser la sélection courante (si non-collapsée) pour la restaurer au clic sur la toolbar
    if (!editor.contains(rng.commonAncestorContainer)) return;
    if (!rng.collapsed) {
      lastRangeRef.current = rng.cloneRange();
    } else {
      lastRangeRef.current = null;
      setShowToolbar(false);
    }
    updateToolbarPosition();
  }, [updateToolbarPosition]);

  useEffect(() => {
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [onSelectionChange]);

  // Repositionner la toolbar sur scroll/resize (ex: conteneurs scrollables, fenêtre)
  useEffect(() => {
    const handler = () => updateToolbarPosition();
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [updateToolbarPosition]);

  // Cacher la toolbar lors d'un clic en dehors de l'éditeur/toolbar
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const editor = editorRef.current;
      const tb = toolbarRef.current;
      const target = e.target as Node | null;
      if (!target) return;
      if (editor && editor.contains(target)) return; // clic dans l'éditeur: géré par onMouseDown de l'éditeur
      if (tb && tb.contains(target)) return; // clic dans la toolbar
      setShowToolbar(false);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, []);

  const onInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    // Sanitize en sortie
    const safe = sanitizeHtml(html);
    if (safe !== value) onChange(safe);
  }, [onChange, value]);

  const placeholderStyle: React.CSSProperties = useMemo(() => ({
    position: 'absolute',
    pointerEvents: 'none',
    opacity: 0.5,
    color: 'var(--text-muted)',
    padding: '8px 10px',
    userSelect: 'none'
  }), []);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onPaste={onPaste}
        onInput={onInput}
        onFocus={updateToolbarPosition}
        onMouseDown={() => { isMouseDownRef.current = true; setShowToolbar(false); lastRangeRef.current = null; }}
        onMouseUp={() => { isMouseDownRef.current = false; requestAnimationFrame(() => updateToolbarPosition()); }}
        onKeyUp={updateToolbarPosition}
        onKeyDown={(e) => { if (e.key === 'Escape') { setShowToolbar(false); } }}
        onBlur={() => { setShowToolbar(false); lastRangeRef.current = null; }}
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          minHeight,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '8px 10px',
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          background: 'white'
        }}
      />
      {(!internalHtml || internalHtml.trim() === '') && placeholder && (
        <div style={placeholderStyle}>{placeholder}</div>
      )}

      {showToolbar && (
        <div
          ref={toolbarRef}
          style={{ ...TOOLBAR_STYLE, top: toolbarPos.top, left: toolbarPos.left }}
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Gras"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyCommand('bold'); }}
          >
            B
          </button>
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Italique"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyCommand('italic'); }}
          >
            <i>I</i>
          </button>
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Souligné"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyCommand('underline'); }}
          >
            <u>U</u>
          </button>
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Titre 1"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyCommand('formatBlock', 'H1'); }}
          >
            H1
          </button>
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Titre 2"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyCommand('formatBlock', 'H2'); }}
          >
            H2
          </button>
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Titre 3"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyCommand('formatBlock', 'H3'); }}
          >
            H3
          </button>
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Insérer un lien"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const raw = window.prompt('Entrer une URL (https:// ou mailto:)', 'https://');
              if (!raw) return;
              const url = (/^(https?:\/\/|mailto:)/i.test(raw) ? raw : (raw.startsWith('www.') ? `https://${raw}` : null));
              if (!url) return alert('URL invalide. Utilisez https:// ou mailto:');
              applyCommand('createLink', url);
            }}
          >
            🔗 Lien
          </button>
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Supprimer le lien"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyCommand('unlink'); }}
          >
            ⛓️‍✂️
          </button>
          <button
            type="button"
            style={BUTTON_STYLE}
            title="Effacer la mise en forme"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyCommand('removeFormat'); }}
          >
            ↺
          </button>
        </div>
      )}
    </div>
  );
}
