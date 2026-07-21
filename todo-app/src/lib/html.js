// DOM-backed helpers for note rich text and inline images, shared by App.jsx and Bubble.
export function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}
export function sanitizeHtml(html) {
  const allowed = /^(B|STRONG|I|EM|U|S|STRIKE|BR|DIV|SPAN|H2|H3|H4|PRE|UL|LI|OL|IMG|P)$/;
  // Parsed via DOMParser, not `element.innerHTML =` on a live document — a detached
  // <div> is still part of the active document, so setting its innerHTML directly
  // loads images and fires their onerror/onload handlers *during parsing*, before
  // this function ever gets a chance to strip them. A DOMParser document has no
  // browsing context, so nothing in it loads or executes, ever.
  const tmp = new DOMParser().parseFromString(html, "text/html").body;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 1) {
        if (!allowed.test(child.tagName)) {
          const text = document.createTextNode(child.textContent);
          node.replaceChild(text, child);
          return;
        }
        if (child.tagName === "IMG") {
          const src = child.getAttribute("src") || "";
          if (!src.startsWith("data:image/")) { child.remove(); return; }
          [...child.attributes].forEach((a) => { if (a.name !== "src") child.removeAttribute(a.name); });
          return;
        }
        [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
        walk(child);
      }
    });
  };
  walk(tmp);
  return tmp.innerHTML;
}
export function htmlToPlain(html) {
  // Same DOMParser reasoning as sanitizeHtml above — this runs on note content that
  // isn't guaranteed to have passed through sanitizeHtml yet at every call site.
  const tmp = new DOMParser().parseFromString(html, "text/html").body;
  return tmp.textContent || "";
}
export function imageFileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const render = (dim, q) => {
        const scale = Math.min(1, dim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        return cv.toDataURL("image/jpeg", q);
      };
      // Everything (images included) lives in one JSON blob that's rewritten on every save
      // and downloaded on every load — step down until the image fits a ~200K-char budget.
      const LADDER = [[700, 0.7], [560, 0.6], [440, 0.5]];
      let out = null;
      for (const [dim, q] of LADDER) {
        out = render(dim, q);
        if (out.length <= 200_000) break;
      }
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
