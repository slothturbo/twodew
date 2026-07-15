import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { storage } from "./lib/storage";
import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  v4 — themed date picker, rich brain-noise bubbles, reorderable     */
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
  --line:#2C343E; --accent:#E9B44C; --accent-ink:#1A1300; --danger:#E06A87;
  color-scheme: dark;
}
*{box-sizing:border-box; margin:0; padding:0;}
.pd-app{
  font-family:'Inter',system-ui,sans-serif; color:var(--ink);
  background:var(--bg); min-height:100vh; display:flex; flex-direction:column;
}
::selection{background:var(--accent); color:var(--accent-ink);}
::placeholder{color:var(--muted); opacity:.7;}

.pd-topbar{
  padding:20px 24px 16px; border-bottom:1px solid var(--line);
  display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap;
}
.pd-title{font-family:'Archivo',sans-serif; font-weight:800; font-size:22px; letter-spacing:-0.02em;}
.pd-title span{color:var(--accent);}
.pd-overall{display:flex; align-items:center; gap:12px; min-width:220px; flex:1; max-width:420px;}
.pd-overall-bar{flex:1; height:6px; background:var(--raised); border-radius:3px; overflow:hidden;}
.pd-overall-fill{height:100%; background:var(--accent); border-radius:3px; transition:width .6s ease;}
.pd-overall-label{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted); white-space:nowrap;}

.pd-body{flex:1; display:flex; min-height:0;}
.pd-left{width:380px; min-width:320px; border-right:1px solid var(--line); overflow-y:auto; padding:16px;}
.pd-right{flex:1; overflow-y:auto; padding:24px; background:var(--card);}

/* ---- project cards ---- */
.pd-card{
  border:1px solid var(--line); border-radius:12px;
  padding:14px; display:flex; gap:14px; align-items:center; cursor:pointer;
  margin-bottom:10px; transition:border-color .15s ease;
}
.pd-card:hover{border-color:var(--pfg);}
.pd-card.selected{border-color:var(--pfg); box-shadow:0 0 0 1px var(--pfg);}
.pd-card:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}
.pd-card-info{flex:1; min-width:0;}
.pd-card-name{font-weight:600; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pd-card-client{font-size:12px; color:var(--muted); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pd-card-meta{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); margin-top:4px;}
.overdue{color:var(--danger) !important; font-weight:600;}

.pd-addproj{
  width:100%; border:1px dashed var(--line); background:transparent; border-radius:12px;
  padding:12px; font-size:14px; color:var(--muted); cursor:pointer;
  font-family:'Inter',sans-serif; transition:border-color .15s ease,color .15s ease;
}
.pd-addproj:hover{border-color:var(--accent); color:var(--accent);}

/* ---- detail ---- */
.pd-back{display:none; background:none; border:none; color:var(--muted); font-size:13px; cursor:pointer; margin-bottom:12px; font-family:'IBM Plex Mono',monospace;}
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
  border:1px solid var(--line); border-radius:6px; padding:5px 9px; background:var(--raised);
  cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap;
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
  background:none; border:1px solid var(--line); border-radius:6px; width:26px; height:26px;
  color:var(--ink); cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.pd-dp-nav button:hover{border-color:var(--accent); color:var(--accent);}
.pd-dp-grid{display:grid; grid-template-columns:repeat(7,1fr); gap:2px; text-align:center;}
.pd-dp-dow{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); padding:4px 0;}
.pd-dp-cell{
  font-family:'IBM Plex Mono',monospace; font-size:12px; padding:6px 0; border-radius:6px;
  cursor:pointer; background:none; border:none; color:var(--ink);
}
.pd-dp-cell:hover{background:rgba(233,180,76,0.15);}
.pd-dp-cell.muted{color:var(--muted); opacity:.5;}
.pd-dp-cell.today{box-shadow:inset 0 0 0 1px var(--accent);}
.pd-dp-cell.selected{background:var(--accent); color:var(--accent-ink); font-weight:600;}
.pd-dp-foot{display:flex; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--line);}
.pd-dp-link{background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer; font-family:'Inter',sans-serif;}
.pd-dp-link:hover{text-decoration:underline;}

