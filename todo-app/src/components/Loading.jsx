import React from "react";

/**
 * Loading Spinner Component - replaces blank loading states with visual feedback
 */
export function LoadingSpinner({ 
  message = "Loading...", 
  size = "md",
  className = ""
}) {
  const sizes = {
    sm: { size: "16px", border: "2px" },
    md: { size: "24px", border: "3px" },
    lg: { size: "32px", border: "4px" }
  };

  const currentSize = sizes[size];

  return (
    <div 
      className={`twodew-loading-spinner ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem"
      }}
    >
      <div 
        className="twodew-spinner"
        style={{
          width: currentSize.size,
          height: currentSize.size,
          border: `${currentSize.border} solid #e5e7eb`,
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }}
      />
      <span style={{
        color: "#6b7280",
        fontSize: size === "sm" ? "14px" : "16px"
      }}>
        {message}
      </span>
    </div>
  );
}

/**
 * Loading List Skeleton Component
 */
export function LoadingList({ count = 3, className = "" }) {
  return (
    <div className={`twodew-loading-list ${className}`} style={{ padding: "1rem" }}>
      {[...Array(count)].map((_, i) => (
        <div key={i} style={{
          height: "20px",
          width: `${70 + Math.random() * 30}%`,
          backgroundColor: "#e5e7eb",
          borderRadius: "4px",
          marginBottom: "0.75rem",
          opacity: 0.6,
          animation: `pulse ${1 + i * 0.2}s ease-in-out infinite alternate`
        }} />
      ))}
    </div>
  );
}

/**
 * Full-screen loading overlay for critical states
 */
export function LoadingOverlay({ message = "Loading..." }) {
  return (
    <div 
      className="twodew-loading-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
    >
      <LoadingSpinner message={message} size="lg" />
    </div>
  );
}

// Inject CSS animations dynamically for local preview
const injectStyles = () => {
  if (typeof window !== 'undefined' && !document.getElementById('twodew-spin-styles')) {
    const style = document.createElement('style');
    style.id = 'twodew-spin-styles';
    style.textContent = `
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } }
    `;
    document.head.appendChild(style);
  }
};

if (typeof window !== 'undefined') {
  injectStyles();
}

export default LoadingSpinner;
