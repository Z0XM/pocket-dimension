import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">About</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        This is a public page. Anyone can access it without authentication.
      </p>
    </div>
  );
}
