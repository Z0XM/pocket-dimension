import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { env } from "./lib/env";
import { authMiddleware } from "./middlewares/auth";
import { authHandler } from "./routes/auth";

const app = new Elysia()
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);
  })
  .onAfterHandle(({ request, response }) => {
    const url = new URL(request.url);
    const status = response instanceof Response ? response.status : 200;
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname} - ${status}`);
  })
  .onError(({ code, error, request }) => {
    const url = new URL(request.url);
    console.error(
      `[${new Date().toISOString()}] Error ${code} on ${request.method} ${url.pathname}:`,
      error
    );
  })
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Auth Service API",
          version: "1.0.0",
          description: "Authentication service API documentation",
        },
        tags: [
          {
            name: "auth",
            description: "Authentication endpoints",
          },
        ],
      },
    })
  )
  .use(authHandler)
  .use(authMiddleware)
  .get(
    "/health",
    () => {
      return {
        status: "ok",
      };
    },
    {
      detail: {
        summary: "Health check",
        description: "Check if the service is running",
        tags: [],
      },
    }
  )
  .get(
    "/check",
    ({ user, session }) => {
      return {
        user,
        session,
      };
    },
    {
      auth: true,
      detail: {
        summary: "Check authentication",
        description: "Check if the current user is authenticated and return user/session info",
        tags: ["auth"],
      },
    }
  )
  .listen(Number(env.PORT));

console.log(`\n🚀 Backend Auth running at http://localhost:${app.server?.port}`);
console.log(`📚 Swagger documentation available at http://localhost:${app.server?.port}/swagger\n`);
