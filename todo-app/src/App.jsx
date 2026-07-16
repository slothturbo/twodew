import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { storage } from "./lib/storage";
import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  v8 — native-feel: fixed shell, swipes, undo, FAB, bottom sheet     */
/* ------------------------------------------------------------------ */
const STORAGE_KEY = "projects-data-v1";
const OLD_HUES = ["#2E6BE6", "#0E8A7B", "#7A4FBF", "#C77D0A", "#C74A6B", "#3D7A2E"];
const PALETTE = [
  { fg: "#8FB4FF", bg: "rgba(143,180,255,0.09)" },
  { fg: "#7DD8C6", bg: "rgba(125,216,198,0.09)" },
  { fg: "#C2A6F5", bg: "rgba(194,166,245,0.09)" },
  { fg: "#F2A6BC", bg: "rgba(242,166,188,0.09)" },
  { fg: "#ABDB8C", bg: "rgba(171,219,140,0.09)" },
  { fg: "#8AD2EA", bg: "rgba(138,210,234,0.09)" },
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');

:root{
  --bg:#14181E; --card:#1B2129; --raised:#212933; --ink:#E8ECF1; --muted:#8C96A3;
  --line:#2C343E; --accent:#E9B44C; --accent-ink:#1A1300; --danger:#E06A87; --ok:#7DD8A6;
  color-scheme: dark;
}
*{box-sizing:border-box; margin:0; padding:0;}

/* ---- native-feel shell: app is fixed to the viewport, only inner panes scroll ---- */
.pd-app{
  font-family:'Inter',system-ui,sans-serif; color:var(--ink);
  background:var(--bg); position:fixed; inset:0; display:flex; flex-direction:column;
  overscroll-behavior:none; -webkit-tap-highlight-color:transparent;
  user-select:none; -webkit-user-select:none; -webkit-touch-callout:none;
}
input, textarea, select, [contenteditable], .pd-bubble-content{
  user-select:text; -webkit-user-select:text;
}
::selection{background:var(--accent); color:var(--accent-ink);}
::placeholder{color:var(--muted); opacity:.7;}
button{touch-action:manipulation;}
.pd-press:active{transform:scale(.97); filter:brightness(1.15);}

.pd-topbar{
  padding:20px 24px 16px; padding-top:max(20px, env(safe-area-inset-top)); border-bottom:1px solid var(--line);
  display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; flex-shrink:0;
}
.pd-title{font-family:'Archivo',sans-serif; font-weight:800; font-size:22px; letter-spacing:-0.02em;}
.pd-title span{color:var(--accent);}
.pd-overall{display:flex; align-items:center; gap:12px; min-width:180px; flex:1; max-width:420px;}
.pd-overall-bar{flex:1; height:6px; background:var(--raised); border-radius:3px; overflow:hidden;}
.pd-overall-fill{height:100%; background:var(--accent); border-radius:3px; transition:width .6s ease;}
.pd-overall-label{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted); white-space:nowrap;}

.pd-body{flex:1; display:flex; min-height:0; position:relative; overflow:hidden;}
.pd-left{
  width:380px; min-width:320px; border-right:1px solid var(--line); overflow-y:auto; padding:16px;
  -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
}
.pd-right{
  flex:1; overflow-y:auto; padding:24px; background:var(--card);
  -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
}

/* ---- search ---- */
.pd-search{
  width:100%; padding:9px 12px; font-size:14px; font-family:'Inter',sans-serif;
  border:1px solid var(--line); border-radius:10px; background:var(--raised); color:var(--ink); margin-bottom:12px;
}
.pd-search:focus{outline:none; border-color:var(--accent);}

/* ---- project cards ---- */
.pd-card{
  border:1px solid var(--line); border-radius:12px;
  padding:14px; display:flex; gap:14px; align-items:center; cursor:pointer;
  margin-bottom:10px; transition:border-color .15s ease, transform .08s ease;
}
.pd-card:active{transform:scale(.985);}
.pd-card:hover{border-color:var(--pfg);}
.pd-card.selected{border-color:var(--pfg); box-shadow:0 0 0 1px var(--pfg);}
.pd-card:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}
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
  font-family:'Inter',sans-serif; transition:border-color .15s ease,color .15s ease;
}
.pd-addproj:hover{border-color:var(--accent); color:var(--accent);}

/* ---- detail ---- */
.pd-back{display:none; background:none; border:none; color:var(--muted); font-size:13px; cursor:pointer; margin-bottom:12px; font-family:'IBM Plex Mono',monospace; padding:8px 8px 8px 0;}
.pd-detail-head{display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;}
.pd-proj-name{font-family:'Archivo',sans-serif; font-weight:700; font-size:26px; letter-spacing:-0.02em; border:none; background:transparent; width:100%; color:var(--ink);}
.pd-proj-name:focus{outline:none; border-bottom:2px solid var(--accent);}
.pd-meta-grid{display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; align-items:flex-end;}
.pd-field{display:flex; flex-direction:column; gap:3px;}
.pd-field label{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);}
.pd-field input[type=text]{
  font-size:13px; font-family:'Inter',sans-serif; color:var(--ink);
  border:1px solid var(--line); border-radius:6px; padding:5px 9px; background:var(--raised); min-width:130px;
}
.pd-field input:focus{outline:none; border-color:var(--accent);}
.pd-progressbar{height:8px; background:var(--raised); border-radius:4px; overflow:hidden; margin-top:16px;}
.pd-progressfill{height:100%; border-radius:4px; transition:width .6s ease;}

/* ---- custom date picker ---- */
.pd-dp-wrap{position:relative; display:inline-block;}
.pd-dp-btn{
  font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--ink);
  border:1px solid var(--line); border-radius:6px; padding:8px 10px; background:var(--raised);
  cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; min-height:36px;
}
.pd-dp-btn:hover{border-color:var(--accent);}
.pd-dp-btn.empty{color:var(--muted);}
.pd-dp-pop{
  z-index:200; width:280px; max-width:calc(100vw - 16px);
  background:var(--raised); border:1px solid var(--line); border-radius:12px; padding:14px;
  box-shadow:0 12px 32px rgba(0,0,0,0.45); animation:pd-pop .12s ease;
}
@keyframes pd-pop{from{opacity:0; transform:translateY(-4px);} to{opacity:1; transform:none;}}
.pd-dp-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;}
.pd-dp-month{font-family:'Archivo',sans-serif; font-weight:700; font-size:15px;}
.pd-dp-nav{display:flex; gap:4px;}
.pd-dp-nav button{
  background:none; border:1px solid var(--line); border-radius:6px; width:32px; height:32px;
  color:var(--ink); cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.pd-dp-nav button:hover{border-color:var(--accent); color:var(--accent);}
.pd-dp-grid{display:grid; grid-template-columns:repeat(7,1fr); gap:2px; text-align:center;}
.pd-dp-dow{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); padding:4px 0;}
.pd-dp-cell{
  font-family:'IBM Plex Mono',monospace; font-size:12px; padding:8px 0; border-radius:6px;
  cursor:pointer; background:none; border:none; color:var(--ink); min-height:34px;
}
.pd-dp-cell:hover{background:rgba(233,180,76,0.15);}
.pd-dp-cell.muted{color:var(--muted); opacity:.5;}
.pd-dp-cell.today{box-shadow:inset 0 0 0 1px var(--accent);}
.pd-dp-cell.selected{background:var(--accent); color:var(--accent-ink); font-weight:600;}
.pd-dp-foot{display:flex; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--line);}
.pd-dp-link{background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer; font-family:'Inter',sans-serif; padding:8px;}
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
  width:100%; margin-top:22px; padding:12px 14px; font-size:15px; font-family:'Inter',sans-serif;
  border:1px solid var(--line); border-radius:10px; background:var(--raised); color:var(--ink);
}
.pd-quickadd:focus{outline:none; border-color:var(--accent);}
.pd-tasklist{margin-top:14px; list-style:none;}
.pd-tasksep{
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--muted); padding:12px 6px 4px; border-top:1px solid var(--line); margin-top:6px;
}
.pd-task-outer{position:relative; overflow:hidden; border-bottom:1px solid var(--line);}
.pd-task-bg{
  position:absolute; inset:0; display:flex; align-items:center; justify-content:space-between;
  padding:0 18px; font-size:18px; pointer-events:none;
}
.pd-task-bg .bg-done{color:var(--ok);} .pd-task-bg .bg-del{color:var(--danger);}
.pd-task{
  display:flex; align-items:center; gap:8px; padding:12px 6px; background:var(--card);
  animation:pd-in .2s ease; flex-wrap:wrap; position:relative;
  border-top:2px solid transparent; touch-action:pan-y;
}
.pd-task.snapback{transition:transform .25s ease;}
.pd-task:hover .pd-x, .pd-task:hover .pd-reorder button, .pd-task:hover .pd-drag-handle{opacity:1;}
.pd-task.dragging{opacity:.35;}
.pd-task.drag-over{border-top-color:var(--accent);}
.pd-task.completed{opacity:.55;}
@keyframes pd-in{from{opacity:0; transform:translateY(3px);} to{opacity:1; transform:none;}}
.pd-check{
  width:24px; height:24px; border-radius:7px; border:2px solid var(--line); background:transparent;
  cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  transition:background .15s ease,border-color .15s ease; padding:0;
}
.pd-check svg{opacity:0; transition:opacity .15s ease;}
.pd-check.done svg{opacity:1;}
.pd-task-title{flex:1; min-width:120px; font-size:15px; border:none; background:transparent; color:var(--ink); font-family:'Inter',sans-serif; padding:4px 0;}
.pd-task-title:focus{outline:none;}
.pd-task-title.done{color:var(--muted); text-decoration:line-through;}
.pd-task-due{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); white-space:nowrap;}
.pd-task-meta{display:flex; align-items:center; gap:8px;}
.pd-x{
  background:none; border:none; color:var(--muted); cursor:pointer; font-size:16px;
  opacity:0; transition:opacity .15s ease; padding:8px 10px; margin:-6px -4px;
}
.pd-x:focus-visible{opacity:1;}