/* ---- reorder controls ---- */
.pd-reorder{display:flex; flex-direction:column; gap:0; flex-shrink:0;}
.pd-reorder button{
  background:none; border:none; color:var(--muted); cursor:pointer; padding:0; width:16px; height:12px;
  display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .15s ease;
}
.pd-reorder button:hover{color:var(--accent);}
.pd-reorder button:disabled{opacity:0 !important; cursor:default;}
.pd-drag-handle{cursor:grab; color:var(--muted); opacity:0; transition:opacity .15s ease; flex-shrink:0; touch-action:none;}
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
.pd-task{
  display:flex; align-items:center; gap:8px; padding:10px 6px;
  border-bottom:1px solid var(--line); animation:pd-in .2s ease; flex-wrap:wrap;
  transition:opacity .15s ease, border-top-color .1s ease; border-top:2px solid transparent;
}
.pd-task:hover .pd-x, .pd-task:hover .pd-reorder button, .pd-task:hover .pd-drag-handle{opacity:1;}
.pd-task.dragging{opacity:.35;}
.pd-task.drag-over{border-top-color:var(--accent);}
.pd-task.completed{opacity:.55;}
@keyframes pd-in{from{opacity:0; transform:translateY(3px);} to{opacity:1; transform:none;}}
.pd-check{
  width:20px; height:20px; border-radius:6px; border:2px solid var(--line); background:transparent;
  cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  transition:background .15s ease,border-color .15s ease; padding:0;
}
.pd-check svg{opacity:0; transition:opacity .15s ease;}
.pd-check.done svg{opacity:1;}
.pd-task-title{flex:1; min-width:120px; font-size:15px; border:none; background:transparent; color:var(--ink); font-family:'Inter',sans-serif;}
.pd-task-title:focus{outline:none;}
.pd-task-title.done{color:var(--muted); text-decoration:line-through;}
.pd-task-due{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); white-space:nowrap;}
.pd-x{
  background:none; border:none; color:var(--muted); cursor:pointer; font-size:16px;
  opacity:0; transition:opacity .15s ease; padding:2px 6px;
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
  cursor:pointer; animation:pd-in .2s ease; transition:border-color .15s ease, opacity .15s ease;
}
.pd-bubble:hover{border-color:var(--pfg);}
.pd-bubble:hover .pd-x, .pd-bubble:hover .pd-drag-handle{opacity:1;}
.pd-bubble.editing{grid-column:1 / -1; cursor:text; padding-left:14px;}
.pd-bubble.dragging{opacity:.35;}
.pd-bubble.drag-over{border-top:2px solid var(--accent);}
.pd-bubble-content{white-space:pre-wrap; overflow:hidden; max-height:4.6em;}
.pd-bubble-content.clamped{display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;}
.pd-bubble-content h3{font-family:'Archivo',sans-serif; font-size:15px; margin-bottom:2px;}
.pd-bubble-content ul{padding-left:18px; margin:4px 0;}
.pd-bubble-content b, .pd-bubble-content strong{font-weight:700;}
.pd-bubble-more{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); margin-top:6px;}
.pd-bubble .pd-x{position:absolute; top:6px; right:6px;}
.pd-bubble .pd-drag-handle{position:absolute; top:8px; left:6px;}
.pd-bubble-edit{
  width:100%; min-height:1.5em; font-size:13.5px; font-family:'Inter',sans-serif;
  color:var(--ink); line-height:1.5;
}
.pd-bubble-edit:focus{outline:none;}
.pd-bubble-edit h3{font-family:'Archivo',sans-serif; font-size:15px; margin-bottom:2px;}
.pd-bubble-edit ul{padding-left:18px; margin:4px 0;}
.pd-toolbar{
  display:flex; gap:2px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--line);
}
.pd-toolbar button{
  width:26px; height:26px; border-radius:6px; border:1px solid transparent; background:none;
  color:var(--ink); cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center;
}
.pd-toolbar button:hover{background:rgba(233,180,76,0.15); border-color:var(--accent);}
.pd-toolbar .b{font-weight:700;} .pd-toolbar .i{font-style:italic;} .pd-toolbar .u{text-decoration:underline;} .pd-toolbar .s{text-decoration:line-through;}

