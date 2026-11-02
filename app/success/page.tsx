export default function SuccessPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0fdf4",
        textAlign: "center",
        padding: "32px 16px",
      }}
    >
      <div style={{ fontSize: 64 }}>✅</div>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#166534", margin: "16px 0 8px" }}>
        You&apos;re in!
      </h1>
      <p style={{ color: "#15803d", fontSize: "1.1rem", maxWidth: 400 }}>
        Your 3-day free trial has started. You&apos;ll receive your first permit
        digest tomorrow morning. Welcome to PermitEarly.
      </p>
    </main>
  );
}