/* ---- brain noises ---- */
.pd-section-label{
  font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--muted); margin:28px 0 8px;
}
.pd-noise-input{
  width:100%; padding:10px 14px; font-size:14px; font-family:'Inter',sans-serif;
  border:1px solid var(--line); border-radius:20px; background:var(--raised); color:var(--ink);
}
.pd-noise-input:focus{outline:none; border-color:var(--accent);}
.pd-bubbles{display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; margin-top:12px;}
.pd-bubble{
  position:relative; border:1px solid var(--line); border-radius:14px;
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
.pd-bubble-content h2{font-family:'Archivo',sans-serif; font-size:16px; font-weight:800; margin-bottom:2px;}
.pd-bubble-content h3{font-family:'Archivo',sans-serif; font-size:15px; margin-bottom:2px;}
.pd-bubble-content h4{font-family:'Archivo',sans-serif; font-size:13.5px; font-weight:600; color:var(--muted);}
.pd-bubble-content ul{padding-left:18px; margin:4px 0;}
.pd-bubble-content b, .pd-bubble-content strong{font-weight:700;}
.pd-bubble-content pre{
  font-family:'IBM Plex Mono',monospace; font-size:12px; white-space:pre-wrap;
  background:rgba(255,255,255,0.05); border-radius:6px; padding:4px 8px; margin:3px 0;
}
.pd-bubble-content img{max-width:100%; border-radius:8px; display:block; margin:6px 0; border:1px solid var(--line);}
.pd-bubble-content.clamped img{max-height:80px; width:auto;}
.pd-bubble .pd-x{position:absolute; top:2px; right:2px;}
.pd-bubble .pd-drag-handle{position:absolute; top:8px; left:4px;}

/* ---- text style (Aa) menu ---- */
.pd-toolbar{display:flex; gap:2px;}
.pd-toolbar button{
  min-width:32px; height:32px; border-radius:6px; border:1px solid transparent; background:none;
  color:var(--ink); cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center;
}
.pd-toolbar button:hover{background:rgba(233,180,76,0.15); border-color:var(--accent);}
.pd-toolbar .b{font-weight:700;} .pd-toolbar .i{font-style:italic;} .pd-toolbar .u{text-decoration:underline;} .pd-toolbar .s{text-decoration:line-through;}
.pd-aa-wrap{position:relative;}
.pd-aa-menu{
  position:absolute; top:calc(100% + 6px); left:0; z-index:60; min-width:170px;
  background:var(--raised); border:1px solid var(--line); border-radius:10px; padding:6px;
  box-shadow:0 12px 32px rgba(0,0,0,0.45); animation:pd-pop .12s ease;
}
.pd-aa-menu button{
  display:block; width:100%; text-align:left; background:none; border:none; color:var(--ink);
  padding:9px 10px; border-radius:6px; cursor:pointer; font-family:'Inter',sans-serif;
}
.pd-aa-menu button:hover{background:rgba(233,180,76,0.15);}
.pd-aa-title{font-family:'Archivo',sans-serif; font-weight:800; font-size:17px;}
.pd-aa-heading{font-family:'Archivo',sans-serif; font-weight:700; font-size:15px;}
.pd-aa-sub{font-family:'Archivo',sans-serif; font-weight:600; font-size:13px;}
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
  width:min(640px, 92vw); background:var(--raised); border:1px solid var(--line); border-radius:16px;
  box-shadow:0 24px 64px rgba(0,0,0,0.5); display:flex; flex-direction:column; overflow:hidden;
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
.pd-panel-body{flex:1; overflow-y:auto; padding:16px 18px; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;}
.pd-panel-edit{
  font-size:15px; font-family:'Inter',sans-serif; color:var(--ink); line-height:1.65; min-height:100%;
}
.pd-panel-edit:focus{outline:none;}
.pd-panel-edit h2{font-family:'Archivo',sans-serif; font-size:23px; font-weight:800; margin:6px 0 2px;}
.pd-panel-edit h3{font-family:'Archivo',sans-serif; font-size:19px; margin:4px 0;}
.pd-panel-edit h4{font-family:'Archivo',sans-serif; font-size:16px; font-weight:600; margin:4px 0 2px; color:var(--muted);}
.pd-panel-edit ul{padding-left:20px; margin:6px 0;}
.pd-panel-edit b, .pd-panel-edit strong{font-weight:700;}
.pd-panel-edit pre{
  font-family:'IBM Plex Mono',monospace; font-size:13px; white-space:pre-wrap;
  background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 10px; margin:6px 0;
}
.pd-panel-edit img{max-width:100%; border-radius:8px; display:block; margin:6px 0; border:1px solid var(--line);}
.pd-resize-handle{
  flex-shrink:0; height:18px; display:flex; align-items:center; justify-content:center;
  cursor:ns-resize; touch-action:none; border-top:1px solid var(--line);
}
.pd-resize-handle span{width:36px; height:4px; border-radius:2px; background:var(--line);}
.pd-resize-handle:hover span{background:var(--accent);}

/* ---- phase combobox ---- */
.pd-combo{position:relative;}
.pd-combo input{
  font-size:13px; font-family:'Inter',sans-serif; color:var(--ink);
  border:1px solid var(--line); border-radius:6px; padding:5px 9px; background:var(--raised); min-width:150px; width:100%;
}
.pd-combo input:focus{outline:none; border-color:var(--accent);}
.pd-combo-pop{
  position:absolute; top:calc(100% + 4px); left:0; z-index:50; min-width:100%;
  background:var(--raised); border:1px solid var(--line); border-radius:10px; padding:4px;
  box-shadow:0 12px 32px rgba(0,0,0,0.45); max-height:200px; overflow-y:auto; animation:pd-pop .12s ease;
}
.pd-combo-pop button{
  display:block; width:100%; text-align:left; background:none; border:none; color:var(--ink);
  padding:9px; border-radius:6px; cursor:pointer; font-size:13px; font-family:'Inter',sans-serif; white-space:nowrap;
}
.pd-combo-pop button:hover{background:rgba(233,180,76,0.15);}

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
.pd-tl-bar{position:absolute; top:4px; height:12px; border-radius:6px;}
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
.pd-saved{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); margin-top:6px; min-height:14px;}
.pd-form{background:var(--card); border:1px solid var(--accent); border-radius:12px; padding:14px; margin-bottom:10px;}
.pd-form input[type=text]{
  width:100%; padding:10px 11px; font-size:14px; border:1px solid var(--line); border-radius:8px;
  font-family:'Inter',sans-serif; margin-bottom:8px; background:var(--raised); color:var(--ink);
}
.pd-form input[type=text]:focus{outline:none; border-color:var(--accent);}
.pd-form-row{display:flex; gap:8px; align-items:center; flex-wrap:wrap;}
.pd-form-label{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:4px;}
.pd-btn{
  border:none; background:var(--accent); color:var(--accent-ink); border-radius:8px; padding:10px 14px;
  font-size:13px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;
}
.pd-btn.ghost{background:transparent; color:var(--muted); border:1px solid var(--line);}