/* ---- text style (Aa) menu ---- */
.pd-aa-wrap{position:relative;}
.pd-aa-menu{
  position:absolute; top:calc(100% + 6px); left:0; z-index:60; min-width:170px;
  background:var(--raised); border:1px solid var(--line); border-radius:10px; padding:6px;
  box-shadow:0 12px 32px rgba(0,0,0,0.45); animation:pd-pop .12s ease;
}
.pd-aa-menu button{
  display:block; width:100%; text-align:left; background:none; border:none; color:var(--ink);
  padding:7px 10px; border-radius:6px; cursor:pointer; font-family:'Inter',sans-serif;
}
.pd-aa-menu button:hover{background:rgba(233,180,76,0.15);}
.pd-aa-title{font-family:'Archivo',sans-serif; font-weight:800; font-size:17px;}
.pd-aa-heading{font-family:'Archivo',sans-serif; font-weight:700; font-size:15px;}
.pd-aa-sub{font-family:'Archivo',sans-serif; font-weight:600; font-size:13px;}
.pd-aa-body{font-size:13px;}
.pd-aa-mono{font-family:'IBM Plex Mono',monospace; font-size:12px;}

/* heading/mono rendering inside notes */
.pd-panel-edit h2{font-family:'Archivo',sans-serif; font-size:23px; font-weight:800; margin:6px 0 2px;}
.pd-panel-edit h3{font-family:'Archivo',sans-serif; font-size:19px; margin:4px 0;}
.pd-panel-edit h4{font-family:'Archivo',sans-serif; font-size:16px; font-weight:600; margin:4px 0 2px; color:var(--muted);}
.pd-panel-edit pre{
  font-family:'IBM Plex Mono',monospace; font-size:13px; white-space:pre-wrap;
  background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 10px; margin:6px 0;
}
.pd-bubble-content h2{font-family:'Archivo',sans-serif; font-size:16px; font-weight:800; margin-bottom:2px;}
.pd-bubble-content h4{font-family:'Archivo',sans-serif; font-size:13.5px; font-weight:600; color:var(--muted);}
.pd-bubble-content pre{
  font-family:'IBM Plex Mono',monospace; font-size:12px; white-space:pre-wrap;
  background:rgba(255,255,255,0.05); border-radius:6px; padding:4px 8px; margin:3px 0;
}

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
  padding:6px 9px; border-radius:6px; cursor:pointer; font-size:13px; font-family:'Inter',sans-serif; white-space:nowrap;
}
.pd-combo-pop button:hover{background:rgba(233,180,76,0.15);}
.pd-edit-hint{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); margin-top:8px;}
.pd-expand-btn{
  position:absolute; top:6px; right:30px; background:none; border:none; color:var(--muted);
  cursor:pointer; font-size:13px; opacity:0; transition:opacity .15s ease; padding:2px 4px;
}
.pd-bubble:hover .pd-expand-btn, .pd-expand-btn:focus-visible{opacity:1;}
.pd-bubble-more{cursor:pointer; background:none; border:none; font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); margin-top:6px; padding:0;}
.pd-bubble-more:hover{color:var(--accent);}

/* ---- expand / full screen panel ---- */
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
.pd-panel.fullscreen{width:94vw; height:92vh !important; max-height:92vh;}
.pd-panel-header{
  display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  padding:12px 14px; border-bottom:1px solid var(--line); flex-shrink:0; background:var(--raised); z-index:2;
}
.pd-panel-actions{display:flex; gap:4px; flex-shrink:0;}
.pd-panel-actions button{
  width:28px; height:28px; border-radius:7px; border:1px solid var(--line); background:none;
  color:var(--ink); cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center;
}
.pd-panel-actions button:hover{border-color:var(--accent); color:var(--accent);}
.pd-panel-body{flex:1; overflow-y:auto; padding:16px 18px;}
.pd-panel-edit{
  font-size:15px; font-family:'Inter',sans-serif; color:var(--ink); line-height:1.65; min-height:100%;
}
.pd-panel-edit:focus{outline:none;}
.pd-panel-edit h3{font-family:'Archivo',sans-serif; font-size:19px; margin:4px 0;}
.pd-panel-edit ul{padding-left:20px; margin:6px 0;}
.pd-panel-edit b, .pd-panel-edit strong{font-weight:700;}
.pd-resize-handle{
  flex-shrink:0; height:16px; display:flex; align-items:center; justify-content:center;
  cursor:ns-resize; touch-action:none; border-top:1px solid var(--line);
}
.pd-resize-handle span{width:36px; height:4px; border-radius:2px; background:var(--line);}
.pd-resize-handle:hover span{background:var(--accent);}

