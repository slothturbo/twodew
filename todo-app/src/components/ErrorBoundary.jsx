import { Component } from "react";

// Wraps the app so a render crash shows a recoverable fallback instead of a blank
// white screen, matching the app's own "no silent data loss" trust principle.
//
// Deliberately uses literal colors instead of the app's own var(--token) custom
// properties: those are only defined once the app's own <style>{css}</style> tag has
// rendered, but the whole point of this fallback is to also cover a crash that happens
// before that ever mounts (confirmed by testing — the tokens really do come back empty
// in that case, silently making this text invisible against the dark background).
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[Twodew Error Boundary] Component crashed:", error.message);
    this.setState({ errorInfo: info, retryCount: this.state.retryCount + 1 });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { fallback: FallbackUI, children } = this.props;

    if (hasError) {
      return FallbackUI ? (
        <FallbackUI error={error} onRetry={this.handleRetry} />
      ) : (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#050505", padding: 24, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}>
          <div style={{
            padding: "2rem", textAlign: "center", background: "#141416",
            border: "1px solid #26282C", borderRadius: "18px",
            maxWidth: "500px", color: "#F5F6F1",
          }}>
            <h3 style={{ color: "#FF6B85", marginBottom: "1rem" }}>
              Something went wrong
            </h3>

            {error && (
              <p style={{ color: "#8B8E93", fontSize: "14px", marginBottom: "1rem", wordBreak: "break-word" }}>
                {error.toString().slice(0, 150)}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={this.handleRetry} style={{
                padding: "10px 20px", background: "#FF5A2E", color: "#0A0A0A",
                border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 600,
              }}>
                Reload app{retryCount > 1 ? ` (try ${retryCount})` : ""}
              </button>

              <button onClick={() => window.open("https://github.com/slothturbo/twodew/issues", "_blank")} style={{
                padding: "10px 20px", background: "#1D1F22", color: "#F5F6F1",
                border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "14px",
              }}>
                Report issue
              </button>
            </div>

            {errorInfo && (
              <details style={{ marginTop: "1rem", textAlign: "left" }}>
                <summary style={{ color: "#8B8E93", cursor: "pointer" }}>Technical details</summary>
                <pre style={{
                  textAlign: "left", fontSize: "12px", background: "#1D1F22",
                  padding: "10px", borderRadius: "8px", overflow: "auto", color: "#8B8E93",
                }}>
                  {errorInfo.componentStack?.split("\n").slice(0, 5).join("\n")}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