/* ---- skeleton loading ---- */
.pd-skel{padding:16px; max-width:420px;}
.pd-skel-row{
  height:78px; border-radius:12px; background:var(--raised); margin-bottom:10px;
  animation:pd-pulse 1.2s ease-in-out infinite;
}
@keyframes pd-pulse{0%,100%{opacity:.5;} 50%{opacity:1;}}

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
  font-size:13px; font-family:'Inter',sans-serif; padding:6px 8px; margin:-6px -8px;
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
  /* Task rows: tighter padding/gaps (Material list spec: 8dp row padding, 4dp tight gaps),
     and due/date/delete pinned to their own line so wrap is predictable, not ragged. */
  .pd-task{padding:9px 4px; gap:6px;}
  .pd-task-title{padding:2px 0;}
  .pd-task-meta{flex-basis:100%; justify-content:flex-end; margin-left:56px; gap:6px; margin-top:-2px;}
  .pd-task-due{font-size:10.5px;}
  .pd-dp-btn{padding:4px 8px; min-height:30px; font-size:11px;}
  .pd-x{padding:6px 6px; margin:-4px -2px;}
  .pd-drag-handle{padding:6px 2px; margin:-6px 0;}
  .pd-quickadd-row{margin-top:16px;}
  .pd-inputrow{margin-top:0;}
  /* Zoom is disabled app-wide (see zoom-lock effect), so fields no longer need to
     stay at 16px purely to dodge iOS auto-zoom — task titles get a touch smaller
     for density; comfortable typing fields (name/notes/etc) stay at 16px. */
  input[type=text], input[type=email], input[type=date], input[type=number],
  textarea, select, [contenteditable]{font-size:16px !important;}
  .pd-bubble-edit, .pd-panel-edit, .pd-proj-name{font-size:16px !important;}
  .pd-task-title{font-size:15px !important;}
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
`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const colorOf = (p) => PALETTE[(p.colorIdx ?? 0) % PALETTE.length];

function progressOf(p) {
  if (!p.tasks.length) return null;
  return Math.round((p.tasks.filter((t) => t.done).length / p.tasks.length) * 100);
}
function daysLeft(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}
function dueLabel(dateStr) {
  const dl = daysLeft(dateStr);
  if (dl === null) return null;
  if (dl < 0) return { text: `${Math.abs(dl)}d over`, overdue: true };
  if (dl === 0) return { text: "today", overdue: true };
  return { text: `${dl}d left`, overdue: false };
}
function fmtDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function nextDue(p) {
  const dates = p.tasks.filter((t) => !t.done && t.deadline).map((t) => t.deadline);
  if (!dates.length) return null;
  return dates.sort()[0];
}
function startedLabel(startDate) {
  const dl = daysLeft(startDate);
  if (dl === null) return null;
  if (dl > 0) return `starts in ${dl}d`;
  if (dl === 0) return "started today";
  return `day ${Math.abs(dl) + 1}`;
}
function attentionSort(a, b) {
  const doneA = progressOf(a) === 100, doneB = progressOf(b) === 100;
  if (doneA !== doneB) return doneA ? 1 : -1;
  const da = daysLeft(nextDue(a)), db = daysLeft(nextDue(b));
  if (da === null && db === null) return a.createdAt - b.createdAt;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}
function moveItem(list, fromId, toId) {
  const items = [...list];
  const fromIdx = items.findIndex((i) => i.id === fromId);
  const toIdx = items.findIndex((i) => i.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return list;
  const [moved] = items.splice(fromIdx, 1);
  items.splice(toIdx, 0, moved);
  return items;
}
function moveBy(list, id, dir) {
  const items = [...list];
  const idx = items.findIndex((i) => i.id === id);
  const swapIdx = idx + dir;
  if (idx === -1 || swapIdx < 0 || swapIdx >= items.length) return list;
  [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
  return items;
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}
function sanitizeHtml(html) {
  const allowed = /^(B|STRONG|I|EM|U|S|STRIKE|BR|DIV|SPAN|H2|H3|H4|PRE|UL|LI|OL|IMG|P)$/;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
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
function htmlToPlain(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || "";
}
function imageFileToDataURL(file, maxDim = 900, quality = 0.8) {
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
      let out = render(maxDim, quality);
      if (out.length > 1_800_000) out = render(600, 0.68);
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
function migrate(p, i) {
  const out = { ...p };
  if (typeof out.notes === "string") out.notes = out.notes.trim() ? [{ id: uid(), text: out.notes.trim() }] : [];
  if (!Array.isArray(out.notes)) out.notes = [];
  out.notes = out.notes.map((n) => ({ ...n, text: /<[a-z]/i.test(n.text) ? n.text : textToHtml(n.text) }));
  if (!out.startDate) out.startDate = new Date(out.createdAt || Date.now()).toISOString().slice(0, 10);
  if (out.client === undefined) out.client = "";
  if (out.location === undefined) out.location = "";
  if (out.phase === undefined) out.phase = "";
  if (out.colorIdx === undefined) {
    const oldIdx = OLD_HUES.indexOf(out.color);
    out.colorIdx = oldIdx >= 0 ? oldIdx : i % PALETTE.length;
  }
  delete out.deadline; delete out.color;
  out.tasks = (out.tasks || []).map((t) => ({ deadline: null, ...t }));
  return out;
}

/* ------------------------------------------------------------------ */
/*  Hooks: mobile detection + on-screen keyboard inset                 */
/* ------------------------------------------------------------------ */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 860px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange); };
  }, []);
  return mobile;
}

// Distance the on-screen keyboard covers, so composers/toasts sit above it
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(covered)));
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", onResize); };
  }, []);
  return inset;
}

/* ------------------------------------------------------------------ */
/*  Custom themed date picker (viewport-clamped)                       */
/* ------------------------------------------------------------------ */
function DatePicker({ value, onChange, placeholder = "Set date" }) {
  const [open, setOpen] = useState(false);
  const base = value ? new Date(value + "T00:00:00") : new Date();
  const [viewY, setViewY] = useState(base.getFullYear());
  const [viewM, setViewM] = useState(base.getMonth());
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const POP_W = 280, POP_H = 360, margin = 8;
    const place = () => {
      const r = btnRef.current.getBoundingClientRect();
      let left = r.left;
      let top = r.bottom + 6;
      if (left + POP_W > window.innerWidth - margin) left = window.innerWidth - POP_W - margin;
      if (left < margin) left = margin;
      if (top + POP_H > window.innerHeight - margin) {
        const above = r.top - POP_H - 6;
        top = above > margin ? above : Math.max(margin, window.innerHeight - POP_H - margin);
      }
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM, 1);
    const startOffset = first.getDay();
    const gridStart = new Date(viewY, viewM, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewY, viewM]);

  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayIso = todayISO();

  const nav = (delta) => {
    let m = viewM + delta, y = viewY;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setViewM(m); setViewY(y);
  };

  return (
    <div className="pd-dp-wrap" ref={ref}>
      <button type="button" ref={btnRef} className={`pd-dp-btn pd-press ${!value ? "empty" : ""}`} onClick={() => setOpen((o) => !o)}>
        📅 {value ? fmtDate(value) : placeholder}
      </button>
      {open && (
        <div className="pd-dp-pop" ref={popRef} role="dialog" aria-label="Choose date"
          style={pos ? { position: "fixed", top: pos.top, left: pos.left } : { visibility: "hidden" }}>
          <div className="pd-dp-head">
            <div className="pd-dp-month">{MONTHS[viewM]} {viewY}</div>
            <div className="pd-dp-nav">
              <button type="button" onClick={() => nav(-1)} aria-label="Previous month">↑</button>
              <button type="button" onClick={() => nav(1)} aria-label="Next month">↓</button>
            </div>
          </div>
          <div className="pd-dp-grid">
            {DOW.map((d, i) => <div key={i} className="pd-dp-dow">{d}</div>)}
            {cells.map((d, i) => {
              const iso = toISO(d);
              const muted = d.getMonth() !== viewM;
              return (
                <button type="button" key={i}
                  className={`pd-dp-cell ${muted ? "muted" : ""} ${iso === todayIso ? "today" : ""} ${iso === value ? "selected" : ""}`}
                  onClick={() => { onChange(iso); setViewM(d.getMonth()); setViewY(d.getFullYear()); setOpen(false); }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="pd-dp-foot">
            <button type="button" className="pd-dp-link" onClick={() => { onChange(null); setOpen(false); }}>Clear</button>
            <button type="button" className="pd-dp-link" onClick={() => { onChange(todayIso); setOpen(false); }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase combobox                                                     */
/* ------------------------------------------------------------------ */
function PhaseCombo({ value, onChange, suggestions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = (value || "").toLowerCase();
  const filtered = suggestions.filter((s) => s.toLowerCase().includes(q) && s !== value);

  return (
    <div className="pd-combo" ref={ref}>
      <input type="text" value={value || ""} placeholder="—"
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { setOpen(false); e.target.blur(); } }} />
      {open && filtered.length > 0 && (
        <div className="pd-combo-pop">
          {filtered.map((s) => (
            <button type="button" key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s); setOpen(false); }}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline — horizontal Gantt from startDate → task deadlines        */
/* ------------------------------------------------------------------ */
function Timeline({ projects, selectedId, onSelect }) {
  const today = todayISO();
  const range = useMemo(() => {
    let min = today, max = today;
    projects.forEach((p) => {
      if (p.startDate && p.startDate < min) min = p.startDate;
      p.tasks.forEach((t) => { if (t.deadline && t.deadline > max) max = t.deadline; });
    });
    const padDays = (iso, days) => {
      const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    return { min: padDays(min, -3), max: padDays(max, 5) };
  }, [projects, today]);

  const toDays = (iso) => new Date(iso + "T00:00:00").getTime() / 86400000;
  const span = Math.max(1, toDays(range.max) - toDays(range.min));
  const xPct = (iso) => ((toDays(iso) - toDays(range.min)) / span) * 100;
  const clamp = (v) => Math.min(100, Math.max(0, v));

  if (!projects.length) return <p className="pd-empty">No projects to plot yet.</p>;

  return (
    <div className="pd-tl">
      <div className="pd-tl-axis">
        <span>{fmtDate(range.min)}</span>
        <span>today</span>
        <span>{fmtDate(range.max)}</span>
      </div>
      {projects.map((p) => {
        const c = colorOf(p);
        const start = p.startDate || today;
        const deadlines = p.tasks.filter((t) => t.deadline);
        const lastDl = deadlines.length ? deadlines.map((t) => t.deadline).sort().slice(-1)[0] : null;
        const barEnd = lastDl && lastDl > start ? lastDl : today > start ? today : start;
        const left = clamp(xPct(start));
        const width = Math.max(0.8, clamp(xPct(barEnd)) - left);
        return (
          <div key={p.id} className={`pd-tl-row ${p.id === selectedId ? "selected" : ""}`}
            role="button" tabIndex={0} onClick={() => onSelect(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id); } }}>
            <div className="pd-tl-name" title={p.name}>{p.name}</div>
            <div className="pd-tl-track">
              <div className="pd-tl-line" />
              <div className="pd-tl-today" style={{ left: `${clamp(xPct(today))}%` }} />
              <div className="pd-tl-bar" style={{ left: `${left}%`, width: `${width}%`, background: c.bg, border: `1px solid ${c.fg}` }} />
              {deadlines.map((t) => (
                <div key={t.id} className="pd-tl-dot" title={`${t.title} · ${fmtDate(t.deadline)}`}
                  style={{
                    left: `${clamp(xPct(t.deadline))}%`,
                    background: t.done ? "var(--muted)" : (t.deadline < today ? "var(--danger)" : c.fg),
                    opacity: t.done ? 0.5 : 1,
                  }} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="pd-tl-legend">
        <span><i className="pd-tl-swatch" style={{ background: "var(--danger)" }} />overdue</span>
        <span><i className="pd-tl-swatch" style={{ background: "var(--muted)", opacity: .5 }} />done</span>
        <span><i className="pd-tl-swatch" style={{ background: "var(--accent)" }} />today line</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress ring                                                      */
/* ------------------------------------------------------------------ */
function Ring({ pct, color, size = 52 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const off = pct === null ? c : c - (pct / 100) * c;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} role="img"
      aria-label={pct === null ? "Not started" : `${pct} percent complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill={pct === null ? "var(--muted)" : "var(--ink)"}
        style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600 }}>
        {pct === null ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}

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
      <button type="button" className="b" onClick={() => cmd("bold")} title="Bold (⌘B)">B</button>
      <button type="button" className="i" onClick={() => cmd("italic")} title="Italic (⌘I)">I</button>
      <button type="button" className="u" onClick={() => cmd("underline")} title="Underline (⌘U)">U</button>
      <button type="button" className="s" onClick={() => cmd("strikeThrough")} title="Strikethrough">S</button>
      <div className="pd-aa-wrap" ref={wrapRef}>
        <button type="button" onClick={() => setAaOpen((o) => !o)} title="Text style" style={{ width: "auto", padding: "0 8px" }}>Aa</button>
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
      <button type="button" onClick={() => cmd("insertUnorderedList")} title="Bulleted list">•—</button>
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