/* ---- images in notes ---- */
.pd-bubble-content img, .pd-panel-edit img{
  max-width:100%; border-radius:8px; display:block; margin:6px 0; border:1px solid var(--line);
}
.pd-bubble-content.clamped img{max-height:80px; width:auto;}

/* ---- phase tag ---- */
.pd-phase{
  font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.06em; text-transform:uppercase;
  border:1px solid var(--pfg); color:var(--pfg); border-radius:999px; padding:1px 7px;
  display:inline-block; margin-top:5px;
}
.pd-field select{
  font-size:13px; font-family:'Inter',sans-serif; color:var(--ink);
  border:1px solid var(--line); border-radius:6px; padding:5px 9px; background:var(--raised); min-width:130px;
}
.pd-field select:focus{outline:none; border-color:var(--accent);}

/* ---- view toggle ---- */
.pd-viewtoggle{display:flex; gap:0; margin-bottom:12px; border:1px solid var(--line); border-radius:8px; overflow:hidden; width:fit-content;}
.pd-viewtoggle button{
  background:none; border:none; color:var(--muted); cursor:pointer; padding:6px 14px;
  font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.05em;
}
.pd-viewtoggle button.active{background:var(--raised); color:var(--accent);}

/* ---- timeline (Gantt) ---- */
.pd-tl{margin-top:4px;}
.pd-tl-axis{
  display:flex; justify-content:space-between; margin-left:118px; margin-bottom:6px;
  font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted);
}
.pd-tl-row{display:flex; align-items:center; gap:8px; padding:8px 4px; cursor:pointer; border-radius:8px;}
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
.pd-saved{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); margin-top:6px; min-height:14px;}

