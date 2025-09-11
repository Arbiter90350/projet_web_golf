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
    // Restaurer la sélection mémorisée et garder le focus dans l'éditeur
    const el = editorRef.current;
    if (el) el.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (sel && lastRangeRef.current) {
      try {
        sel.removeAllRanges();
        sel.addRange(lastRangeRef.current);
      } catch {
        // ignore
      }
    }
    document.execCommand(cmd, false, value);
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
      return;
    }
    const rng = sel.getRangeAt(0);
    const container = rng.commonAncestorContainer as HTMLElement;
    const within = editor.contains(container.nodeType === 1 ? container : container.parentElement);
    if (!within) {
      setShowToolbar(false);
      return;
    }
    // Mémoriser la sélection courante (si non-collapsée) pour la restaurer au clic sur la toolbar
    if (!editor.contains(rng.commonAncestorContainer)) return;
    if (!rng.collapsed) {
      lastRangeRef.current = rng.cloneRange();
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
    padding: '8px 10px'
  }), []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onPaste={onPaste}
        onInput={onInput}
        onFocus={updateToolbarPosition}
        onMouseDown={() => { isMouseDownRef.current = true; }}
        onMouseUp={() => { isMouseDownRef.current = false; requestAnimationFrame(() => updateToolbarPosition()); }}
        onKeyUp={updateToolbarPosition}
        style={{
          width: '100%',
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
        <div ref={toolbarRef} style={{ ...TOOLBAR_STYLE, top: toolbarPos.top, left: toolbarPos.left }} tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
          <button type="button" style={BUTTON_STYLE} title="Gras" onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('bold')}>B</button>
          <button type="button" style={BUTTON_STYLE} title="Italique" onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('italic')}><i>I</i></button>
          <button type="button" style={BUTTON_STYLE} title="Souligné" onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('underline')}><u>U</u></button>
          <button type="button" style={BUTTON_STYLE} title="Titre 1" onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('formatBlock', 'H1')}>H1</button>
          <button type="button" style={BUTTON_STYLE} title="Titre 2" onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('formatBlock', 'H2')}>H2</button>
          <button type="button" style={BUTTON_STYLE} title="Titre 3" onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('formatBlock', 'H3')}>H3</button>
          <button type="button" style={BUTTON_STYLE} title="Effacer la mise en forme" onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('removeFormat')}>↺</button>
        </div>
      )}
    </div>
  );
}