function Bubble({ note, color, isMobile, onSave, onDelete, dragProps, touchReorderStart }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_H);
  const panelRef = useRef(null);
  const dragState = useRef(null);
  const prevFocus = useRef(null);
  const kb = useKeyboardInset();
  const isLong = htmlToPlain(note.text).length > 160 || /<img/i.test(note.text);

  useEffect(() => {
    if (panelOpen && panelRef.current) {
      prevFocus.current = document.activeElement;
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

  const close = () => {
    setPanelOpen(false); setFullscreen(false);
    if (prevFocus.current && prevFocus.current.focus) prevFocus.current.focus();
  };
  const commitPanel = () => {
    const raw = panelRef.current ? panelRef.current.innerHTML : note.text;
    const clean = sanitizeHtml(raw);
    if (htmlToPlain(clean).trim().length === 0 && !/<img/i.test(clean)) onDelete(); else onSave(clean);
    close();
  };
  const cancelPanel = () => close(); // Esc = discard changes

  const panelCmd = (name, val = null) => { document.execCommand(name, false, val); panelRef.current && panelRef.current.focus(); };

  const insertImagesIntoPanel = async (files) => {
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const dataUrl = await imageFileToDataURL(f);
        panelRef.current && panelRef.current.focus();
        document.execCommand("insertHTML", false, `<img src="${dataUrl}"><br>`);
      } catch (e) { /* unreadable image — skip */ }
    }
  };

  const handleBubbleDrop = async (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      e.preventDefault(); e.stopPropagation();
      let html = note.text;
      for (const f of files) {
        try { html += `<br><img src="${await imageFileToDataURL(f)}">`; } catch (err) { /* skip */ }
      }
      onSave(sanitizeHtml(html));
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
        draggable={!isMobile} onDragStart={dragProps?.onDragStart} onDragOver={dragProps?.onDragOver}
        onDrop={handleBubbleDrop} onDragEnd={dragProps?.onDragEnd}
        onClick={() => setPanelOpen(true)}>
        <span className="pd-drag-handle"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => { e.stopPropagation(); touchReorderStart?.(e, note.id, "note"); }}>⠿</span>
        <div className={`pd-bubble-content ${isLong ? "clamped" : ""}`} dangerouslySetInnerHTML={{ __html: note.text }} />
        <button className="pd-x" aria-label="Delete note" onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
      </div>

      {panelOpen && (
        <div className="pd-overlay" style={isMobile ? { paddingBottom: kb } : undefined}
          onMouseDown={(e) => { if (e.target === e.currentTarget) commitPanel(); }}>
          <div className={`pd-panel ${fullscreen ? "fullscreen" : ""}`} role="dialog" aria-modal="true" aria-label="Edit note"
            style={{
              ...(!fullscreen ? { height: panelHeight } : {}),
              ...(isMobile ? { maxHeight: `calc(100dvh - ${kb + 8}px)` } : {}),
            }}>
            <div className="pd-panel-header">
              <div className="pd-toolbar" onMouseDown={(e) => e.preventDefault()}>
                <ToolbarButtons cmd={panelCmd} />
              </div>
              <div className="pd-panel-actions">
                <button type="button" onClick={() => setFullscreen((f) => !f)}
                  title={fullscreen ? "Exit full screen" : "Full screen"}>{fullscreen ? "⤡" : "⤢"}</button>
                <button type="button" onClick={commitPanel} title="Save & close">✕</button>
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
              <div className="pd-resize-handle" onMouseDown={onResizeStart} onTouchStart={onResizeStart}>
                <span />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Task row with swipe gestures (mobile) + HTML5 drag (desktop)       */
/* ------------------------------------------------------------------ */
function TaskRow({ task, color, isMobile, completed, onToggle, onDelete, onTitle, onDeadline,
  dragHandlers, reorderUp, reorderDown, canUp, canDown, touchReorderStart, dragClass }) {
  const [dx, setDx] = useState(0);
  const [snap, setSnap] = useState(false);
  const start = useRef(null);
  const due = completed ? null : dueLabel(task.deadline);

  const onTouchStart = (e) => {
    if (!isMobile) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, mode: null };
    setSnap(false);
  };
  const onTouchMove = (e) => {
    if (!isMobile || !start.current) return;
    const t = e.touches[0];
    const ddx = t.clientX - start.current.x;
    const ddy = t.clientY - start.current.y;
    if (start.current.mode === null) {
      if (Math.abs(ddx) > Math.abs(ddy) + 6) start.current.mode = "swipe";
      else if (Math.abs(ddy) > 8) start.current.mode = "scroll";
    }
    if (start.current.mode === "swipe") setDx(Math.max(-130, Math.min(130, ddx)));
  };
  const onTouchEnd = () => {
    if (!isMobile || !start.current) return;
    const final = dx;
    start.current = null;
    setSnap(true);
    if (final >= 80) { setDx(0); onToggle(); }
    else if (final <= -80) { setDx(0); onDelete(); }
    else setDx(0);
  };

  return (
    <li className="pd-task-outer" data-rid={task.id} data-rkind="task">
      {isMobile && (
        <div className="pd-task-bg" aria-hidden="true">
          <span className="bg-done" style={{ opacity: Math.min(1, Math.max(0, dx / 80)) }}>✓</span>
          <span className="bg-del" style={{ opacity: Math.min(1, Math.max(0, -dx / 80)) }}>✕</span>
        </div>
      )}
      <div className={`pd-task ${completed ? "completed" : ""} ${snap ? "snapback" : ""} ${dragClass || ""}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        draggable={!isMobile && !completed}
        onDragStart={dragHandlers?.onDragStart} onDragOver={dragHandlers?.onDragOver}
        onDrop={dragHandlers?.onDrop} onDragEnd={dragHandlers?.onDragEnd}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {!completed ? (
          <>
            <span className="pd-drag-handle"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => { e.stopPropagation(); touchReorderStart?.(e, task.id, "task"); }}>⠿</span>
            <div className="pd-reorder">
              <button onClick={reorderUp} disabled={!canUp} aria-label="Move up">▲</button>
              <button onClick={reorderDown} disabled={!canDown} aria-label="Move down">▼</button>
            </div>
          </>
        ) : (
          <span className="pd-drag-handle" style={{ visibility: "hidden" }}>⠿</span>
        )}
        <button className={`pd-check pd-press ${task.done ? "done" : ""}`}
          style={task.done ? { background: color.fg, borderColor: color.fg } : {}}
          onClick={onToggle} aria-label={task.done ? "Mark as not done" : "Mark as done"}>
          <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2 6.5L4.8 9L10 3.5" fill="none" stroke="#14181E" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <input className={`pd-task-title ${task.done ? "done" : ""}`} value={task.title}
          onChange={(e) => onTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }} aria-label="Task title" />
        <div className="pd-task-meta">
          {due && <span className={`pd-task-due ${due.overdue ? "overdue" : ""}`}>{due.text}</span>}
          {!completed && <DatePicker value={task.deadline} onChange={onDeadline} />}
          <button className="pd-x" aria-label="Delete task" onClick={onDelete}>×</button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Main app                                                           */
/* ------------------------------------------------------------------ */
function ProjectDashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProj, setNewProj] = useState({ name: "", client: "", location: "", startDate: todayISO() });
  const [taskInput, setTaskInput] = useState("");
  const [noiseInput, setNoiseInput] = useState("");
  const [savedFlash, setSavedFlash] = useState("");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [importNote, setImportNote] = useState("");
  const [toast, setToast] = useState(null);
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [dragNoteId, setDragNoteId] = useState(null);
  const [dragOverNoteId, setDragOverNoteId] = useState(null);
  const [touchDragId, setTouchDragId] = useState(null);

  const isMobile = useIsMobile();

  // Lock zoom for a native-app feel. Note for accessibility: this removes the
  // user's ability to pinch-zoom text, which WCAG normally recommends against —
  // acceptable tradeoff here since every field already renders at 16px+.
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    const prev = meta ? meta.getAttribute("content") : null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
    return () => { if (prev !== null) meta.setAttribute("content", prev); };
  }, []);

  const kbInset = useKeyboardInset();
  const saveTimer = useRef(null);
  const flashTimer = useRef(null);
  const toastTimer = useRef(null);
  const importFileRef = useRef(null);
  const searchRef = useRef(null);
  const quickAddRef = useRef(null);
  const selectedIdRef = useRef(null);
  const touchDrag = useRef(null);
  selectedIdRef.current = selectedId;

  /* ---- load ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          const projs = (data.projects || []).map(migrate);
          setProjects(projs);
          if (data.lastSelectedId && projs.some((p) => p.id === data.lastSelectedId) && !window.matchMedia("(max-width: 860px)").matches) {
            setSelectedId(data.lastSelectedId);
          }
        }
      } catch (e) { /* first run */ }
      setLoaded(true);
    })();
  }, []);

  /* ---- debounced save (projects + last selected) ---- */
  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await storage.set(STORAGE_KEY, JSON.stringify({ projects: next, lastSelectedId: selectedIdRef.current }));
        setSavedFlash("saved");
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setSavedFlash(""), 1200);
      } catch (e) { setSavedFlash("save failed — will retry on next change"); }
    }, 500);
  }, []);

  const update = useCallback((fn) => {
    setProjects((prev) => { const next = fn(prev); persist(next); return next; });
  }, [persist]);

  // Persist selection changes too (so reload restores your place)
  useEffect(() => {
    if (loaded) update((prev) => prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ---- undo toast system ---- */
  const showUndo = useCallback((msg, undoFn) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undo: undoFn });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const runUndo = () => {
    clearTimeout(toastTimer.current);
    if (toast?.undo) toast.undo();
    setToast(null);
  };

  /* ---- derived ---- */
  const sorted = useMemo(() => [...projects].sort(attentionSort), [projects]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) =>
      [p.name, p.client, p.location, p.phase].some((s) => (s || "").toLowerCase().includes(q)) ||
      p.tasks.some((t) => t.title.toLowerCase().includes(q)) ||
      p.notes.some((n) => htmlToPlain(n.text).toLowerCase().includes(q))
    );
  }, [sorted, query]);
  const selected = projects.find((p) => p.id === selectedId) || null;
  const allTasks = projects.flatMap((p) => p.tasks);
  const overallPct = allTasks.length ? Math.round((allTasks.filter((t) => t.done).length / allTasks.length) * 100) : 0;

  /* ---- actions ---- */
  const addProject = () => {
    const name = newProj.name.trim();
    if (!name) return;
    const proj = {
      id: uid(), name, client: newProj.client.trim(), location: newProj.location.trim(), phase: "",
      startDate: newProj.startDate || todayISO(), notes: [], colorIdx: projects.length % PALETTE.length,
      tasks: [], createdAt: Date.now(),
    };
    update((prev) => [...prev, proj]);
    setSelectedId(proj.id); setAdding(false);
    setNewProj({ name: "", client: "", location: "", startDate: todayISO() });
  };

  const patchProject = (patch) => update((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
  const patchTasks = (fn) => update((prev) => prev.map((p) => (p.id === selected.id ? { ...p, tasks: fn(p.tasks) } : p)));

  const addTaskTitled = (title) => {
    const clean = title.trim();
    if (!clean || !selected) return false;
    patchTasks((ts) => [...ts, { id: uid(), title: clean, done: false, deadline: todayISO(), createdAt: Date.now() }]);
    return true;
  };
  const addNoiseText = (text) => {
    const clean = text.trim();
    if (!clean || !selected) return false;
    patchProject({ notes: [...selected.notes, { id: uid(), text: textToHtml(clean) }] });
    return true;
  };

  const deleteTaskWithUndo = (task) => {
    const projId = selected.id;
    const idx = selected.tasks.findIndex((t) => t.id === task.id);
    patchTasks((ts) => ts.filter((x) => x.id !== task.id));
    showUndo("Task deleted", () => update((prev) => prev.map((p) => {
      if (p.id !== projId) return p;
      const ts = [...p.tasks]; ts.splice(Math.min(idx, ts.length), 0, task);
      return { ...p, tasks: ts };
    })));
  };
  const deleteNoteWithUndo = (note) => {
    const projId = selected.id;
    const idx = selected.notes.findIndex((n) => n.id === note.id);
    patchProject({ notes: selected.notes.filter((x) => x.id !== note.id) });
    showUndo("Note deleted", () => update((prev) => prev.map((p) => {
      if (p.id !== projId) return p;
      const ns = [...p.notes]; ns.splice(Math.min(idx, ns.length), 0, note);
      return { ...p, notes: ns };
    })));
  };
  const deleteProjectWithUndo = () => {
    const proj = selected;
    const idx = projects.findIndex((p) => p.id === proj.id);
    update((prev) => prev.filter((p) => p.id !== proj.id));
    setSelectedId(null);
    showUndo(`Deleted "${proj.name}"`, () => update((prev) => {
      const ps = [...prev]; ps.splice(Math.min(idx, ps.length), 0, proj);
      return ps;
    }));
  };

  /* ---- export / import ---- */
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ projects }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `projects-export-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const openImportPicker = () => { setImportNote(""); importFileRef.current?.click(); };
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = (parsed.projects || []).map(migrate);
      if (!incoming.length) { setImportNote("That file has no projects in it."); return; }
      setPendingImport(incoming);
    } catch (err) {
      setImportNote("Couldn't read that file — make sure it's a projects-export .json file.");
    }
  };
  const confirmImport = () => {
    const n = pendingImport.length;
    update(() => pendingImport);
    setPendingImport(null);
    setImportNote(`Imported ${n} project${n !== 1 ? "s" : ""}.`);
    setTimeout(() => setImportNote(""), 3000);
  };

  /* ---- touch reorder (long list drag via handle, works on phones) ---- */
  const touchReorderStart = useCallback((e, id, kind) => {
    touchDrag.current = { id, kind };
    setTouchDragId(id);
    const move = (ev) => {
      if (!touchDrag.current) return;
      if (ev.cancelable) ev.preventDefault();
      const t = ev.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const target = el && el.closest(`[data-rkind="${touchDrag.current.kind}"]`);
      if (!target) return;
      const overId = target.getAttribute("data-rid");
      if (!overId || overId === touchDrag.current.id) return;
      const { id: dragId, kind: k } = touchDrag.current;
      if (k === "task") {
        update((prev) => prev.map((p) => p.id === selectedIdRef.current ? { ...p, tasks: moveItem(p.tasks, dragId, overId) } : p));
      } else {
        update((prev) => prev.map((p) => p.id === selectedIdRef.current ? { ...p, notes: moveItem(p.notes, dragId, overId) } : p));
      }
    };
    const end = () => {
      touchDrag.current = null;
      setTouchDragId(null);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
  }, [update]);

  /* ---- edge swipe back (mobile) — pane follows the finger, velocity decides ---- */
  const edge = useRef(null);
  const [edgeDx, setEdgeDx] = useState(0);
  const [edgeDrag, setEdgeDrag] = useState(false);
  const onDetailTouchStart = (e) => {
    if (!isMobile || !selectedIdRef.current) return;
    const t = e.touches[0];
    if (t.clientX < 36) edge.current = { x: t.clientX, y: t.clientY, t: Date.now(), active: null };
  };
  const onDetailTouchMove = (e) => {
    if (!edge.current) return;
    const t = e.touches[0];
    const dx = t.clientX - edge.current.x;
    const dy = t.clientY - edge.current.y;
    if (edge.current.active === null) {
      if (dx > 10 && Math.abs(dx) > Math.abs(dy)) { edge.current.active = true; setEdgeDrag(true); }
      else if (Math.abs(dy) > 10) edge.current.active = false;
    }
    if (edge.current.active) setEdgeDx(Math.max(0, dx));
  };
  const onDetailTouchEnd = () => {
    if (!edge.current) return;
    if (edge.current.active) {
      const dt = Math.max(1, Date.now() - edge.current.t);
      const velocity = edgeDx / dt; // px per ms
      const w = window.innerWidth;
      setEdgeDrag(false);
      if (edgeDx > w * 0.3 || (edgeDx > 50 && velocity > 0.45)) { setEdgeDx(0); setSelectedId(null); }
      else setEdgeDx(0);
    }
    edge.current = null;
  };

  /* ---- keyboard shortcuts (desktop) ---- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && selectedIdRef.current) { e.preventDefault(); quickAddRef.current?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = filtered;
        if (!list.length) return;
        const idx = list.findIndex((p) => p.id === selectedIdRef.current);
        const nextIdx = e.key === "ArrowDown" ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
        setSelectedId(list[idx === -1 ? 0 : nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered]);

  /* ---- render ---- */
  if (!loaded) {
    return (
      <div className="pd-app"><style>{css}</style>
        <div className="pd-topbar"><div className="pd-title">Projects<span>.</span></div></div>
        <div className="pd-skel">
          <div className="pd-skel-row" /><div className="pd-skel-row" /><div className="pd-skel-row" style={{ animationDelay: ".15s" }} />
        </div>
      </div>
    );
  }

  const selColor = selected ? colorOf(selected) : null;
  const selPct = selected ? progressOf(selected) : null;
  const doneCount = selected ? selected.tasks.filter((t) => t.done).length : 0;
  const activeTasks = selected ? selected.tasks.filter((t) => !t.done) : [];
  const completedTasks = selected ? selected.tasks.filter((t) => t.done) : [];

  return (
    <div className={`pd-app ${selected ? "detail-open" : ""}`}>
      <style>{css}</style>

      <div className="pd-topbar">
        <div className="pd-title">Projects<span>.</span></div>
        <div className="pd-overall">
          <div className="pd-overall-bar"><div className="pd-overall-fill" style={{ width: `${overallPct}%` }} /></div>
          <span className="pd-overall-label">
            {allTasks.length ? `${overallPct}% overall · ${projects.length} project${projects.length !== 1 ? "s" : ""}` : "no tasks yet"}
          </span>
        </div>
      </div>

      <div className="pd-body">
        {/* left: dashboard */}
        <div className="pd-left">
          <input ref={searchRef} className="pd-search" enterKeyHint="search" placeholder="Search projects, tasks, notes…  ( / )"
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); e.target.blur(); } }} />

          <div className="pd-viewtoggle">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>list</button>
            <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>timeline</button>
          </div>

          <div className="pd-datarow">
            <button className="pd-data-btn" onClick={exportData}>Export data</button>
            <button className="pd-data-btn" onClick={openImportPicker}>Import data</button>
            <input ref={importFileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onImportFile} />
          </div>
          {importNote && <div className={`pd-import-note ${pendingImport ? "" : "err"}`}>{importNote}</div>}
          {pendingImport && (
            <div className="pd-import-banner">
              <p>Import {pendingImport.length} project{pendingImport.length !== 1 ? "s" : ""}? This replaces everything currently in this app.</p>
              <div className="pd-form-row">
                <button className="pd-btn" onClick={confirmImport}>Replace with imported data</button>
                <button className="pd-btn ghost" onClick={() => setPendingImport(null)}>Cancel</button>
              </div>
            </div>
          )}

          {adding ? (
            <div className="pd-form">
              <input type="text" placeholder="Project name" value={newProj.name} autoFocus enterKeyHint="next"
                onChange={(e) => setNewProj({ ...newProj, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); if (e.key === "Escape") setAdding(false); }} />
              <input type="text" placeholder="Client name" value={newProj.client} enterKeyHint="next"
                onChange={(e) => setNewProj({ ...newProj, client: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} />
              <input type="text" placeholder="Location" value={newProj.location} enterKeyHint="done"
                onChange={(e) => setNewProj({ ...newProj, location: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} />
              <div className="pd-form-label">Start date</div>
              <div className="pd-form-row">
                <DatePicker value={newProj.startDate} onChange={(iso) => setNewProj({ ...newProj, startDate: iso || todayISO() })} />
                <button className="pd-btn pd-press" onClick={addProject}>Create</button>
                <button className="pd-btn ghost pd-press" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="pd-addproj pd-press" onClick={() => setAdding(true)}>+ New project</button>
          )}

          {sorted.length === 0 && !adding && <p className="pd-empty">No projects yet. Create your first one to start tracking progress.</p>}
          {sorted.length > 0 && filtered.length === 0 && <p className="pd-empty">No matches for "{query}".</p>}

          {view === "timeline" ? (
            <Timeline projects={filtered} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            filtered.map((p) => {
              const pct = progressOf(p), c = colorOf(p), due = dueLabel(nextDue(p));
              const clientLoc = [p.client, p.location].filter(Boolean).join(" · ");
              return (
                <div key={p.id} role="button" tabIndex={0}
                  className={`pd-card ${p.id === selectedId ? "selected" : ""}`}
                  style={{ background: c.bg, "--pfg": c.fg }}
                  onClick={() => setSelectedId(p.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(p.id); } }}>
                  <Ring pct={pct} color={c.fg} />
                  <div className="pd-card-info">
                    <div className="pd-card-name">{p.name}</div>
                    {clientLoc && <div className="pd-card-client">{clientLoc}</div>}
                    <div className="pd-card-meta">
                      {pct === null ? "not started" : `${p.tasks.filter((t) => t.done).length}/${p.tasks.length} tasks`}
                      {due && <> · <span className={due.overdue ? "overdue" : ""}>next due {due.text}</span></>}
                      {!due && startedLabel(p.startDate) && <> · {startedLabel(p.startDate)}</>}
                    </div>
                    {p.phase && <span className="pd-phase">{p.phase}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* right: detail */}
        <div className={`pd-right ${edgeDrag ? "edge-dragging" : ""}`}
          style={edgeDx > 0 ? { transform: `translateX(${edgeDx}px)` } : undefined}
          onTouchStart={onDetailTouchStart} onTouchMove={onDetailTouchMove} onTouchEnd={onDetailTouchEnd}>
          {!selected ? (
            <p className="pd-empty">Select a project to see its tasks and brain noises.</p>
          ) : (
            <>
              <button className="pd-back pd-press" onClick={() => setSelectedId(null)}>← all projects</button>

              <div className="pd-detail-head">
                <div style={{ flex: 1, minWidth: 240 }}>
                  <input className="pd-proj-name" value={selected.name}
                    onChange={(e) => patchProject({ name: e.target.value })} aria-label="Project name" />
                  <div className="pd-meta-grid">
                    <div className="pd-field">
                      <label>Client</label>
                      <input type="text" value={selected.client} placeholder="—" onChange={(e) => patchProject({ client: e.target.value })} />
                    </div>
                    <div className="pd-field">
                      <label>Location</label>
                      <input type="text" value={selected.location} placeholder="—" onChange={(e) => patchProject({ location: e.target.value })} />
                    </div>
                    <div className="pd-field">
                      <label>Phase</label>
                      <PhaseCombo value={selected.phase || ""}
                        onChange={(v) => patchProject({ phase: v })}
                        suggestions={[...new Set(projects.map((p) => p.phase).filter(Boolean))]} />
                    </div>
                    <div className="pd-field">
                      <label>Started</label>
                      <DatePicker value={selected.startDate} onChange={(iso) => patchProject({ startDate: iso || todayISO() })} />
                    </div>
                  </div>
                </div>
                <button className="pd-danger-btn pd-press" onClick={deleteProjectWithUndo}>delete project</button>
              </div>

              <div style={{ marginTop: 14 }} className="pd-overall-label">
                {selPct === null ? "not started" : `${doneCount}/${selected.tasks.length} tasks · ${selPct}%`}
                {startedLabel(selected.startDate) && <> · {startedLabel(selected.startDate)}</>}
              </div>
              <div className="pd-progressbar"><div className="pd-progressfill" style={{ width: `${selPct ?? 0}%`, background: selColor.fg }} /></div>

              <div className="pd-inputrow pd-quickadd-row">
                <input ref={quickAddRef} className="pd-quickadd" style={{ marginTop: 0 }} enterKeyHint="send"
                  placeholder="Add a task and press Enter…  ( n )"
                  value={taskInput} onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && addTaskTitled(taskInput)) setTaskInput(""); }} />
                <button className="pd-send" aria-label="Add task" disabled={!taskInput.trim()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { if (addTaskTitled(taskInput)) setTaskInput(""); }}>↑</button>
              </div>

              {selected.tasks.length === 0 ? (
                <p className="pd-empty">Add your first task above — progress starts counting from there.</p>
              ) : (
                <ul className="pd-tasklist">
                  {activeTasks.map((t) => (
                    <TaskRow key={t.id} task={t} color={selColor} isMobile={isMobile} completed={false}
                      onToggle={() => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))}
                      onDelete={() => deleteTaskWithUndo(t)}
                      onTitle={(title) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, title } : x))}
                      onDeadline={(iso) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, deadline: iso } : x))}
                      reorderUp={() => patchTasks((ts) => moveBy(ts, t.id, -1))}
                      reorderDown={() => patchTasks((ts) => moveBy(ts, t.id, 1))}
                      canUp={activeTasks[0]?.id !== t.id}
                      canDown={activeTasks[activeTasks.length - 1]?.id !== t.id}
                      touchReorderStart={touchReorderStart}
                      dragClass={`${dragTaskId === t.id || touchDragId === t.id ? "dragging" : ""} ${dragOverTaskId === t.id ? "drag-over" : ""}`}
                      dragHandlers={{
                        onDragStart: () => setDragTaskId(t.id),
                        onDragOver: (e) => { e.preventDefault(); setDragOverTaskId(t.id); },
                        onDrop: (e) => { e.preventDefault(); if (dragTaskId) patchTasks((ts) => moveItem(ts, dragTaskId, t.id)); setDragTaskId(null); setDragOverTaskId(null); },
                        onDragEnd: () => { setDragTaskId(null); setDragOverTaskId(null); },
                      }} />
                  ))}

                  {completedTasks.length > 0 && <li className="pd-tasksep">Completed</li>}
                  {completedTasks.map((t) => (
                    <TaskRow key={t.id} task={t} color={selColor} isMobile={isMobile} completed={true}
                      onToggle={() => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))}
                      onDelete={() => deleteTaskWithUndo(t)}
                      onTitle={(title) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, title } : x))}
                      onDeadline={() => {}} />
                  ))}
                </ul>
              )}

              <div className="pd-section-label">Brain Noises</div>
              <div className="pd-inputrow">
                <input className="pd-noise-input" style={{ flex: 1 }} enterKeyHint="send"
                  placeholder="Drop a thought and press Enter…"
                  value={noiseInput} onChange={(e) => setNoiseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && addNoiseText(noiseInput)) setNoiseInput(""); }} />
                <button className="pd-send" aria-label="Add thought" disabled={!noiseInput.trim()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { if (addNoiseText(noiseInput)) setNoiseInput(""); }}>↑</button>
              </div>
              {selected.notes.length === 0 ? (
                <p className="pd-empty">Empty head. Add thoughts, doubts, ideas — one bubble each.</p>
              ) : (
                <div className="pd-bubbles">
                  {selected.notes.map((n) => (
                    <Bubble key={n.id} note={n} color={selColor} isMobile={isMobile}
                      onSave={(text) => patchProject({ notes: selected.notes.map((x) => (x.id === n.id ? { ...x, text } : x)) })}
                      onDelete={() => deleteNoteWithUndo(n)}
                      touchReorderStart={touchReorderStart}
                      dragProps={{
                        className: `${dragNoteId === n.id || touchDragId === n.id ? "dragging" : ""} ${dragOverNoteId === n.id ? "drag-over" : ""}`,
                        onDragStart: () => setDragNoteId(n.id),
                        onDragOver: (e) => { e.preventDefault(); setDragOverNoteId(n.id); },
                        onDrop: (e) => { e.preventDefault(); if (dragNoteId) patchProject({ notes: moveItem(selected.notes, dragNoteId, n.id) }); setDragNoteId(null); setDragOverNoteId(null); },
                        onDragEnd: () => { setDragNoteId(null); setDragOverNoteId(null); },
                      }} />
                  ))}
                </div>
              )}
              <div className="pd-saved">{savedFlash}</div>
              <div style={{ height: isMobile ? 24 : 0 }} />
            </>
          )}
        </div>
      </div>

      {/* undo toast */}
      {toast && (
        <div className="pd-toast" role="status"
          style={{ bottom: `calc(${kbInset + 24}px + max(0px, env(safe-area-inset-bottom)))` }}>
          <span>{toast.msg}</span>
          <button onClick={runUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login gate — email code typed in-app                                */
/* ------------------------------------------------------------------ */
const gateCss = `
.pd-gate{
  position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
  background:#14181E; color:#E8ECF1; font-family:'Inter',system-ui,sans-serif; padding:24px;
  padding-top:max(24px, env(safe-area-inset-top)); -webkit-tap-highlight-color:transparent;
}
.pd-gate-card{width:100%; max-width:340px; text-align:center;}
.pd-gate-title{font-family:'Archivo',sans-serif; font-weight:800; font-size:22px; margin-bottom:6px;}
.pd-gate-title span{color:#E9B44C;}
.pd-gate-sub{color:#8C96A3; font-size:13px; margin-bottom:22px;}
.pd-gate-input{
  width:100%; padding:11px 14px; font-size:16px; border:1px solid #2C343E; border-radius:10px;
  background:#212933; color:#E8ECF1; margin-bottom:10px;
}
.pd-gate-input:focus{outline:none; border-color:#E9B44C;}
.pd-gate-btn{
  width:100%; border:none; background:#E9B44C; color:#1A1300; border-radius:10px; padding:12px 14px;
  font-size:14px; font-weight:600; cursor:pointer;
}
.pd-gate-btn:active{transform:scale(.98);}
.pd-gate-btn:disabled{opacity:.6; cursor:default;}
.pd-gate-msg{font-size:12px; color:#8C96A3; margin-top:14px; font-family:'IBM Plex Mono',monospace;}
.pd-gate-msg.err{color:#E06A87;}
.pd-gate-link{background:none; border:none; color:#E9B44C; cursor:pointer; font-family:inherit; font-size:inherit; text-decoration:underline; padding:0;}
.pd-gate-link:disabled{opacity:.5; cursor:default;}
`;

function LoginGate() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    if (!email.trim()) return;
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };

  const verifyCode = async () => {
    if (!code.trim()) return;
    setBusy(true); setError("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setError(error.message);
  };

  return (
    <div className="pd-gate">
      <style>{gateCss}</style>
      <div className="pd-gate-card">
        <div className="pd-gate-title">Projects<span>.</span></div>
        <div className="pd-gate-sub">
          {sent
            ? "Enter the code from your email — right here in this window."
            : "Sign in with your email — no password needed."}
        </div>
        {!sent ? (
          <>
            <input className="pd-gate-input" type="email" enterKeyHint="send" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendCode(); }} />
            <button className="pd-gate-btn" onClick={sendCode} disabled={busy}>
              {busy ? "Sending…" : "Send sign-in code"}
            </button>
          </>
        ) : (
          <>
            <input className="pd-gate-input" type="text" inputMode="numeric" enterKeyHint="done" placeholder="123456" value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") verifyCode(); }} />
            <button className="pd-gate-btn" onClick={verifyCode} disabled={busy || code.trim().length < 4}>
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
          </>
        )}
        {error && <div className="pd-gate-msg err">{error}</div>}
        {sent && <div className="pd-gate-msg">Didn't get it? <button className="pd-gate-link" onClick={sendCode} disabled={busy}>Send a new code</button></div>}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="pd-gate"><style>{gateCss}</style></div>;
  }
  if (!session) return <LoginGate />;
  return <ProjectDashboard />;
}