.pd-empty{color:var(--muted); font-size:14px; margin-top:18px;}
.pd-danger-btn{
  background:none; border:1px solid var(--line); color:var(--muted); border-radius:8px;
  padding:6px 12px; font-size:12px; cursor:pointer; font-family:'IBM Plex Mono',monospace;
}
.pd-danger-btn:hover{border-color:var(--danger); color:var(--danger);}
.pd-danger-btn.arm{border-color:var(--danger); color:#fff; background:var(--danger);}
.pd-loading{padding:40px; color:var(--muted); font-family:'IBM Plex Mono',monospace; font-size:13px;}

.pd-form{background:var(--card); border:1px solid var(--accent); border-radius:12px; padding:14px; margin-bottom:10px;}
.pd-form input[type=text]{
  width:100%; padding:9px 11px; font-size:14px; border:1px solid var(--line); border-radius:8px;
  font-family:'Inter',sans-serif; margin-bottom:8px; background:var(--raised); color:var(--ink);
}
.pd-form input[type=text]:focus{outline:none; border-color:var(--accent);}
.pd-form-row{display:flex; gap:8px; align-items:center; flex-wrap:wrap;}
.pd-form-label{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:4px;}
.pd-btn{
  border:none; background:var(--accent); color:var(--accent-ink); border-radius:8px; padding:8px 14px;
  font-size:13px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;
}
.pd-btn.ghost{background:transparent; color:var(--muted); border:1px solid var(--line);}

@media (max-width: 860px){
  .pd-left{width:100%; min-width:0; border-right:none;}
  .pd-app.detail-open .pd-left{display:none;}
  .pd-app:not(.detail-open) .pd-right{display:none;}
  .pd-back{display:inline-block;}
  .pd-reorder button, .pd-drag-handle{opacity:1;}
  .pd-x{opacity:1;}
}
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

// Downscale dropped images so notes stay within storage limits
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
      if (out.length > 1_800_000) out = render(600, 0.68); // very large photo — shrink harder
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
function htmlToPlainLen(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || "").length;
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
/*  Custom themed date picker                                          */
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

  // Position the popover from the button's real screen location, clamped inside the viewport
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
      <button type="button" ref={btnRef} className={`pd-dp-btn ${!value ? "empty" : ""}`} onClick={() => setOpen((o) => !o)}>
        📅 {value ? fmtDate(value) : placeholder}
      </button>
      {open && (
        <div className="pd-dp-pop" ref={popRef}
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
/*  Rich-text bubble — macOS-Notes-style formatting, uniform collapsed  */
/* ------------------------------------------------------------------ */
const PANEL_MIN_H = 240;
const DEFAULT_PANEL_H = 380;

// Paste as plain text, but keep line breaks — never inherit source formatting/fonts.
function handlePlainPaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertHTML", false, escapeHtml(text).replace(/\n/g, "<br>"));
}

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

function Bubble({ note, color, onSave, onDelete, dragProps }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_H);
  const panelRef = useRef(null);
  const dragState = useRef(null);
  const isLong = htmlToPlainLen(note.text) > 160 || /<img/i.test(note.text);

  useEffect(() => {
    if (panelOpen && panelRef.current) {
      panelRef.current.innerHTML = note.text;
      panelRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(panelRef.current); range.collapse(false);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  const commitPanel = () => {
    const raw = panelRef.current ? panelRef.current.innerHTML : note.text;
    const clean = sanitizeHtml(raw);
    if (htmlToPlainLen(clean) === 0 && !/<img/i.test(clean)) onDelete(); else onSave(clean);
    setPanelOpen(false); setFullscreen(false);
  };

  const panelCmd = (name, val = null) => { document.execCommand(name, false, val); panelRef.current && panelRef.current.focus(); };

  // Insert dropped image files into the open panel editor at the caret
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

  // Dropping an image straight onto a collapsed bubble appends it to the note
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

  const onResizeStart = (e) => {
    e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = { startY: y, startHeight: panelHeight };
    const move = (ev) => {
      if (!dragState.current) return;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const delta = cy - dragState.current.startY;
      const max = Math.round(window.innerHeight * 0.85);
      setPanelHeight(Math.min(Math.max(dragState.current.startHeight + delta, PANEL_MIN_H), max));
      if (ev.cancelable) ev.preventDefault();
    };
    const up = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
  };

  const panelKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); commitPanel(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); panelCmd("bold"); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); panelCmd("italic"); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") { e.preventDefault(); panelCmd("underline"); }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); commitPanel(); }
  };

  return (
    <>
      <div className={`pd-bubble ${dragProps?.className || ""}`}
        style={{ background: color.bg, borderLeft: `3px solid ${color.fg}`, "--pfg": color.fg }}
        draggable onDragStart={dragProps?.onDragStart} onDragOver={dragProps?.onDragOver}
        onDrop={handleBubbleDrop} onDragEnd={dragProps?.onDragEnd}
        onClick={() => setPanelOpen(true)}>
        <span className="pd-drag-handle" onMouseDown={(e) => e.stopPropagation()}>⠿</span>
        <div className={`pd-bubble-content ${isLong ? "clamped" : ""}`} dangerouslySetInnerHTML={{ __html: note.text }} />
        <button className="pd-x" aria-label="Delete note" onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
      </div>

      {panelOpen && (
        <div className="pd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) commitPanel(); }}>
          <div className={`pd-panel ${fullscreen ? "fullscreen" : ""}`}
            style={!fullscreen ? { height: panelHeight } : undefined}>
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
/*  Phase combobox — type freely or pick from presets + already used   */
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
/*  Timeline — simple horizontal Gantt from startDate → task deadlines */
/* ------------------------------------------------------------------ */
function Timeline({ projects, selectedId, onSelect }) {
  const today = todayISO();
  const range = useMemo(() => {
    let min = today, max = today;
    projects.forEach((p) => {
      if (p.startDate && p.startDate < min) min = p.startDate;
      p.tasks.forEach((t) => { if (t.deadline && t.deadline > max) max = t.deadline; });
    });
    const pad = (iso, days) => {
      const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    return { min: pad(min, -3), max: pad(max, 5) };
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
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [savedFlash, setSavedFlash] = useState("");
  const [view, setView] = useState("list");
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [dragNoteId, setDragNoteId] = useState(null);
  const [dragOverNoteId, setDragOverNoteId] = useState(null);
  const saveTimer = useRef(null);
  const flashTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) setProjects((JSON.parse(res.value).projects || []).map(migrate));
      } catch (e) { /* first run */ }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await storage.set(STORAGE_KEY, JSON.stringify({ projects: next }));
        setSavedFlash("saved");
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setSavedFlash(""), 1200);
      } catch (e) { setSavedFlash("save failed — will retry on next change"); }
    }, 500);
  }, []);

  const update = useCallback((fn) => {
    setProjects((prev) => { const next = fn(prev); persist(next); return next; });
  }, [persist]);

  const sorted = useMemo(() => [...projects].sort(attentionSort), [projects]);
  const selected = projects.find((p) => p.id === selectedId) || null;
  const allTasks = projects.flatMap((p) => p.tasks);
  const overallPct = allTasks.length ? Math.round((allTasks.filter((t) => t.done).length / allTasks.length) * 100) : 0;

  const addProject = () => {
    const name = newProj.name.trim();
    if (!name) return;
    const proj = {
      id: uid(), name, client: newProj.client.trim(), location: newProj.location.trim(),
      startDate: newProj.startDate || todayISO(), notes: [], colorIdx: projects.length % PALETTE.length,
      tasks: [], createdAt: Date.now(),
    };
    update((prev) => [...prev, proj]);
    setSelectedId(proj.id); setAdding(false);
    setNewProj({ name: "", client: "", location: "", startDate: todayISO() });
  };

  const patchProject = (patch) => update((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
  const patchTasks = (fn) => update((prev) => prev.map((p) => (p.id === selected.id ? { ...p, tasks: fn(p.tasks) } : p)));

  const addTask = () => {
    const title = taskInput.trim();
    if (!title || !selected) return;
    patchTasks((ts) => [...ts, { id: uid(), title, done: false, deadline: todayISO(), createdAt: Date.now() }]);
    setTaskInput("");
  };
  const addNoise = () => {
    const text = noiseInput.trim();
    if (!text || !selected) return;
    patchProject({ notes: [...selected.notes, { id: uid(), text: textToHtml(text) }] });
    setNoiseInput("");
  };
  const deleteProject = () => {
    if (!deleteArmed) { setDeleteArmed(true); setTimeout(() => setDeleteArmed(false), 2500); return; }
    update((prev) => prev.filter((p) => p.id !== selected.id));
    setSelectedId(null); setDeleteArmed(false);
  };

  if (!loaded) return (<div className="pd-app"><style>{css}</style><div className="pd-loading">loading your projects…</div></div>);

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
          <div className="pd-viewtoggle">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>list</button>
            <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>timeline</button>
          </div>

          {adding ? (
            <div className="pd-form">
              <input type="text" placeholder="Project name" value={newProj.name} autoFocus
                onChange={(e) => setNewProj({ ...newProj, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); if (e.key === "Escape") setAdding(false); }} />
              <input type="text" placeholder="Client name" value={newProj.client}
                onChange={(e) => setNewProj({ ...newProj, client: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} />
              <input type="text" placeholder="Location" value={newProj.location}
                onChange={(e) => setNewProj({ ...newProj, location: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} />
              <div className="pd-form-label">Start date</div>
              <div className="pd-form-row">
                <DatePicker value={newProj.startDate} onChange={(iso) => setNewProj({ ...newProj, startDate: iso || todayISO() })} />
                <button className="pd-btn" onClick={addProject}>Create</button>
                <button className="pd-btn ghost" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="pd-addproj" onClick={() => setAdding(true)}>+ New project</button>
          )}

          {sorted.length === 0 && !adding && <p className="pd-empty">No projects yet. Create your first one to start tracking progress.</p>}

          {view === "timeline" ? (
            <Timeline projects={sorted} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
          sorted.map((p) => {
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
        <div className="pd-right">
          {!selected ? (
            <p className="pd-empty">Select a project to see its tasks and brain noises.</p>
          ) : (
            <>
              <button className="pd-back" onClick={() => setSelectedId(null)}>← all projects</button>

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
                <button className={`pd-danger-btn ${deleteArmed ? "arm" : ""}`} onClick={deleteProject}>
                  {deleteArmed ? "confirm delete" : "delete project"}
                </button>
              </div>

              <div style={{ marginTop: 14 }} className="pd-overall-label">
                {selPct === null ? "not started" : `${doneCount}/${selected.tasks.length} tasks · ${selPct}%`}
                {startedLabel(selected.startDate) && <> · {startedLabel(selected.startDate)}</>}
              </div>
              <div className="pd-progressbar"><div className="pd-progressfill" style={{ width: `${selPct ?? 0}%`, background: selColor.fg }} /></div>

              <input className="pd-quickadd" placeholder="Add a task and press Enter…"
                value={taskInput} onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} />

              {selected.tasks.length === 0 ? (
                <p className="pd-empty">Add your first task above — progress starts counting from there.</p>
              ) : (
                <ul className="pd-tasklist">
                  {activeTasks.map((t) => {
                    const due = dueLabel(t.deadline);
                    return (
                      <li key={t.id}
                        className={`pd-task ${dragTaskId === t.id ? "dragging" : ""} ${dragOverTaskId === t.id ? "drag-over" : ""}`}
                        draggable onDragStart={() => setDragTaskId(t.id)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverTaskId(t.id); }}
                        onDrop={(e) => { e.preventDefault(); if (dragTaskId) patchTasks((ts) => moveItem(ts, dragTaskId, t.id)); setDragTaskId(null); setDragOverTaskId(null); }}
                        onDragEnd={() => { setDragTaskId(null); setDragOverTaskId(null); }}>
                        <span className="pd-drag-handle">⠿</span>
                        <div className="pd-reorder">
                          <button onClick={() => patchTasks((ts) => moveBy(ts, t.id, -1))} disabled={activeTasks[0]?.id === t.id} aria-label="Move up">▲</button>
                          <button onClick={() => patchTasks((ts) => moveBy(ts, t.id, 1))} disabled={activeTasks[activeTasks.length - 1]?.id === t.id} aria-label="Move down">▼</button>
                        </div>
                        <button className="pd-check" onClick={() => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))} aria-label="Mark as done">
                          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.5L4.8 9L10 3.5" fill="none" stroke="#14181E" strokeWidth="2" strokeLinecap="round" /></svg>
                        </button>
                        <input className="pd-task-title" value={t.title}
                          onChange={(e) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, title: e.target.value } : x))}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }} aria-label="Task title" />
                        {due && <span className={`pd-task-due ${due.overdue ? "overdue" : ""}`}>{due.text}</span>}
                        <DatePicker value={t.deadline} onChange={(iso) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, deadline: iso } : x))} />
                        <button className="pd-x" aria-label="Delete task" onClick={() => patchTasks((ts) => ts.filter((x) => x.id !== t.id))}>×</button>
                      </li>
                    );
                  })}

                  {completedTasks.length > 0 && <li className="pd-tasksep">Completed</li>}
                  {completedTasks.map((t) => (
                    <li key={t.id} className="pd-task completed">
                      <span className="pd-drag-handle" style={{ visibility: "hidden" }}>⠿</span>
                      <div className="pd-reorder" style={{ visibility: "hidden" }}><button>▲</button><button>▼</button></div>
                      <button className="pd-check done" style={{ background: selColor.fg, borderColor: selColor.fg }}
                        onClick={() => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))} aria-label="Mark as not done">
                        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.5L4.8 9L10 3.5" fill="none" stroke="#14181E" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>
                      <input className="pd-task-title done" value={t.title}
                        onChange={(e) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, title: e.target.value } : x))}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }} aria-label="Task title" />
                      <button className="pd-x" aria-label="Delete task" onClick={() => patchTasks((ts) => ts.filter((x) => x.id !== t.id))}>×</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pd-section-label">Brain Noises</div>
              <input className="pd-noise-input" placeholder="Drop a thought and press Enter…"
                value={noiseInput} onChange={(e) => setNoiseInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNoise(); }} />
              {selected.notes.length === 0 ? (
                <p className="pd-empty">Empty head. Add thoughts, doubts, ideas — one bubble each.</p>
              ) : (
                <div className="pd-bubbles">
                  {selected.notes.map((n) => (
                    <Bubble key={n.id} note={n} color={selColor}
                      onSave={(text) => patchProject({ notes: selected.notes.map((x) => (x.id === n.id ? { ...x, text } : x)) })}
                      onDelete={() => patchProject({ notes: selected.notes.filter((x) => x.id !== n.id) })}
                      dragProps={{
                        className: `${dragNoteId === n.id ? "dragging" : ""} ${dragOverNoteId === n.id ? "drag-over" : ""}`,
                        onDragStart: () => setDragNoteId(n.id),
                        onDragOver: (e) => { e.preventDefault(); setDragOverNoteId(n.id); },
                        onDrop: (e) => { e.preventDefault(); if (dragNoteId) patchProject({ notes: moveItem(selected.notes, dragNoteId, n.id) }); setDragNoteId(null); setDragOverNoteId(null); },
                        onDragEnd: () => { setDragNoteId(null); setDragOverNoteId(null); },
                      }} />
                  ))}
                </div>
              )}
              <div className="pd-saved">{savedFlash}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login gate — email magic link, no password. Same account on any    */
