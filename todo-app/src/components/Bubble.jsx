import { useState, useEffect, useRef } from "react";
import { escapeHtml, sanitizeHtml, htmlToPlain, htmlToFirstLine, imageFileToDataURL } from "../lib/html";
import { useKeyboardInset, useFocusTrap } from "../lib/hooks";

/* ------------------------------------------------------------------ */
/*  Rich-text toolbar with Aa style menu                               */
/* ------------------------------------------------------------------ */
function ToolbarButtons({ cmd }) {
  const [aaOpen, setAaOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAaOpen(false); };
    if (aaOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [aaOpen]);

  const setBlock = (tag) => { cmd("formatBlock", tag); setAaOpen(false); };

  return (
    <>
      <button type="button" className="b" onClick={() => cmd("bold")} title="Bold (⌘B)" aria-label="Bold">B</button>
      <button type="button" className="i" onClick={() => cmd("italic")} title="Italic (⌘I)" aria-label="Italic">I</button>
      <button type="button" className="u" onClick={() => cmd("underline")} title="Underline (⌘U)" aria-label="Underline">U</button>
      <button type="button" className="s" onClick={() => cmd("strikeThrough")} title="Strikethrough" aria-label="Strikethrough">S</button>
      <div className="pd-aa-wrap" ref={wrapRef}>
        <button type="button" onClick={() => setAaOpen((o) => !o)} title="Text style" aria-label="Text style" style={{ width: "auto", padding: "0 8px" }}>Aa</button>
        {aaOpen && (
          <div className="pd-aa-menu">
            <button type="button" className="pd-aa-title" onClick={() => setBlock("H2")}>Title</button>
            <button type="button" className="pd-aa-heading" onClick={() => setBlock("H3")}>Heading</button>
            <button type="button" className="pd-aa-sub" onClick={() => setBlock("H4")}>Subheading</button>
            <button type="button" className="pd-aa-body" onClick={() => setBlock("P")}>Body</button>
            <button type="button" className="pd-aa-mono" onClick={() => setBlock("PRE")}>Monostyled</button>
          </div>
        )}
      </div>
      <button type="button" onClick={() => cmd("insertUnorderedList")} title="Bulleted list" aria-label="Bulleted list">•—</button>
    </>
  );
}

// Paste as plain text but keep line breaks — never inherit source formatting
function handlePlainPaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertHTML", false, escapeHtml(text).replace(/\n/g, "<br>"));
}

/* ------------------------------------------------------------------ */
/*  Note bubble + focus editor (modal desktop / bottom sheet mobile)   */
/* ------------------------------------------------------------------ */
const PANEL_MIN_H = 240;
const DEFAULT_PANEL_H = 380;

