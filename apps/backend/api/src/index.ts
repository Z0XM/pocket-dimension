const PORT = Number(Bun.env.PORT) || 3001;

const server = Bun.serve({
  port: PORT,
  fetch(req: Request) {
    const url = new URL(req.url);

    // Root API endpoint
    if (url.pathname === "/" || url.pathname === "/api") {
      return new Response(JSON.stringify({ message: "hello world" }), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // 404 for other routes
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
});

console.log(`Backend API running at http://localhost:${server.port}`);