/*  device sees the same data, since data is scoped to your user id.   */
/* ------------------------------------------------------------------ */
const gateCss = `
.pd-gate{
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  background:#14181E; color:#E8ECF1; font-family:'Inter',system-ui,sans-serif; padding:24px;
}
.pd-gate-card{width:100%; max-width:340px; text-align:center;}
.pd-gate-title{font-family:'Archivo',sans-serif; font-weight:800; font-size:22px; margin-bottom:6px;}
.pd-gate-title span{color:#E9B44C;}
.pd-gate-sub{color:#8C96A3; font-size:13px; margin-bottom:22px;}
.pd-gate-input{
  width:100%; padding:11px 14px; font-size:14px; border:1px solid #2C343E; border-radius:10px;
  background:#212933; color:#E8ECF1; margin-bottom:10px;
}
.pd-gate-input:focus{outline:none; border-color:#E9B44C;}
.pd-gate-btn{
  width:100%; border:none; background:#E9B44C; color:#1A1300; border-radius:10px; padding:11px 14px;
  font-size:14px; font-weight:600; cursor:pointer;
}
.pd-gate-btn:disabled{opacity:.6; cursor:default;}
.pd-gate-msg{font-size:12px; color:#8C96A3; margin-top:14px; font-family:'IBM Plex Mono',monospace;}
.pd-gate-msg.err{color:#E06A87;}
`;

function LoginGate() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendLink = async () => {
    if (!email.trim()) return;
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };

  return (
    <div className="pd-gate">
      <style>{gateCss}</style>
      <div className="pd-gate-card">
        <div className="pd-gate-title">Projects<span>.</span></div>
        <div className="pd-gate-sub">
          {sent ? "Check your email for the sign-in link." : "Sign in with your email — no password needed."}
        </div>
        {!sent && (
          <>
            <input className="pd-gate-input" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendLink(); }} />
            <button className="pd-gate-btn" onClick={sendLink} disabled={busy}>
              {busy ? "Sending…" : "Send sign-in link"}
            </button>
          </>
        )}
        {error && <div className="pd-gate-msg err">{error}</div>}
        {sent && <div className="pd-gate-msg">Opened the same link on another device? It'll sign you in there too.</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

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
