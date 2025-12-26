const PORT = Number(Bun.env.PORT) || 5001;

const server = Bun.serve({
  port: PORT,
  fetch(req: Request) {
    const url = new URL(req.url);

    // Root auth endpoint
    if (url.pathname === "/" || url.pathname === "/auth") {
      return new Response(JSON.stringify({ message: "Auth service" }), {
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

console.log(`Backend Auth running at http://localhost:${server.port}`);
