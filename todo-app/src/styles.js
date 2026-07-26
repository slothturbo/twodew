export const css = `
/* Fonts are linked from index.html <head>, not @import-ed here — see the comment there. */

:root{
  --bg:#050505; --card:#141416; --raised:#1D1F22; --ink:#F5F6F1; --muted:#8B8E93;
  --line:#26282C; --accent:#FF5A2E; --accent-ink:#0A0A0A; --danger:#FF6B85; --ok:#8CE0AC;
  --priority-high:#FF8B6B; --stat-sage:#A39B0F; --stat-lilac:#BDB2EA;
  color-scheme: dark;

  /* ---- design tokens (additive — nothing references these yet) ---- */
  /* radius scale */
  --r-sm:8px; --r-md:12px; --r-lg:18px; --r-xl:24px; --r-pill:999px;
  /* spacing scale */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-7:32px;
  /* type scale (font-size) */
  --fs-2xs:10px; --fs-xs:11px; --fs-sm:12px; --fs-base:13px; --fs-md:14px; --fs-lg:15px;
  --fs-xl:16px; --fs-2xl:18px; --fs-3xl:22px; --fs-display-sm:26px; --fs-display-md:34px; --fs-display-lg:38px;
  /* elevation — layered, soft shadows for hover/resting states vs. modals */
  --shadow-sm:0 1px 2px rgba(0,0,0,0.24), 0 1px 1px rgba(0,0,0,0.16);
  --shadow-md:0 4px 12px rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.18);
  --shadow-lg:0 12px 32px rgba(0,0,0,0.36), 0 4px 10px rgba(0,0,0,0.22);
  --shadow-modal:0 24px 64px rgba(0,0,0,0.5);
  /* motion */
  --ease-out:cubic-bezier(.16,1,.3,1);
  --dur-fast:120ms; --dur-base:160ms; --dur-slow:280ms;
  /* accessible focus ring — a real box-shadow ring, not just a border-color swap */
  --focus-ring:0 0 0 3px rgba(255,90,46,0.4);
}
*{box-sizing:border-box; margin:0; padding:0;}

/* ---- thin, unobtrusive scrollbars ---- */
*{scrollbar-width:thin; scrollbar-color:var(--line) transparent;}
::-webkit-scrollbar{width:10px; height:10px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--line); border-radius:var(--r-pill); border:2px solid var(--bg); background-clip:padding-box;}
::-webkit-scrollbar-thumb:hover{background:var(--muted);}

/* ---- native-feel shell: app is fixed to the viewport, only inner panes scroll ---- */
.pd-app{
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; color:var(--ink);
  background:var(--bg); position:fixed; inset:0; display:flex; flex-direction:column;
  overscroll-behavior:none; -webkit-tap-highlight-color:transparent;
  user-select:none; -webkit-user-select:none; -webkit-touch-callout:none;
}
input, textarea, select, [contenteditable], .pd-bubble-content{
  user-select:text; -webkit-user-select:text;
}
/* House style: every bit of text in the app renders lowercase, including labels that
   are deliberately uppercase elsewhere in this stylesheet (section labels, phase tags,
   field labels) — !important wins over those so this one rule covers all of them. */
.pd-app, .pd-app *{text-transform:lowercase !important;}
::selection{background:var(--accent); color:var(--accent-ink);}
::placeholder{color:var(--muted); opacity:.7;}
button{touch-action:manipulation;}
/* Fallback focus ring for any plain button with no more-specific :focus-visible rule
   of its own (icon-only buttons like drag handles, priority dots, track pills, tab bar,
   etc.) — every existing class+pseudo rule (.pd-btn:focus-visible etc.) outranks this by
   specificity, so this only fills gaps rather than overriding anything. */
button:focus-visible{box-shadow:var(--focus-ring); outline:none;}
.pd-press:active{transform:scale(.97); filter:brightness(1.15);}

.pd-topbar{
  padding:22px 28px 20px; padding-top:max(22px, env(safe-area-inset-top)); border-bottom:1px solid var(--line);
  display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; flex-shrink:0;
}
.pd-title{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:38px; letter-spacing:-0.03em; line-height:1;}
.pd-title span{color:var(--accent);}
.pd-overall{display:flex; align-items:center; gap:12px; min-width:180px; flex:1; max-width:420px;}
.pd-overall-bar{flex:1; height:8px; background:var(--raised); border-radius:0; overflow:hidden;}
.pd-overall-fill{height:100%; background:var(--accent); border-radius:0; transition:width .6s ease;}
.pd-overall-label{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted); white-space:nowrap;}

/* Sticky focus-mode banner — sits above the topbar on every screen while a task is tracked */
.pd-focus-banner{
  display:flex; align-items:center; gap:10px; padding:8px 20px;
  padding-top:max(8px, env(safe-area-inset-top));
  background:var(--accent); color:var(--accent-ink); cursor:pointer; flex-shrink:0;
  font-family:'Plus Jakarta Sans',sans-serif; font-size:13px;
}
.pd-focus-dot{width:8px; height:8px; border-radius:50%; background:var(--accent-ink); flex-shrink:0; animation:pd-pulse 1.6s ease-in-out infinite;}
.pd-focus-label{opacity:.75; white-space:nowrap;}
.pd-focus-title{font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;}
.pd-focus-project{opacity:.75; white-space:nowrap; flex-shrink:0;}
.pd-focus-time{font-family:'IBM Plex Mono',monospace; font-weight:600; margin-left:auto; flex-shrink:0;}
.pd-focus-stop{
  all:unset; display:flex; align-items:center; gap:5px; background:rgba(0,0,0,0.18);
  color:var(--accent-ink); padding:5px 11px; border-radius:999px; font-size:12px; cursor:pointer;
  flex-shrink:0; font-family:'IBM Plex Mono',monospace; transition:background .15s ease;
}
.pd-focus-stop:hover{background:rgba(0,0,0,0.28);}
@keyframes pd-pulse{0%,100%{opacity:1;} 50%{opacity:.3;}}

/* ---- FocusScreen: distraction-free overlay opened from the focus banner ---- */
.pd-focusscreen-overlay{background:rgba(8,9,11,0.86); backdrop-filter:blur(6px);}
.pd-focusscreen{
  width:min(420px, 92vw); background:var(--card); border:1px solid var(--line); border-radius:20px;
  box-shadow:var(--shadow-modal); padding:40px 32px; display:flex; flex-direction:column; align-items:center;
  text-align:center; position:relative; animation:pd-pop .14s ease;
}
.pd-focusscreen-close{
  all:unset; position:absolute; top:14px; right:16px; width:28px; height:28px; border-radius:50%;
  display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--muted); font-size:18px;
}
.pd-focusscreen-close:hover{background:var(--raised); color:var(--ink);}
.pd-focusscreen-label{font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted);}
.pd-focusscreen-title{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:26px; margin-top:8px; line-height:1.2;}
.pd-focusscreen-project{font-size:13px; color:var(--muted); margin-top:4px;}
.pd-focusscreen-time{font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:42px; margin-top:28px; letter-spacing:-0.02em;}
.pd-focusscreen-estimate{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted); margin-top:8px;}
.pd-focusscreen-controls{display:flex; gap:10px; margin-top:32px; width:100%;}
.pd-focusscreen-pause, .pd-focusscreen-stop{
  all:unset; box-sizing:border-box; flex:1; text-align:center; cursor:pointer; padding:12px; border-radius:12px;
  font-size:14px; font-weight:600;
}
.pd-focusscreen-pause{background:var(--accent); color:var(--accent-ink);}
.pd-focusscreen-pause:hover{filter:brightness(1.1);}
.pd-focusscreen-stop{border:1px solid var(--line); color:var(--ink);}
.pd-focusscreen-stop:hover{border-color:var(--danger); color:var(--danger);}
.pd-focusscreen-ended-title{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:22px; line-height:1.2;}
.pd-focusscreen-ended-time{font-family:'IBM Plex Mono',monospace; font-size:15px; color:var(--muted); margin-top:14px;}
.pd-focusscreen-choices{display:flex; flex-direction:column; gap:8px; margin-top:28px; width:100%;}
.pd-focusscreen-choice{
  all:unset; box-sizing:border-box; width:100%; text-align:center; cursor:pointer; padding:12px; border-radius:12px;
  font-size:14px; font-weight:600; border:1px solid var(--line); color:var(--ink);
}
.pd-focusscreen-choice:hover{border-color:var(--accent); color:var(--accent);}
.pd-focusscreen-choice.primary{background:var(--accent); color:var(--accent-ink); border:none;}
.pd-focusscreen-choice.primary:hover{filter:brightness(1.1); color:var(--accent-ink);}

.pd-body{flex:1; display:flex; min-height:0; position:relative; overflow:hidden;}
.pd-left{
  width:380px; min-width:320px; border-right:1px solid var(--line); overflow-y:auto; padding:16px;
  overscroll-behavior:contain;
}
.pd-right{
  flex:1; overflow-y:auto; padding:24px; background:var(--card);
  overscroll-behavior:contain;
}

/* ---- search ---- */
.pd-search{
  width:100%; padding:9px 12px; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif;
  border:1px solid var(--line); border-radius:var(--r-md); background:var(--raised); color:var(--ink); margin-bottom:12px;
}
.pd-search:focus{outline:none; border-color:var(--accent); box-shadow:var(--focus-ring);}

/* ---- project cards ---- */
.pd-card{
  border:1px solid var(--line); border-radius:12px;
  padding:14px; display:flex; gap:14px; align-items:center; cursor:pointer;
  margin-bottom:10px; transition:border-color .15s ease, transform .08s ease;
}
.pd-card:active{transform:scale(.985);}
.pd-card:hover{border-color:var(--pfg); box-shadow:var(--shadow-md); transform:translateY(-1px);}
.pd-card.selected{border-color:var(--pfg); box-shadow:0 0 0 1px var(--pfg);}
.pd-card:focus-visible{outline:none; box-shadow:var(--focus-ring);}
.pd-card-info{flex:1; min-width:0;}
.pd-card-name{font-weight:600; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pd-card-client{font-size:12px; color:var(--muted); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pd-card-meta{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); margin-top:4px;}
.overdue{color:var(--danger) !important; font-weight:600;}
.pd-phase{
  font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.06em; text-transform:uppercase;
  border:1px solid var(--pfg); color:var(--pfg); border-radius:999px; padding:1px 7px;
  display:inline-block; margin-top:5px;
}

.pd-addproj{
  width:100%; border:1px dashed var(--line); background:transparent; border-radius:12px;
  padding:12px; font-size:14px; color:var(--muted); cursor:pointer;
  font-family:'Plus Jakarta Sans',sans-serif; transition:border-color .15s ease,color .15s ease;
}
.pd-addproj:hover{border-color:var(--accent); color:var(--accent);}

/* ---- detail ---- */
.pd-back{display:none; background:none; border:none; color:var(--muted); font-size:13px; cursor:pointer; margin-bottom:12px; font-family:'IBM Plex Mono',monospace; padding:8px 8px 8px 0;}
.pd-detail-head{display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;}
.pd-proj-name{font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:26px; letter-spacing:-0.02em; border:none; background:transparent; width:100%; color:var(--ink);}
.pd-proj-name:focus{outline:none; border-bottom:2px solid var(--accent);}
.pd-outcome-input{
  font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; color:var(--muted); border:none; background:transparent;
  width:100%; padding:4px 0 10px; margin-top:-4px;
}
.pd-outcome-input:focus{outline:none; color:var(--ink);}
.pd-outcome-input::placeholder{color:var(--muted); opacity:.6;}
.pd-meta-grid{display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; align-items:flex-end;}
.pd-field{display:flex; flex-direction:column; gap:3px;}
.pd-field label{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);}
.pd-field input[type=text]{
  font-size:13px; font-family:'Plus Jakarta Sans',sans-serif; color:var(--ink);
  border:1px solid transparent; border-radius:var(--r-sm); padding:5px 9px; background:transparent; min-width:130px;
  transition:background var(--dur-fast) ease, border-color var(--dur-fast) ease;
}
.pd-field input[type=text]:hover{background:var(--raised);}
.pd-field input:focus{outline:none; background:var(--raised); border-color:var(--accent); box-shadow:var(--focus-ring);}
.pd-progressbar{height:8px; background:var(--raised); border-radius:4px; overflow:hidden; margin-top:16px;}
.pd-progressfill{height:100%; border-radius:4px; transition:width .6s ease;}

/* ---- custom date picker ---- */
.pd-dp-wrap{position:relative; display:inline-block;}
.pd-dp-btn{
  font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--ink);
  border:1px solid var(--line); border-radius:var(--r-sm); padding:8px 10px; background:var(--raised);
  cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; min-height:36px;
}
.pd-dp-btn:hover{border-color:var(--accent);}
.pd-dp-btn.empty{color:var(--muted);}
.pd-dp-icon{flex-shrink:0;}
.pd-dp-pop{
  z-index:200; width:280px; max-width:calc(100vw - 16px);
  background:var(--raised); border:1px solid var(--line); border-radius:12px; padding:14px;
  box-shadow:0 12px 32px rgba(0,0,0,0.45); animation:pd-pop .12s ease;
}
@keyframes pd-pop{from{opacity:0; transform:translateY(-4px);} to{opacity:1; transform:none;}}
.pd-dp-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;}
.pd-dp-month{font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:15px;}
.pd-dp-nav{display:flex; gap:4px;}
.pd-dp-nav button{
  background:none; border:1px solid var(--line); border-radius:var(--r-sm); width:32px; height:32px;
  color:var(--ink); cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.pd-dp-nav button:hover{border-color:var(--accent); color:var(--accent);}
.pd-dp-grid{display:grid; grid-template-columns:repeat(7,1fr); gap:2px; text-align:center;}
.pd-dp-dow{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); padding:4px 0;}
.pd-dp-cell{
  font-family:'IBM Plex Mono',monospace; font-size:12px; padding:8px 0; border-radius:var(--r-sm);
  cursor:pointer; background:none; border:none; color:var(--ink); min-height:34px;
}
.pd-dp-cell:hover{background:rgba(255,90,46,0.15);}
.pd-dp-cell.muted{color:var(--muted); opacity:.5;}
.pd-dp-cell.today{box-shadow:inset 0 0 0 1px var(--accent);}
.pd-dp-cell.selected{background:var(--accent); color:var(--accent-ink); font-weight:600;}
.pd-dp-time-row{
  display:flex; align-items:center; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid var(--line);
}
.pd-dp-time-input{
  flex:1; min-width:0; background:var(--raised); border:1px solid var(--line); border-radius:var(--r-sm);
  color:var(--ink); font-family:'IBM Plex Mono',monospace; font-size:12px; padding:6px 8px;
}
.pd-dp-time-input:focus{outline:none; border-color:var(--accent);}
.pd-dp-time-sep{color:var(--muted); font-size:12px; flex-shrink:0;}
.pd-dp-foot{display:flex; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--line);}
.pd-dp-link{background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; padding:8px;}
.pd-dp-link:hover{text-decoration:underline;}

/* ---- reorder controls ---- */
.pd-reorder{display:flex; flex-direction:column; gap:0; flex-shrink:0;}
.pd-reorder button{
  background:none; border:none; color:var(--muted); cursor:pointer; padding:0; width:18px; height:14px;
  display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .15s ease;
}
.pd-reorder button:hover{color:var(--accent);}
.pd-reorder button:disabled{opacity:0 !important; cursor:default;}
.pd-drag-handle{
  cursor:grab; color:var(--muted); opacity:0; transition:opacity .15s ease; flex-shrink:0;
  touch-action:none; padding:8px 4px; margin:-8px 0;
}
.pd-drag-handle:active{cursor:grabbing;}

/* ---- tasks ---- */
.pd-quickadd{
  width:100%; margin-top:22px; padding:12px 14px; font-size:15px; font-family:'Plus Jakarta Sans',sans-serif;
  border:1px solid var(--line); border-radius:var(--r-md); background:var(--raised); color:var(--ink);
}
.pd-quickadd:focus{outline:none; border-color:var(--accent); box-shadow:var(--focus-ring);}
.pd-tasklist{margin-top:14px; list-style:none; display:flex; flex-direction:column; gap:10px;}
.pd-tasksep{
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--muted); padding:12px 6px 4px; margin-top:6px;
}
.pd-task-outer{position:relative; overflow:hidden; border-radius:var(--r-lg);}
.pd-task-bg{
  position:absolute; inset:0; display:flex; align-items:center; justify-content:space-between;
  padding:0 18px; font-size:18px; pointer-events:none;
}
.pd-task-bg .bg-done{color:var(--ok);} .pd-task-bg .bg-del{color:var(--danger);}
/* Task cards — each task is its own card (title on its own full-width row so
   it's never squeezed by the date/priority/tracking controls), not a dense list row. */
.pd-task{
  display:flex; flex-direction:column; gap:10px; padding:14px 16px; background:var(--card);
  border:1px solid var(--line); border-radius:var(--r-lg);
  animation:pd-in .2s ease; position:relative; touch-action:pan-y;
}
.pd-task-row1{display:flex; align-items:center; gap:8px;}
.pd-task-row2{display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.pd-task.snapback{transition:transform .25s ease;}
.pd-task:hover .pd-x, .pd-task:hover .pd-reorder button, .pd-task:hover .pd-drag-handle{opacity:1;}
.pd-task.dragging{opacity:.35;}
.pd-task.drag-over{border-color:var(--accent);}
.pd-task.completed{opacity:.55;}
@keyframes pd-in{from{opacity:0; transform:translateY(3px);} to{opacity:1; transform:none;}}
.pd-check{
  width:24px; height:24px; border-radius:7px; border:2px solid var(--line); background:transparent;
  cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  transition:background .15s ease,border-color .15s ease; padding:0;
}
.pd-check svg{opacity:0; transition:opacity .15s ease;}
/* Default done state — accent fill + dark check. An inline style (project color)
   overrides the background where a color is supplied; screens without a color
   (Today) fall back to this so the check is always visible, not a dark-on-dark blank. */
.pd-check.done{background:var(--accent); border-color:var(--accent);}
.pd-check.done svg{opacity:1;}
.pd-task-title{flex:1; min-width:0; font-size:16px; border:none; background:transparent; color:var(--ink); font-family:'Plus Jakarta Sans',sans-serif; padding:4px 0;}
.pd-task-title:focus{outline:none;}
.pd-task-title:focus-visible{box-shadow:var(--focus-ring); border-radius:4px;}
.pd-task-title.done{color:var(--muted); text-decoration:line-through;}
.pd-task-due{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); white-space:nowrap;}
.pd-task-tracked{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); white-space:nowrap;}
.pd-x{
  background:none; border:none; color:var(--muted); cursor:pointer; font-size:16px;
  opacity:0; transition:opacity .15s ease; padding:8px 10px; margin:-6px -4px; flex-shrink:0;
}
.pd-x:focus-visible{opacity:1;}

/* ---- brain noises ---- */
.pd-section-label{
  font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--muted); margin:28px 0 8px;
}
/* A section label rendered as a <button> for collapsible sections (Done today) —
   reset button chrome but keep the exact same look as the plain-div version. */
.pd-section-toggle{
  all:unset; box-sizing:border-box; display:flex; align-items:center; gap:6px;
  font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--muted); margin:28px 0 8px;
}
.pd-section-toggle.clickable{cursor:pointer;}
.pd-section-toggle.clickable:hover{color:var(--ink);}
.pd-section-count{opacity:.7;}
.pd-section-caret{display:inline-block; transition:transform var(--dur-fast) ease; font-size:10px;}
.pd-section-caret.open{transform:rotate(180deg);}
.pd-noise-input{
  width:100%; padding:10px 14px; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif;
  border:1px solid var(--line); border-radius:20px; background:var(--raised); color:var(--ink);
}
.pd-noise-input:focus{outline:none; border-color:var(--accent); box-shadow:var(--focus-ring);}
.pd-bubbles{display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; margin-top:12px;}
.pd-bubble{
  position:relative; border:1px solid var(--line); border-radius:var(--r-lg);
  padding:10px 30px 10px 30px; font-size:13.5px; line-height:1.5;
  cursor:pointer; animation:pd-in .2s ease; transition:border-color .15s ease, opacity .15s ease, transform .08s ease;
}
.pd-bubble:active{transform:scale(.985);}
.pd-bubble:hover{border-color:var(--pfg);}
.pd-bubble:hover .pd-x, .pd-bubble:hover .pd-drag-handle{opacity:1;}
.pd-bubble.dragging{opacity:.35;}
.pd-bubble.drag-over{border-top:2px solid var(--accent);}
.pd-bubble-content{white-space:pre-wrap; overflow:hidden; max-height:4.6em; pointer-events:none;}
.pd-bubble-content.clamped{display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;}
.pd-bubble-content h2{font-family:'Plus Jakarta Sans',sans-serif; font-size:16px; font-weight:800; margin-bottom:2px;}
.pd-bubble-content h3{font-family:'Plus Jakarta Sans',sans-serif; font-size:15px; margin-bottom:2px;}
.pd-bubble-content h4{font-family:'Plus Jakarta Sans',sans-serif; font-size:13.5px; font-weight:600; color:var(--muted);}
.pd-bubble-content ul{padding-left:18px; margin:4px 0;}
.pd-bubble-content b, .pd-bubble-content strong{font-weight:700;}
.pd-bubble-content pre{
  font-family:'IBM Plex Mono',monospace; font-size:12px; white-space:pre-wrap;
  background:rgba(255,255,255,0.05); border-radius:var(--r-sm); padding:4px 8px; margin:3px 0;
}
.pd-bubble-content img{max-width:100%; border-radius:8px; display:block; margin:6px 0; border:1px solid var(--line);}
.pd-bubble-content.clamped img{max-height:120px; width:auto;}
.pd-bubble .pd-x{position:absolute; top:2px; right:2px;}
.pd-bubble .pd-drag-handle{position:absolute; top:8px; left:4px;}

/* ---- text style (Aa) menu ---- */
.pd-toolbar{display:flex; gap:2px;}
.pd-toolbar button{
  min-width:32px; height:32px; border-radius:var(--r-sm); border:1px solid transparent; background:none;
  color:var(--ink); cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center;
}
.pd-toolbar button:hover{background:rgba(255,90,46,0.15); border-color:var(--accent);}
.pd-toolbar .b{font-weight:700;} .pd-toolbar .i{font-style:italic;} .pd-toolbar .u{text-decoration:underline;} .pd-toolbar .s{text-decoration:line-through;}
.pd-aa-wrap{position:relative;}
.pd-aa-menu{
  position:absolute; top:calc(100% + 6px); left:0; z-index:60; min-width:170px;
  background:var(--raised); border:1px solid var(--line); border-radius:var(--r-md); padding:6px;
  box-shadow:0 12px 32px rgba(0,0,0,0.45); animation:pd-pop .12s ease;
}
.pd-aa-menu button{
  display:block; width:100%; text-align:left; background:none; border:none; color:var(--ink);
  padding:9px 10px; border-radius:var(--r-sm); cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif;
}
.pd-aa-menu button:hover{background:rgba(255,90,46,0.15);}
.pd-aa-title{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:17px;}
.pd-aa-heading{font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:15px;}
.pd-aa-sub{font-family:'Plus Jakarta Sans',sans-serif; font-weight:600; font-size:13px;}
.pd-aa-body{font-size:13px;}
.pd-aa-mono{font-family:'IBM Plex Mono',monospace; font-size:12px;}

/* ---- note editor: modal on desktop, bottom sheet on mobile ---- */
.pd-overlay{
  position:fixed; inset:0; background:rgba(10,12,16,0.6); backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center; z-index:100; padding:24px;
  animation:pd-fade .12s ease;
}
@keyframes pd-fade{from{opacity:0;} to{opacity:1;}}
.pd-panel{
  width:min(640px, 92vw); background:rgba(33,41,51,0.72); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
  border:1px solid var(--line); border-radius:16px;
  box-shadow:var(--shadow-modal); display:flex; flex-direction:column; overflow:hidden;
  min-height:220px; animation:pd-pop .14s ease;
}
.pd-panel.fullscreen{width:94vw; height:92dvh !important; max-height:92dvh;}
.pd-panel-header{
  display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  padding:10px 14px; border-bottom:1px solid var(--line); flex-shrink:0; background:var(--raised); z-index:2;
}
.pd-panel-actions{display:flex; gap:4px; flex-shrink:0;}
.pd-panel-actions button{
  width:34px; height:34px; border-radius:7px; border:1px solid var(--line); background:none;
  color:var(--ink); cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center;
}
.pd-panel-actions button:hover{border-color:var(--accent); color:var(--accent);}
.pd-panel-body{flex:1; overflow-y:auto; padding:16px 18px; overscroll-behavior:contain;}
.pd-panel-edit{
  font-size:15px; font-family:'Plus Jakarta Sans',sans-serif; color:var(--ink); line-height:1.65; min-height:100%;
}
.pd-panel-edit:focus{outline:none;}
.pd-panel-edit:focus-visible{box-shadow:var(--focus-ring); border-radius:4px;}
.pd-panel-edit h2{font-family:'Plus Jakarta Sans',sans-serif; font-size:23px; font-weight:800; margin:6px 0 2px;}
.pd-panel-edit h3{font-family:'Plus Jakarta Sans',sans-serif; font-size:19px; margin:4px 0;}
.pd-panel-edit h4{font-family:'Plus Jakarta Sans',sans-serif; font-size:16px; font-weight:600; margin:4px 0 2px; color:var(--muted);}
.pd-panel-edit ul{padding-left:20px; margin:6px 0;}
.pd-panel-edit b, .pd-panel-edit strong{font-weight:700;}
.pd-panel-edit pre{
  font-family:'IBM Plex Mono',monospace; font-size:13px; white-space:pre-wrap;
  background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 10px; margin:6px 0;
}
.pd-panel-edit img{max-width:100%; max-height:360px; width:auto; border-radius:8px; display:block; margin:6px 0; border:1px solid var(--line);}
.pd-resize-handle{
  flex-shrink:0; height:18px; display:flex; align-items:center; justify-content:center;
  cursor:ns-resize; touch-action:none; border-top:1px solid var(--line);
}
.pd-resize-handle span{width:36px; height:4px; border-radius:2px; background:var(--line);}
.pd-resize-handle:hover span{background:var(--accent);}

/* ---- phase combobox ---- */
.pd-combo{position:relative;}
.pd-combo input{
  font-size:13px; font-family:'Plus Jakarta Sans',sans-serif; color:var(--ink);
  border:1px solid var(--line); border-radius:var(--r-sm); padding:5px 9px; background:var(--raised); min-width:150px; width:100%;
}
.pd-combo input:focus{outline:none; border-color:var(--accent); box-shadow:var(--focus-ring);}
.pd-combo-pop{
  position:absolute; top:calc(100% + 4px); left:0; z-index:50; min-width:100%;
  background:var(--raised); border:1px solid var(--line); border-radius:var(--r-md); padding:4px;
  box-shadow:0 12px 32px rgba(0,0,0,0.45); max-height:200px; overflow-y:auto; animation:pd-pop .12s ease;
}
.pd-combo-pop button{
  display:block; width:100%; text-align:left; background:none; border:none; color:var(--ink);
  padding:9px; border-radius:var(--r-sm); cursor:pointer; font-size:13px; font-family:'Plus Jakarta Sans',sans-serif; white-space:nowrap;
}
.pd-combo-pop button:hover{background:rgba(255,90,46,0.15);}

/* ---- view toggle / data row ---- */
.pd-viewtoggle{display:flex; gap:0; margin-bottom:12px; border:1px solid var(--line); border-radius:8px; overflow:hidden; width:fit-content;}
.pd-viewtoggle button{
  background:none; border:none; color:var(--muted); cursor:pointer; padding:8px 14px;
  font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.05em;
}
.pd-viewtoggle button.active{background:var(--raised); color:var(--accent);}
.pd-datarow{display:flex; gap:14px; margin-bottom:14px;}
.pd-data-btn{
  background:none; border:none; color:var(--muted); cursor:pointer; padding:4px 0;
  font-family:'IBM Plex Mono',monospace; font-size:11px; text-decoration:underline; text-underline-offset:2px;
}
.pd-data-btn:hover{color:var(--accent);}
.pd-import-note{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); margin:-8px 0 14px;}
.pd-import-note.err{color:var(--danger);}
.pd-import-banner{background:var(--card); border:1px solid var(--accent); border-radius:12px; padding:12px; margin-bottom:14px;}
.pd-import-banner p{font-size:13px; margin-bottom:10px; line-height:1.4;}

/* ---- timeline ---- */
.pd-tl{margin-top:4px;}
.pd-tl-axis{
  display:flex; justify-content:space-between; margin-left:118px; margin-bottom:6px;
  font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted);
}
.pd-tl-row{display:flex; align-items:center; gap:8px; padding:10px 4px; cursor:pointer; border-radius:8px;}
.pd-tl-row:hover, .pd-tl-row.selected{background:var(--raised);}
.pd-tl-name{width:106px; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex-shrink:0;}
.pd-tl-track{position:relative; flex:1; height:20px;}
.pd-tl-line{position:absolute; top:50%; left:0; right:0; height:1px; background:var(--line);}
.pd-tl-bar{position:absolute; top:4px; height:12px; border-radius:var(--r-sm);}
.pd-tl-dot{
  position:absolute; top:50%; width:9px; height:9px; border-radius:50%;
  transform:translate(-50%,-50%); border:2px solid var(--bg);
}
.pd-tl-today{position:absolute; top:-2px; bottom:-2px; width:1px; background:var(--accent); opacity:.8;}
.pd-tl-legend{
  display:flex; gap:14px; margin-top:10px; font-family:'IBM Plex Mono',monospace;
  font-size:10px; color:var(--muted); flex-wrap:wrap;
}
.pd-tl-legend span{display:flex; align-items:center; gap:5px;}
.pd-tl-swatch{width:8px; height:8px; border-radius:50%; display:inline-block;}

/* ---- misc ---- */
.pd-empty{color:var(--muted); font-size:14px; margin-top:18px;}
.pd-danger-btn{
  background:none; border:1px solid var(--line); color:var(--muted); border-radius:8px;
  padding:9px 12px; font-size:12px; cursor:pointer; font-family:'IBM Plex Mono',monospace;
}
.pd-danger-btn:hover{border-color:var(--danger); color:var(--danger);}
/* Sync status pill — fixed corner, visible on every screen, replaces the old fading
   "saved" toast so Saving/Saved/Offline/Conflict is always legible, not just after the fact. */
.pd-sync-wrap{position:fixed; right:16px; bottom:16px; z-index:70;}
.pd-sync-pill{
  all:unset; box-sizing:border-box; display:flex; align-items:center; gap:6px;
  background:var(--raised); border:1px solid var(--line); border-radius:999px; padding:7px 13px;
  font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); cursor:default;
  box-shadow:var(--shadow-sm);
}
.pd-sync-dot{width:6px; height:6px; border-radius:50%; background:var(--muted); flex-shrink:0;}
.pd-sync-pill.saving .pd-sync-dot{background:var(--accent); animation:pd-pulse 1.2s ease-in-out infinite;}
.pd-sync-pill.saved .pd-sync-dot{background:var(--ok);}
.pd-sync-pill.offline .pd-sync-dot{background:var(--priority-high);}
.pd-sync-pill.offline{color:var(--priority-high);}
.pd-sync-pill.conflict{cursor:pointer; border-color:var(--danger); color:var(--danger);}
.pd-sync-pill.conflict .pd-sync-dot{background:var(--danger);}
.pd-sync-panel{
  position:absolute; bottom:calc(100% + 8px); right:0; width:280px; max-height:360px; overflow-y:auto;
  background:var(--card); border:1px solid var(--line); border-radius:var(--r-lg);
  box-shadow:var(--shadow-lg); padding:12px; animation:pd-in .15s ease;
}
.pd-sync-panel-head{display:flex; align-items:center; justify-content:space-between; font-weight:700; font-size:13px; margin-bottom:6px;}
.pd-sync-panel-head button{all:unset; cursor:pointer; color:var(--muted); padding:4px;}
.pd-sync-panel-hint{font-size:11px; color:var(--muted); margin-bottom:10px; line-height:1.4;}
.pd-sync-conflict-list{list-style:none; display:flex; flex-direction:column; gap:8px;}
.pd-sync-conflict-row{border-top:1px solid var(--line); padding-top:8px;}
.pd-sync-conflict-title{font-size:13px; margin-bottom:6px;}
.pd-sync-conflict-actions{display:flex; gap:6px;}
.pd-sync-conflict-btn{
  all:unset; box-sizing:border-box; font-size:11px; padding:5px 8px; border-radius:6px;
  border:1px solid var(--line); cursor:pointer; color:var(--muted);
}
.pd-sync-conflict-btn:hover, .pd-sync-conflict-btn.active{border-color:var(--accent); color:var(--accent);}
.pd-form{background:var(--card); border:1px solid var(--accent); border-radius:12px; padding:14px; margin-bottom:10px;}
.pd-form input[type=text]{
  width:100%; padding:10px 11px; font-size:14px; border:1px solid var(--line); border-radius:8px;
  font-family:'Plus Jakarta Sans',sans-serif; margin-bottom:8px; background:var(--raised); color:var(--ink);
}
.pd-form input[type=text]:focus{outline:none; border-color:var(--accent); box-shadow:var(--focus-ring);}
.pd-form-row{display:flex; gap:8px; align-items:center; flex-wrap:wrap;}
.pd-form-label{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:4px;}
.pd-btn{
  border:none; background:var(--accent); color:var(--accent-ink); border-radius:8px; padding:10px 14px;
  font-size:13px; font-weight:600; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif;
  transition:background var(--dur-fast) ease, transform var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
}
.pd-btn:hover{background:#F0C266; box-shadow:var(--shadow-sm);}
.pd-btn:active{transform:scale(.97);}
.pd-btn:focus-visible{outline:none; box-shadow:var(--focus-ring);}
.pd-btn.ghost{background:transparent; color:var(--muted); border:1px solid var(--line);}
.pd-btn.ghost:hover{background:var(--raised); color:var(--ink); border-color:var(--line);}
.pd-btn.ghost:active{transform:scale(.97);}
.pd-btn.ghost:focus-visible{outline:none; box-shadow:var(--focus-ring);}

/* ---- skeleton loading ---- */
.pd-skel{padding:16px; max-width:420px;}
.pd-skel-row{
  height:78px; border-radius:12px; background:var(--raised); margin-bottom:10px;
  animation:pd-pulse 1.2s ease-in-out infinite;
}
@keyframes pd-pulse{0%,100%{opacity:.5;} 50%{opacity:1;}}

/* ---- boot splash (pre-auth-data loading) ---- */
.pd-boot{align-items:center; justify-content:center;}
.pd-boot-title{
  font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:38px;
  letter-spacing:-0.03em; line-height:1; animation:pd-pulse 1.4s ease-in-out infinite;
}
.pd-boot-title span{color:var(--accent);}

/* ---- toast (undo) ---- */
.pd-toast{
  position:fixed; left:50%; transform:translateX(-50%); z-index:300;
  background:var(--raised); border:1px solid var(--line); border-radius:12px;
  padding:12px 16px; display:flex; align-items:center; gap:16px;
  box-shadow:0 12px 32px rgba(0,0,0,0.5); animation:pd-toast-in .2s ease;
  font-size:13px; max-width:calc(100vw - 32px);
}
@keyframes pd-toast-in{from{opacity:0; transform:translate(-50%, 10px);} to{opacity:1; transform:translate(-50%, 0);}}
.pd-toast button{
  background:none; border:none; color:var(--accent); font-weight:600; cursor:pointer;
  font-size:13px; font-family:'Plus Jakarta Sans',sans-serif; padding:6px 8px; margin:-6px -8px;
}

/* ---- FAB + composer ---- */
.pd-inputrow{display:flex; gap:8px; align-items:center;}
.pd-quickadd-row{margin-top:22px;}
.pd-send{
  display:none; width:44px; height:44px; border-radius:50%; border:none; flex-shrink:0;
  background:var(--accent); color:var(--accent-ink); font-size:18px; font-weight:700; cursor:pointer;
  align-items:center; justify-content:center;
}
.pd-send:active{transform:scale(.92);}
.pd-send:disabled{opacity:.4;}

/* ---- mobile ---- */
@media (max-width: 860px){
  .pd-body{display:block;}
  .pd-left, .pd-right{
    position:absolute; inset:0; width:100%; min-width:0; border-right:none;
    transition:transform .28s cubic-bezier(.2,.8,.2,1);
  }
  .pd-left{transform:translateX(0); z-index:1;}
  .pd-right{transform:translateX(100%); z-index:2;}
  .pd-right.edge-dragging{transition:none !important;}
  .pd-app.detail-open .pd-left{transform:translateX(-24%);}
  .pd-app.detail-open .pd-right{transform:translateX(0);}
  .pd-send{display:flex;}
  .pd-back{display:inline-block;}
  .pd-reorder{display:none;}
  .pd-drag-handle, .pd-x{opacity:1;}
  .pd-task{padding:11px 10px; gap:8px;}
  .pd-task-title{padding:2px 0;}
  .pd-task-row2{gap:6px;}
  .pd-task-due{font-size:10.5px;}
  .pd-dp-btn{padding:4px 8px; min-height:30px; font-size:11px;}
  .pd-x{padding:6px 6px; margin:-4px -2px;}
  .pd-drag-handle{padding:6px 2px; margin:-6px 0;}
  .pd-quickadd-row{margin-top:16px;}
  .pd-inputrow{margin-top:0;}
  /* Every editable field stays at 16px — iOS auto-zooms the viewport on focus for
     anything smaller, and pinch-zoom is user-controlled again (not locked app-wide),
     so there's no other mechanism dodging that behavior anymore. */
  input[type=text], input[type=email], input[type=date], input[type=number],
  textarea, select, [contenteditable]{font-size:16px !important;}
  .pd-bubble-edit, .pd-panel-edit, .pd-proj-name{font-size:16px !important;}
  /* bottom sheet note editor */
  .pd-overlay{align-items:flex-end; padding:0;}
  .pd-panel{width:100%; max-width:100%; border-radius:16px 16px 0 0; border-left:none; border-right:none; border-bottom:none; animation:pd-sheet-in .22s cubic-bezier(.2,.8,.2,1);}
  .pd-panel.fullscreen{width:100%; height:96dvh !important;}
  .pd-resize-handle{order:-1; border-top:none; border-bottom:1px solid var(--line); height:22px;}
  .pd-panel-header{order:0;}
  .pd-panel-body{order:1; padding-bottom:max(16px, env(safe-area-inset-bottom));}
}
@keyframes pd-sheet-in{from{transform:translateY(30%); opacity:.6;} to{transform:none; opacity:1;}}
@media (prefers-reduced-motion: reduce){
  *{transition:none !important; animation:none !important;}
}

/* ---- redesign: sidebar / bottom tab bar shell ---- */
.pd-shell{flex:1; display:flex; min-height:0;}
.pd-main{flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden;}
.pd-screen{flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden;}
.pd-tabbar{display:none;}

.pd-navicon{width:16px; height:16px; display:inline-block; flex-shrink:0;}
.pd-navicon-today{border-radius:50%; border:2px solid currentColor;}
.pd-navicon-projects{
  background:
    linear-gradient(currentColor 0 0) 0 0/7px 7px no-repeat,
    linear-gradient(currentColor 0 0) 9px 0/7px 7px no-repeat,
    linear-gradient(currentColor 0 0) 0 9px/7px 7px no-repeat,
    linear-gradient(currentColor 0 0) 9px 9px/7px 7px no-repeat;
}
.pd-navicon-calendar{border:2px solid currentColor; border-radius:4px;}
.pd-navicon-tasks{border:2px solid currentColor; border-radius:4px; position:relative;}
.pd-navicon-tasks::after{
  content:""; position:absolute; left:3px; top:5px; width:4px; height:7px;
  border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(45deg);
}
.pd-navicon-brain{border:2px solid currentColor; border-radius:4px; position:relative;}
.pd-navicon-brain::after{
  content:""; position:absolute; left:3px; right:3px; top:3px; height:0;
  border-top:2px solid currentColor; box-shadow:0 4px 0 currentColor;
}
.pd-navicon-stats{
  height:14px;
  background:
    linear-gradient(currentColor 0 0) 0 6px/4px 8px no-repeat,
    linear-gradient(currentColor 0 0) 6px 2px/4px 12px no-repeat,
    linear-gradient(currentColor 0 0) 12px 8px/4px 6px no-repeat;
}
.pd-navicon-search{border:2px solid currentColor; border-radius:50%; width:11px; height:11px; margin:2px 5px 5px 2px; position:relative;}
.pd-navicon-search::after{content:""; position:absolute; width:2px; height:6px; background:currentColor; right:-4px; bottom:-5px; transform:rotate(-45deg); border-radius:1px;}
.pd-navicon-collapse{
  width:14px; height:14px; border:2px solid currentColor; border-radius:4px; position:relative; transition:transform .18s ease;
}
.pd-navicon-collapse::after{content:""; position:absolute; left:4px; top:-2px; bottom:-2px; width:0; border-left:2px solid currentColor;}
.pd-navicon-collapse.flipped{transform:scaleX(-1);}

/* ---- redesign: sidebar ---- */
.pd-sidebar{
  width:260px; flex-shrink:0; border-right:1px solid var(--line);
  display:flex; flex-direction:column; padding:18px 12px; gap:18px;
  transition:width var(--dur-base) var(--ease-out), padding var(--dur-base) var(--ease-out);
}
.pd-sidebar.collapsed{width:68px; padding:18px 10px; align-items:center;}
.pd-sidebar-head{display:flex; flex-direction:column; gap:14px;}
.pd-sidebar-logo{width:30px; height:30px; border-radius:9px; flex-shrink:0; object-fit:cover;}
.pd-sidebar-search{
  all:unset; box-sizing:border-box; display:flex; align-items:center; gap:8px; cursor:pointer;
  padding:8px 10px; border-radius:var(--r-md); border:1px solid var(--line); color:var(--muted);
  font-size:13px; transition:background var(--dur-fast) ease, border-color var(--dur-fast) ease;
}
.pd-sidebar-search:hover{background:var(--card); border-color:var(--muted);}
.pd-sidebar-search-label{flex:1;}
.pd-sidebar-kbd{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); opacity:.7;}
.pd-sidebar-search-collapsed{width:36px; height:36px; justify-content:center; padding:0; border-radius:var(--r-md);}
.pd-sidebar-nav{display:flex; flex-direction:column; gap:2px;}
.pd-sidebar-item{
  all:unset; box-sizing:border-box; display:flex; align-items:center; gap:10px; cursor:pointer;
  padding:8px 10px; border-radius:var(--r-md); color:var(--muted); font-size:13.5px; width:100%;
  transition:background var(--dur-fast) ease, color var(--dur-fast) ease;
}
.pd-sidebar.collapsed .pd-sidebar-item{width:36px; height:36px; justify-content:center; padding:0;}
.pd-sidebar-item:hover{background:var(--card); color:var(--ink);}
.pd-sidebar-item.active{background:var(--raised); color:var(--accent);}
.pd-sidebar-item:focus-visible{outline:none; box-shadow:var(--focus-ring);}
.pd-sidebar-projects{flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:2px;}
.pd-sidebar-section-label{
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--muted); padding:8px 10px 4px;
}
.pd-sidebar-dot{width:7px; height:7px; border-radius:50%; flex-shrink:0;}
.pd-sidebar-project-name{overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;}
.pd-sidebar-foot{border-top:1px solid var(--line); padding-top:12px; width:100%;}
.pd-sidebar-collapse{
  all:unset; box-sizing:border-box; width:36px; height:36px; display:flex; align-items:center; justify-content:center;
  border-radius:var(--r-md); cursor:pointer; color:var(--muted); transition:background var(--dur-fast) ease, color var(--dur-fast) ease;
}
.pd-sidebar-collapse:hover{background:var(--card); color:var(--ink);}

/* ---- redesign: shared top-bar quick-add (Today/Calendar/Stats) ---- */
.pd-topbar-quickadd-wrap{flex:1; max-width:520px; min-width:160px;}
.pd-topbar-quickadd{
  width:100%; padding:9px 14px; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif;
  border:1px solid var(--line); border-radius:var(--r-md); background:var(--raised); color:var(--ink);
}
.pd-topbar-quickadd:focus{outline:none; border-color:var(--accent); box-shadow:var(--focus-ring);}
.pd-topbar-date{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); white-space:nowrap;}

/* ---- P2: universal quick-capture bar (chip preview + task/note mode) ---- */
.pd-capturebar-row{display:flex; align-items:stretch; gap:8px;}
.pd-capturebar-row .pd-topbar-quickadd{flex:1;}
.pd-capture-mode{
  all:unset; box-sizing:border-box; flex-shrink:0; padding:0 12px; display:flex; align-items:center;
  font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.04em; text-transform:uppercase;
  border:1px solid var(--line); border-radius:var(--r-md); color:var(--muted); cursor:pointer;
  transition:border-color .12s ease, color .12s ease;
}
.pd-capture-mode:hover{border-color:var(--accent); color:var(--accent);}
.pd-capture-mode.note{border-color:var(--accent); color:var(--accent);}
.pd-capture-chips{display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;}
.pd-capture-chip{
  all:unset; box-sizing:border-box; display:flex; align-items:center; gap:4px; padding:3px 9px;
  font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--ink);
  border:1px solid var(--line); border-radius:var(--r-pill); cursor:pointer; white-space:nowrap;
}
.pd-capture-chip:hover{border-color:var(--danger); color:var(--danger);}
.pd-capture-chip span{opacity:.6;}

/* ---- P2: Inbox review modal ---- */
.pd-review-entry{margin-bottom:14px;}
.pd-review-progress{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted);}
.pd-review-body{display:flex; flex-direction:column; gap:18px;}
.pd-review-title{font-family:'Plus Jakarta Sans',sans-serif; font-size:20px; font-weight:700; line-height:1.3;}
.pd-review-section{display:flex; flex-direction:column; gap:8px;}
.pd-review-label{
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);
}
.pd-review-chiprow{display:flex; flex-wrap:wrap; gap:6px;}
.pd-review-chip{
  all:unset; box-sizing:border-box; padding:6px 12px; font-size:13px; font-family:'Plus Jakarta Sans',sans-serif;
  border:1px solid var(--line); border-radius:var(--r-pill); color:var(--ink); cursor:pointer;
}
.pd-review-chip:hover{border-color:var(--accent); color:var(--accent);}
.pd-review-chip.active{border-color:var(--accent); background:var(--accent); color:var(--accent-ink);}
.pd-review-actions{display:flex; gap:8px; flex-wrap:wrap; margin-top:4px; padding-top:14px; border-top:1px solid var(--line);}
.pd-review-checkbox{display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); cursor:pointer;}

/* ---- redesign: priority dot + recurring toggle (shared by TaskRow + TodayTaskRow) ---- */
.pd-priority-dot{
  width:9px; height:9px; border-radius:50%; border:none; cursor:pointer; flex-shrink:0;
  margin-top:7px; padding:0; transition:transform .12s ease;
}
.pd-priority-dot:hover{transform:scale(1.3);}
.pd-recur-toggle{
  background:none; border:none; color:var(--muted); cursor:pointer; font-size:13px;
  opacity:0; transition:opacity .15s ease, color .15s ease; padding:6px;
}
.pd-recur-toggle.on{opacity:1; color:var(--accent);}
.pd-task:hover .pd-recur-toggle{opacity:1;}

/* ---- redesign: Today screen ---- */
.pd-today{
  flex:1; overflow-y:auto; padding:24px 32px; position:relative;
  background:
    radial-gradient(circle at 15% 0%, rgba(255,90,46,0.10), transparent 45%),
    radial-gradient(circle at 90% 12%, rgba(125,216,198,0.08), transparent 40%);
}
/* Wide measure: this screen now fills the window with a card grid, so it doesn't
   need the narrow reading-column cap the single-list layout used to. */
.pd-today-col{width:100%; max-width:1500px; margin:0 auto;}
.pd-today-topline{display:flex; align-items:stretch; gap:16px; margin-bottom:28px;}
.pd-stat-row{display:grid; grid-template-columns:repeat(auto-fit, minmax(170px,1fr)); gap:12px; flex:1;}
/* Master focus control — the app's "::" mark as a big round start/stop button */
.pd-focus-fab{
  all:unset; box-sizing:border-box; flex-shrink:0; width:100px; height:100px; border-radius:50%;
  background:var(--accent); color:var(--accent-ink); display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:28px; letter-spacing:.02em;
  transition:transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
}
.pd-focus-fab:hover{transform:translateY(-2px); box-shadow:var(--shadow-md);}
.pd-focus-fab:disabled{opacity:.4; cursor:default;}
.pd-focus-fab:disabled:hover{transform:none; box-shadow:none;}
.pd-focus-fab.running{background:var(--raised); color:var(--accent); box-shadow:inset 0 0 0 2px var(--accent);}
.pd-focus-fab.running span{animation:pd-pulse 1.6s ease-in-out infinite;}
.pd-stat-tile{
  border-radius:var(--r-lg); padding:20px 22px; border:none;
  display:flex; flex-direction:column; align-items:flex-start; text-align:left; gap:16px;
  transition:transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
}
.pd-stat-tile:hover{transform:translateY(-2px); box-shadow:var(--shadow-md);}
.pd-stat-tile.orange{background:var(--accent); color:var(--accent-ink);}
.pd-stat-tile.olive{background:var(--stat-sage); color:#0A0A0A;}
.pd-stat-tile.lilac{background:var(--stat-lilac); color:#0A0A0A;}
.pd-stat-tile.coral{background:var(--priority-high); color:#0A0A0A;}
.pd-stat-label{font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:14px; letter-spacing:-0.01em; opacity:.7;}
.pd-stat-value{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:46px; letter-spacing:-0.03em; line-height:1;}

/* Today's "next up" hero — one suggested task, pulled out of the regular buckets below. */
.pd-nextup-card{
  background:var(--card); border:1px solid var(--accent); border-radius:var(--r-lg);
  padding:14px 16px 12px; animation:pd-in .25s ease; margin-bottom:8px;
}
.pd-nextup-card .pd-today-row{border-bottom:none;}
.pd-nextup-actions{display:flex; gap:8px; margin-top:4px; padding-top:10px; border-top:1px solid var(--line);}
.pd-nextup-btn{
  all:unset; box-sizing:border-box; font-family:'IBM Plex Mono',monospace; font-size:11.5px;
  color:var(--ink); background:var(--raised); border:1px solid var(--line); border-radius:999px;
  padding:6px 13px; cursor:pointer; transition:border-color var(--dur-fast) ease;
}
.pd-nextup-btn:hover{border-color:var(--accent);}
.pd-nextup-btn.ghost{background:transparent; color:var(--muted);}

.pd-today-section + .pd-today-section{margin-top:4px;}

.pd-today-list{list-style:none;}
.pd-today-row{
  display:flex; align-items:flex-start; gap:10px; padding:12px 8px; margin:0 -8px;
  border-bottom:1px solid var(--line); border-radius:var(--r-sm);
  transition:background var(--dur-fast) ease;
}
.pd-today-row:hover{background:var(--raised);}
.pd-today-row.keyboard-selected{background:var(--raised); box-shadow:inset var(--focus-ring);}
.pd-today-info{flex:1; min-width:0;}
.pd-today-title{font-size:14.5px;}
.pd-today-title.done{color:var(--muted); text-decoration:line-through;}
.pd-today-title-link{cursor:pointer;}
.pd-today-title-link:hover{text-decoration:underline;}
.pd-today-meta{
  display:flex; align-items:center; gap:8px; margin-top:4px; flex-wrap:wrap;
  font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted);
}
.pd-track-pill{
  font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); background:var(--raised);
  border:1px solid var(--line); border-radius:999px; padding:5px 11px; display:flex; align-items:center; gap:6px;
  white-space:nowrap; cursor:pointer; flex-shrink:0; transition:background .15s ease, color .15s ease, border-color .15s ease;
}
.pd-track-pill.running{background:var(--accent); color:var(--accent-ink); border-color:var(--accent);}

/* Long-press / right-click menu for a Today task row (see Today.jsx TaskMenu) */
.pd-task-menu-scrim{position:fixed; inset:0; z-index:60; background:transparent;}
.pd-task-menu{
  position:fixed; z-index:61; min-width:140px; background:var(--raised); border:1px solid var(--line);
  border-radius:var(--r-md); box-shadow:var(--shadow-lg); padding:6px; display:flex; flex-direction:column;
  gap:2px; animation:pd-in .12s ease;
}
.pd-task-menu button{
  all:unset; box-sizing:border-box; width:100%; padding:9px 12px; border-radius:var(--r-sm);
  font-size:13.5px; font-family:'Plus Jakarta Sans',sans-serif; color:var(--ink); cursor:pointer;
}
.pd-task-menu button:hover{background:var(--card);}
.pd-task-menu button.danger{color:var(--danger);}
.pd-defer-menu, .pd-move-menu{max-height:min(320px, 70vh); overflow-y:auto;}
.pd-status-menu button{display:flex; align-items:center; gap:8px;}
.pd-status-menu button.active{background:var(--card); color:var(--accent);}

.pd-next-action-star{
  background:none; border:none; font-size:14px; line-height:1; cursor:pointer; color:var(--line);
  padding:0; margin-top:6px; flex-shrink:0;
}
.pd-next-action-star:hover{color:var(--muted);}
.pd-next-action-star.on{color:var(--accent);}

/* ---- P3: project templates ---- */
.pd-template-row{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;}
.pd-template-chip-wrap{display:flex; align-items:center; gap:2px;}
.pd-template-delete{
  background:none; border:none; color:var(--muted); cursor:pointer; font-size:14px; padding:2px 4px; line-height:1;
}
.pd-template-delete:hover{color:var(--danger);}

/* ---- P3: project health strip ---- */
.pd-health-strip{
  display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:10px;
  font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted);
}
.pd-health-strip .overdue{color:var(--danger);}
.pd-stale-flag{color:var(--muted); font-style:italic;}
.pd-card-stale{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); font-style:italic; margin-top:2px;}

/* ---- P3: project status ---- */
.pd-status-dot{width:8px; height:8px; border-radius:50%; flex-shrink:0;}
.pd-status-trigger{
  font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--ink);
  border:1px solid var(--line); border-radius:var(--r-sm); padding:8px 10px; background:var(--raised);
  cursor:pointer; display:flex; align-items:center; gap:7px; white-space:nowrap; min-height:36px;
}
.pd-status-trigger:hover{border-color:var(--accent);}
.pd-card-status{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); display:flex; align-items:center; gap:5px; margin-top:2px;}
.pd-card.archived{opacity:.5;}
.pd-archived-reveal{
  background:none; border:none; color:var(--muted); cursor:pointer; padding:8px 0; font-size:12px;
  font-family:'IBM Plex Mono',monospace; text-align:left;
}
.pd-archived-reveal:hover{color:var(--accent);}

/* ---- redesign: Today — Upcoming list ---- */
.pd-upcoming-list{list-style:none;}
.pd-upcoming-row{display:flex; align-items:center; gap:10px; padding:10px 4px; border-bottom:1px solid var(--line); cursor:pointer;}
.pd-upcoming-row:hover{background:var(--raised);}
.pd-check-sm{width:18px; height:18px; border-radius:6px;}
.pd-upcoming-info{flex:1; min-width:0;}
.pd-upcoming-title{font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pd-upcoming-meta{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); margin-top:2px;}
.pd-upcoming-due{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); white-space:nowrap; flex-shrink:0;}
.pd-upcoming-due.overdue{color:var(--danger); font-weight:600;}

/* ---- redesign: Calendar screen — full month grid, fills available height ---- */
.pd-calendar{flex:1; min-height:0; display:flex; flex-direction:column; padding:24px 32px;}
.pd-cal-head{display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:16px; flex-shrink:0;}
.pd-cal-monthyear{display:flex; align-items:baseline; gap:10px;}
.pd-cal-month{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:34px; letter-spacing:-.02em; line-height:1;}
.pd-cal-year{font-family:'IBM Plex Mono',monospace; font-size:13px; color:var(--muted);}
.pd-cal-nav{display:flex; gap:8px;}
.pd-cal-nav button{
  height:34px; padding:0 12px; border-radius:8px; border:1px solid var(--line); background:none;
  color:var(--muted); cursor:pointer; font-family:'IBM Plex Mono',monospace; font-size:12px;
}
.pd-cal-nav button:hover{border-color:var(--accent); color:var(--accent);}
.pd-cal-dow-row{display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin-bottom:6px; flex-shrink:0;}
.pd-cal-dow-label{
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.06em; text-transform:uppercase;
  color:var(--muted); text-align:center;
}
.pd-cal-month-grid{flex:1; min-height:0; display:grid; grid-template-columns:repeat(7,1fr); grid-template-rows:repeat(6,1fr); gap:8px;}
.pd-cal-cell{
  background:var(--card); border:1px solid var(--line); border-radius:var(--r-md); padding:6px;
  display:flex; flex-direction:column; gap:4px; min-height:0; min-width:0; overflow:hidden;
}
.pd-cal-cell.today{border-color:var(--accent); background:rgba(255,90,31,0.08);}
.pd-cal-cell.muted{opacity:.45;}
.pd-cal-cell.drag-over{border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent);}
.pd-cal-cell-date{
  font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:12px; flex-shrink:0;
  width:20px; height:20px; display:flex; align-items:center; justify-content:center; margin:2px 2px 0 0;
}
.pd-cal-cell.today .pd-cal-cell-date{background:var(--accent); color:var(--accent-ink); border-radius:50%;}
.pd-cal-cell-items{flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:3px;}
.pd-cal-chip{
  all:unset; box-sizing:border-box; display:block; width:100%; cursor:pointer; border-radius:5px; padding:3px 6px; font-size:10.5px;
  line-height:1.3; border-left:2px solid; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:filter .1s ease;
}
.pd-cal-chip:hover{filter:brightness(1.35);}
.pd-cal-chip.planned{border-left-style:dashed;}

/* ---- P4: Calendar unscheduled panel ---- */
.pd-cal-unscheduled{margin-bottom:14px; flex-shrink:0;}
.pd-cal-unscheduled-toggle{
  background:none; border:none; color:var(--muted); cursor:pointer; padding:4px 0;
  font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.04em; text-transform:uppercase;
}
.pd-cal-unscheduled-toggle:hover{color:var(--accent);}
.pd-cal-unscheduled-list{display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;}
.pd-cal-unscheduled-chip{
  all:unset; box-sizing:border-box; cursor:pointer; border-radius:var(--r-pill); padding:5px 12px; font-size:12px;
  border-left:2px solid; background:var(--card); color:var(--ink);
}
.pd-cal-unscheduled-chip:hover{filter:brightness(1.25);}
.pd-cal-unscheduled-chip.armed{box-shadow:inset 0 0 0 1px var(--accent); color:var(--accent);}
.pd-cal-arming-hint{
  display:flex; align-items:center; gap:10px; margin-bottom:12px; padding:8px 12px;
  background:rgba(255,90,46,0.1); border:1px solid var(--accent); border-radius:var(--r-sm);
  font-size:12px; color:var(--ink); flex-shrink:0;
}
.pd-cal-arming-hint button{background:none; border:none; color:var(--accent); cursor:pointer; text-decoration:underline; font-size:12px;}

.pd-cal-agenda{flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:2px;}
.pd-cal-agenda-day{display:flex; gap:14px; padding:14px 2px; border-bottom:1px solid var(--line);}
.pd-cal-agenda-date{flex-shrink:0; width:36px; text-align:center;}
.pd-cal-agenda-daynum{
  font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:20px; line-height:1;
  width:32px; height:32px; display:flex; align-items:center; justify-content:center; margin:0 auto; border-radius:50%;
}
.pd-cal-agenda-day.today .pd-cal-agenda-daynum{background:var(--accent); color:var(--accent-ink);}
.pd-cal-agenda-dow{
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.06em; text-transform:uppercase;
  color:var(--muted); margin-top:2px;
}
.pd-cal-agenda-items{flex:1; min-width:0; display:flex; flex-direction:column; gap:8px;}
.pd-cal-agenda-row{
  all:unset; box-sizing:border-box; width:100%; cursor:pointer; display:flex; align-items:baseline; gap:8px;
  border-left:2px solid; border-radius:var(--r-sm); padding:6px 10px; background:var(--card);
}
.pd-cal-agenda-row.planned{border-left-style:dashed;}
.pd-cal-agenda-title{font-size:14px; font-weight:600; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pd-cal-agenda-meta{
  font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); flex-shrink:0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:35%;
}
.pd-cal-agenda-empty-tap{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); padding:8px 0;}

.pd-cal-dayplan{
  display:flex; align-items:center; gap:14px; flex-shrink:0; margin-bottom:10px;
  font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--muted);
}
.pd-cal-dayplan-warn{color:var(--danger);}

/* ---- P4: HourGrid — day/week time-block view ---- */
.pd-hourgrid{flex:1; min-height:0; display:flex; flex-direction:column;}
.pd-hourgrid-headrow, .pd-hourgrid-alldayrow{display:flex; flex-shrink:0;}
.pd-hourgrid-axis-spacer{width:52px; flex-shrink:0;}
.pd-hourgrid-colhead{
  flex:1; min-width:0; text-align:center; padding:6px 4px 10px; display:flex; align-items:baseline; gap:6px; justify-content:center;
}
.pd-hourgrid-daynum{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:20px;}
.pd-hourgrid-colhead.today .pd-hourgrid-daynum{color:var(--accent);}
.pd-hourgrid-dow{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted);}
.pd-hourgrid-alldayrow{padding-bottom:8px; margin-bottom:4px; border-bottom:1px solid var(--line);}
.pd-hourgrid-alldaycell{flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; padding:0 4px;}
.pd-hourgrid-allday-chip{
  all:unset; box-sizing:border-box; cursor:pointer; border-radius:5px; padding:4px 8px; font-size:11.5px;
  border-left:2px solid; background:var(--card); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.pd-hourgrid-allday-chip.planned{border-left-style:dashed;}
.pd-hourgrid-allday-chip:hover{filter:brightness(1.35);}
.pd-hourgrid-scroll{flex:1; min-height:0; overflow-y:auto;}
.pd-hourgrid-body{position:relative; display:flex;}
.pd-hourgrid-axis{width:52px; flex-shrink:0; position:relative;}
.pd-hourgrid-hourlabel{
  position:absolute; left:0; right:8px; transform:translateY(-50%); text-align:right;
  font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted);
}
.pd-hourgrid-col{flex:1; min-width:0; position:relative; border-left:1px solid var(--line);}
.pd-hourgrid-col.today{background:rgba(255,90,31,0.04);}
.pd-hourgrid-col.drag-over{background:rgba(255,90,46,0.12);}
.pd-hourgrid-alldaycell.drag-over{background:rgba(255,90,46,0.12); border-radius:var(--r-sm);}
.pd-hourgrid-hourline{position:absolute; left:0; right:0; height:0; border-top:1px solid var(--line);}
.pd-hourgrid-now{position:absolute; left:0; right:0; height:0; border-top:2px solid var(--accent); z-index:2;}
.pd-hourgrid-block{
  all:unset; box-sizing:border-box; position:absolute; left:4px; right:4px; cursor:pointer;
  border-radius:5px; padding:3px 7px; border-left:2px solid; overflow:hidden; display:flex; flex-direction:column; gap:1px;
  transition:filter .1s ease;
}
.pd-hourgrid-block:hover{filter:brightness(1.35);}
.pd-hourgrid-block.planned{border-left-style:dashed;}
.pd-hourgrid-block.overbooked{box-shadow:inset 0 0 0 1px var(--danger);}
.pd-hourgrid-block-title{font-size:11.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.pd-hourgrid-block-time{font-family:'IBM Plex Mono',monospace; font-size:9.5px; color:var(--muted);}

/* ---- redesign: Stats screen ---- */
.pd-stats{flex:1; overflow-y:auto; padding:24px 32px;}
.pd-tasks-screen{flex:1; overflow-y:auto; padding:24px 32px;}
.pd-stats-panel{background:var(--card); border:1px solid var(--line); border-radius:var(--r-lg); padding:20px; margin-bottom:18px;}
.pd-daybar-row{display:flex; align-items:flex-end; gap:12px; height:120px;}
.pd-daybar-col{flex:1; display:flex; flex-direction:column; align-items:center; gap:10px; height:100%; justify-content:flex-end;}
.pd-daybar-track{width:100%; flex:1; display:flex; align-items:flex-end; justify-content:center;}
.pd-daybar-fill{width:4px; min-height:2px; border-radius:0; background:var(--accent);}
.pd-daybar-label{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted);}
.pd-heat-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(20px,1fr)); gap:6px;}
.pd-heatcell{aspect-ratio:1; border-radius:2px; background:var(--raised);}
.pd-heatcell.level-1{background:rgba(255,90,46,0.35);}
.pd-heatcell.level-2{background:rgba(255,90,46,0.65);}
.pd-heatcell.level-3{background:var(--accent);}

.pd-observations{display:flex; flex-direction:column; gap:8px;}
.pd-observation{font-size:13px; color:var(--ink);}

.pd-week-summary{display:flex; align-items:center; gap:28px; flex-wrap:wrap;}
.pd-week-stat-value{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:28px; line-height:1;}
.pd-week-stat-label{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); margin-top:4px;}
.pd-week-ring{display:flex; align-items:center; gap:10px; margin-left:auto;}
.pd-week-ring-label{font-size:12px; color:var(--muted); max-width:120px; line-height:1.4;}
.pd-week-carryover{margin-top:16px; padding-top:14px; border-top:1px solid var(--line); font-size:12.5px; color:var(--muted);}

.pd-projectbar-list{display:flex; flex-direction:column; gap:12px;}
.pd-projectbar-row{display:flex; align-items:center; gap:12px;}
.pd-projectbar-name{width:140px; flex-shrink:0; font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pd-projectbar-track{flex:1; height:8px; border-radius:4px; background:var(--raised); overflow:hidden;}
.pd-projectbar-fill{height:100%; border-radius:4px; transition:width .5s ease;}
.pd-projectbar-count{width:20px; flex-shrink:0; text-align:right; font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted);}

/* ---- redesign: single-task edit modal (inbox tasks from Calendar) ---- */
.pd-task-edit-body{display:flex; flex-direction:column; gap:16px;}
.pd-task-edit-row{display:flex; align-items:center; gap:10px;}

/* ---- redesign: Notes screen — all notes in one wall, drop images anywhere ---- */
.pd-notes{flex:1; overflow-y:auto; padding:24px 32px;}
.pd-notes.dragover{outline:2px dashed var(--accent); outline-offset:-10px; border-radius:var(--r-lg);}
.pd-notes-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(240px,1fr)); gap:14px; align-items:start;}
.pd-notes-cell{min-width:0;}
.pd-notes-cell .pd-bubble{margin:0;}
.pd-notes-source{
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.05em; text-transform:uppercase;
  color:var(--muted); margin:6px 2px 0;
}

/* ---- redesign: command palette (Cmd/Ctrl+K) ---- */
.pd-palette-panel{width:min(560px, 90vw); max-height:70vh; padding:0; min-height:0;}
.pd-palette-input{
  width:100%; padding:16px 18px; font-size:15px; font-family:'Plus Jakarta Sans',sans-serif;
  border:none; border-bottom:1px solid var(--line); background:transparent; color:var(--ink); outline:none;
}
.pd-palette-input:focus-visible{box-shadow:inset var(--focus-ring);}
.pd-palette-results{max-height:min(420px, 60vh); overflow-y:auto; padding:6px;}
.pd-palette-empty{padding:20px; text-align:center; color:var(--muted); font-size:13px;}
.pd-palette-row{
  all:unset; box-sizing:border-box; display:flex; align-items:center; gap:10px; width:100%;
  padding:10px 12px; border-radius:var(--r-md); cursor:pointer; font-size:13.5px; color:var(--ink);
}
.pd-palette-row.active{background:var(--raised);}
.pd-palette-dot{width:8px; height:8px; border-radius:50%; flex-shrink:0;}
.pd-palette-title{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pd-palette-meta{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); flex-shrink:0;}

/* ---- redesign: mobile overrides — kept last so they win over the base rules above ---- */
@media (max-width: 860px){
  .pd-title{font-size:28px;}
  .pd-today-topline{gap:10px; margin-bottom:16px;}
  .pd-focus-fab{width:64px; height:64px; font-size:18px;}
  .pd-sync-wrap{right:10px; bottom:calc(64px + env(safe-area-inset-bottom));}
  .pd-sync-pill{padding:6px 10px; font-size:10px;}
  .pd-tabbar{
    display:flex; flex-shrink:0; justify-content:space-around; border-top:1px solid var(--line);
    background:var(--bg); padding:8px 4px max(8px, env(safe-area-inset-bottom));
  }
  .pd-tabbar-btn{
    background:none; border:none; color:var(--muted); cursor:pointer; padding:4px 10px;
    display:flex; flex-direction:column; align-items:center; gap:3px;
    font-family:'IBM Plex Mono',monospace; font-size:10px;
  }
  .pd-tabbar-btn.active{color:var(--accent);}
  .pd-today, .pd-calendar, .pd-stats{padding:18px 16px;}
  .pd-cal-month{font-size:26px;}
  .pd-stat-row{grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px;}
  .pd-stat-tile{padding:10px 8px; gap:8px;}
  .pd-stat-label{font-size:12px;}
  .pd-focus-banner{padding:7px 14px; padding-top:max(7px, env(safe-area-inset-top)); font-size:12px; gap:8px;}
  .pd-focus-label{display:none;}
  .pd-focus-project{display:none;}

  /* Projects detail header — collapse to the smallest footprint that's still editable,
     so a task is visible without scrolling past name/client/location/phase/progress. */
  .pd-right{padding:14px 16px;}
  .pd-detail-head{gap:6px;}
  .pd-proj-name{padding:2px 0;}
  .pd-meta-grid{display:grid; grid-template-columns:1fr 1fr; gap:2px 8px; margin-top:6px; align-items:stretch;}
  .pd-field{gap:0;}
  .pd-field label{font-size:9px;}
  .pd-field input[type=text]{font-size:12px !important; padding:2px 4px; min-width:0;}
  .pd-overall-label{margin-top:8px !important; font-size:11px;}
  .pd-progressbar{margin-top:6px; height:5px;}
  .pd-danger-btn{padding:5px 9px; font-size:11px;}
}
`;