export function Bubble({ note, color, isMobile, onSave, onDelete, onCreateTask, onImageError, dragProps, touchReorderStart }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_H);
  const panelRef = useRef(null);
  const dialogRef = useRef(null);
  const dragState = useRef(null);
  const kb = useKeyboardInset();
  const isLong = htmlToPlain(note.text).length > 160 || /<img/i.test(note.text);
  // Reorder affordances only make sense where a reorderable list exists (per-project view).
  const reorderable = !!dragProps || !!touchReorderStart;

  useEffect(() => {
    if (panelOpen && panelRef.current) {
      panelRef.current.innerHTML = note.text;
      // Desktop: jump straight into editing. Mobile: open the sheet calmly first —
      // autofocus would summon the keyboard mid-animation and shove the sheet off-screen.
      if (!isMobile) {
        panelRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(panelRef.current); range.collapse(false);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  const close = () => { setPanelOpen(false); setFullscreen(false); };
  const commitPanel = () => {
    const raw = panelRef.current ? panelRef.current.innerHTML : note.text;
    const clean = sanitizeHtml(raw);
    if (htmlToPlain(clean).trim().length === 0 && !/<img/i.test(clean)) onDelete(); else onSave(clean);
    close();
  };
  const cancelPanel = () => close(); // Esc = discard changes

  // Tab-trap/Escape/return-focus via the shared hook — initial focus stays bespoke
  // above (desktop jumps into editing with the cursor placed at the end; mobile opens
  // calmly without autofocus, which would summon the keyboard mid-animation).
  useFocusTrap(dialogRef, panelOpen, cancelPanel, { skipInitialFocus: true });

  const panelCmd = (name, val = null) => { document.execCommand(name, false, val); panelRef.current && panelRef.current.focus(); };

  // Pre-fills from the current text selection inside the panel, if any; otherwise
  // falls back to the note's first line — never blocks on there being a selection.
  const createTask = () => {
    const sel = window.getSelection();
    const fromSelection = sel && !sel.isCollapsed && panelRef.current && panelRef.current.contains(sel.anchorNode)
      ? sel.toString().trim() : "";
    onCreateTask(note, fromSelection || htmlToFirstLine(note.text));
  };

  const insertImagesIntoPanel = async (files) => {
    let failed = 0;
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const dataUrl = await imageFileToDataURL(f);
        panelRef.current && panelRef.current.focus();
        document.execCommand("insertHTML", false, `<img src="${dataUrl}"><br>`);
      } catch (e) { failed++; }
    }
    if (failed) onImageError?.(`Couldn't add ${failed === 1 ? "an image" : `${failed} images`} — the file may be corrupted or too large.`);
  };

  const handleBubbleDrop = async (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      e.preventDefault(); e.stopPropagation();
      let html = note.text;
      let failed = 0;
      for (const f of files) {
        try { html += `<br><img src="${await imageFileToDataURL(f)}">`; } catch (err) { failed++; }
      }
      onSave(sanitizeHtml(html));
      if (failed) onImageError?.(`Couldn't add ${failed === 1 ? "an image" : `${failed} images`} — the file may be corrupted or too large.`);
      dragProps?.onDragEnd?.();
      return;
    }
    dragProps?.onDrop?.(e);
  };

  // Resize: desktop drags down to grow; mobile sheet drags up to grow, swipe far down = save & close
  const onResizeStart = (e) => {
    e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = { startY: y, startHeight: panelHeight };
    const move = (ev) => {
      if (!dragState.current) return;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const delta = (cy - dragState.current.startY) * (isMobile ? -1 : 1);
      const max = Math.round(window.innerHeight * 0.9);
      const next = dragState.current.startHeight + delta;
      if (isMobile && next < 170) { dragState.current = null; cleanup(); commitPanel(); return; }
      setPanelHeight(Math.min(Math.max(next, isMobile ? 200 : PANEL_MIN_H), max));
      if (ev.cancelable) ev.preventDefault();
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
    };
    const up = () => { dragState.current = null; cleanup(); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
  };

  const panelKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); cancelPanel(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); panelCmd("bold"); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); panelCmd("italic"); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") { e.preventDefault(); panelCmd("underline"); }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); commitPanel(); }
    if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertHTML", false, "&nbsp;&nbsp;"); } // keep focus trapped
  };

  return (
    <>
      <div className={`pd-bubble ${dragProps?.className || ""}`}
        data-rid={note.id} data-rkind="note"
        style={{ background: color.bg, borderLeft: `3px solid ${color.fg}`, "--pfg": color.fg }}
        draggable={!isMobile && reorderable} onDragStart={dragProps?.onDragStart} onDragOver={dragProps?.onDragOver}
        onDrop={handleBubbleDrop} onDragEnd={dragProps?.onDragEnd}
        onClick={() => setPanelOpen(true)}>
        {reorderable && (
          <span className="pd-drag-handle" aria-label="Drag to reorder"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => { e.stopPropagation(); touchReorderStart?.(e, note.id, "note"); }}>⠿</span>
        )}
        {/* Sanitized again here, not just on save — note.text can also arrive via
            realtime sync or import, neither of which is "saving through this editor". */}
        <div className={`pd-bubble-content ${isLong ? "clamped" : ""}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.text) }} />
        <button className="pd-x" aria-label="Delete note" onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
      </div>

      {panelOpen && (
        <div className="pd-overlay" style={isMobile ? { paddingBottom: kb } : undefined}
          onMouseDown={(e) => { if (e.target === e.currentTarget) commitPanel(); }}>
          <div ref={dialogRef} className={`pd-panel ${fullscreen ? "fullscreen" : ""}`} role="dialog" aria-modal="true" aria-label="Edit note"
            style={{
              ...(!fullscreen ? { height: panelHeight } : {}),
              ...(isMobile ? { maxHeight: `calc(100dvh - ${kb + 8}px)` } : {}),
            }}>
            <div className="pd-panel-header">
              <div className="pd-toolbar" onMouseDown={(e) => e.preventDefault()}>
                <ToolbarButtons cmd={panelCmd} />
              </div>
              <div className="pd-panel-actions">
                {onCreateTask && (
                  <button type="button" onClick={createTask} title="Create task from this note" aria-label="Create task from this note">✚</button>
                )}
                <button type="button" onClick={() => setFullscreen((f) => !f)}
                  title={fullscreen ? "Exit full screen" : "Full screen"} aria-label={fullscreen ? "Exit full screen" : "Full screen"}>{fullscreen ? "⤡" : "⤢"}</button>
                <button type="button" onClick={commitPanel} title="Save & close" aria-label="Save & close">✕</button>
              </div>
            </div>
            <div className="pd-panel-body"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const files = [...(e.dataTransfer?.files || [])];
                if (files.some((f) => f.type.startsWith("image/"))) { e.preventDefault(); insertImagesIntoPanel(files); }
              }}>
              <div ref={panelRef} className="pd-panel-edit" contentEditable suppressContentEditableWarning
                onPaste={handlePlainPaste} onKeyDown={panelKeyDown} />
            </div>
            {!fullscreen && (
              <div className="pd-resize-handle" aria-label="Resize panel" onMouseDown={onResizeStart} onTouchStart={onResizeStart}>
                <span />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
