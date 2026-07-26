import { Component } from "react";

// Wraps the app so a render crash shows a recoverable fallback instead of a blank
// white screen, matching the app's own "no silent data loss" trust principle.
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
          padding: "2rem", textAlign: "center", background: "var(--card)",
          border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
          margin: "2rem auto", maxWidth: "500px", color: "var(--ink)",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}>
          <h3 style={{ color: "var(--danger)", marginBottom: "1rem" }}>
            Something went wrong
          </h3>

          {error && (
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "1rem", wordBreak: "break-word" }}>
              {error.toString().slice(0, 150)}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={this.handleRetry} style={{
              padding: "10px 20px", background: "var(--accent)", color: "var(--accent-ink)",
              border: "none", borderRadius: "var(--r-md)", cursor: "pointer", fontSize: "14px", fontWeight: 600,
            }}>
              Reload app{retryCount > 1 ? ` (try ${retryCount})` : ""}
            </button>

            <button onClick={() => window.open("https://github.com/slothturbo/twodew/issues", "_blank")} style={{
              padding: "10px 20px", background: "var(--raised)", color: "var(--ink)",
              border: "none", borderRadius: "var(--r-md)", cursor: "pointer", fontSize: "14px",
            }}>
              Report issue
            </button>
          </div>

          {errorInfo && (
            <details style={{ marginTop: "1rem", textAlign: "left" }}>
              <summary style={{ color: "var(--muted)", cursor: "pointer" }}>Technical details</summary>
              <pre style={{
                textAlign: "left", fontSize: "12px", background: "var(--raised)",
                padding: "10px", borderRadius: "var(--r-sm)", overflow: "auto", color: "var(--muted)",
              }}>
                {errorInfo.componentStack?.split("\n").slice(0, 5).join("\n")}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
