import React from "react";

/**
 * Production-ready Error Boundary Component
 * Wraps components to prevent white screen of death and provide user-friendly fallbacks
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[Twodew Error Boundary] Component crashed:", error.message);
    this.setState({ 
      errorInfo: info,
      retryCount: this.state.retryCount + 1
    });
    
    // Log to monitoring service in production
    if (import.meta.env.PROD && window.location.hostname !== 'localhost') {
      console.log("[Twodew Error] Would send to Sentry:", error.toString());
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    window.location.reload();
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { fallback: FallbackUI, children, projectId } = this.props;

    if (hasError) {
      return FallbackUI ? (
        <FallbackUI error={error} onRetry={this.handleRetry} />
      ) : (
        <div 
          className="twodew-error-fallback"
          style={{
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            margin: "2rem auto",
            maxWidth: "500px"
          }}
        >
          <h3 style={{ 
            color: "#dc2626", 
            marginBottom: "1rem" 
          }}>
            🚨 Something went wrong
          </h3>
          
          {error && (
            <p style={{ 
              color: "#6b7280", 
              fontSize: "14px",
              marginBottom: "1rem",
              wordBreak: "break-word"
            }}>
              Error ID: {projectId || 'general'} | {error.toString().substring(0, 100)}...
            </p>
          )}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "10px 20px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              🔄 Reload App (Try {retryCount})
            </button>

            <button
              onClick={() => window.open('https://github.com/your-repo/issues', '_blank')}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              🐛 Report Issue
            </button>
          </div>

          <details style={{ marginTop: "1rem", textAlign: "left" }}>
            <summary style={{ color: "#6b7280", cursor: "pointer" }}>
              Technical Details {errorInfo ? `(${Object.keys(errorInfo).length} items)` : ''}
            </summary>
            {this.state.errorInfo && (
              <pre style={{ 
                textAlign: "left", 
                fontSize: "12px",
                backgroundColor: "#f9fafb",
                padding: "10px",
                borderRadius: "4px",
                overflow: "auto"
            }}>
{this.state.errorInfo.componentStack?.split('\n').slice(0, 5).join('\n')}
              </pre>
            )}
          </details>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
