// PermitEarly — Landing page placeholder
// Replace with your Readdy-designed UI. The API layer is fully built.

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
        color: "#fff",
        textAlign: "center",
        padding: "32px 16px",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(2.5rem, 6vw, 4rem)",
          fontWeight: 800,
          margin: "0 0 12px",
          letterSpacing: "-1px",
        }}
      >
        Permit<span style={{ color: "#93c5fd" }}>Early</span>
      </h1>
      <p
        style={{
          fontSize: "clamp(1rem, 2.5vw, 1.4rem)",
          margin: "0 0 40px",
          color: "#bfdbfe",
          fontStyle: "italic",
        }}
      >
        Get there first.
      </p>
      <p style={{ fontSize: "1rem", color: "#dbeafe", maxWidth: 480 }}>
        Daily permit alerts for Orlando contractors. Know who just pulled a
        building permit in your area before your competition does.
      </p>
      <div
        style={{
          marginTop: 48,
          padding: "16px 24px",
          background: "rgba(255,255,255,0.1)",
          borderRadius: 12,
          fontSize: 14,
          color: "#bfdbfe",
        }}
      >
        API ready · UI coming soon
      </div>
    </main>
  );
}
