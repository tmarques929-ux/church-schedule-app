// app/not-found.tsx
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <h1>Página não encontrada</h1>
      <p>O recurso que você está procurando não existe.</p>
    </div>
  );
}
