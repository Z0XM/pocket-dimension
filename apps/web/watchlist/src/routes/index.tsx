import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">Watchlist</h1>
      <p className="mt-4 text-lg text-muted-foreground">Welcome to your watchlist app</p>
    </div>
  );
}
