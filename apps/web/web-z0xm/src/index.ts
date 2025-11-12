const PORT = Number(Bun.env.PORT) || 3000;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Z0XM</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        h1 {
            font-size: 4rem;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            letter-spacing: 0.1em;
        }
    </style>
</head>
<body>
    <h1>Z0XM</h1>
</body>
</html>`;

const server = Bun.serve({
  port: PORT,
  fetch(_req: Request) {
    return new Response(HTML, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
