// Placeholder until the frontend phase. The API lives under /api/v1.
export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "48px 16px", maxWidth: 640, margin: "0 auto" }}>
      <h1>CampusConnect</h1>
      <p>The API is running. The web app is coming next.</p>
      <p>
        Health check: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
