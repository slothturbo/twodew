import { colorOf } from "../lib/helpers";

// Desktop nav — replaces the old icon-only rail with a wider, Notion-style
// sidebar: primary nav rows plus a live, minimal "quick jump" project list.
// The Projects screen keeps its own full list/search/timeline — this list is
// deliberately bare (name + color dot only), not a second management surface.
export function Sidebar({ screen, navItems, onNavigate, projects, onOpenProject, onOpenPalette, collapsed, onToggleCollapsed }) {
  return (
    <nav className={`pd-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="pd-sidebar-head">
        <div className="pd-sidebar-logo" />
        {!collapsed && (
          <button type="button" className="pd-sidebar-search" onClick={onOpenPalette}>
            <span className="pd-navicon pd-navicon-search" />
            <span className="pd-sidebar-search-label">Search</span>
            <span className="pd-sidebar-kbd">⌘K</span>
          </button>
        )}
        {collapsed && (
          <button type="button" className="pd-sidebar-item pd-sidebar-search-collapsed" onClick={onOpenPalette} title="Search (⌘K)">
            <span className="pd-navicon pd-navicon-search" />
          </button>
        )}
      </div>

      <div className="pd-sidebar-nav">
        {navItems.map((n) => (
          <button key={n.key} type="button" className={`pd-sidebar-item ${screen === n.key ? "active" : ""}`}
            title={n.label} onClick={() => onNavigate(n.key)}>
            <span className={`pd-navicon pd-navicon-${n.icon}`} />
            {!collapsed && <span>{n.label}</span>}
          </button>
        ))}
      </div>

      {!collapsed && projects.length > 0 && (
        <div className="pd-sidebar-projects">
          <div className="pd-sidebar-section-label">Projects</div>
          {projects.map((p) => {
            const c = colorOf(p);
            return (
              <button key={p.id} type="button" className="pd-sidebar-item pd-sidebar-project"
                title={p.name} onClick={() => onOpenProject(p.id)}>
                <span className="pd-sidebar-dot" style={{ background: c.fg }} />
                <span className="pd-sidebar-project-name">{p.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="pd-sidebar-foot">
        <button type="button" className="pd-sidebar-collapse" onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand" : "Collapse"}>
          <span className={`pd-navicon pd-navicon-collapse ${collapsed ? "flipped" : ""}`} />
        </button>
      </div>
    </nav>
  );
}
