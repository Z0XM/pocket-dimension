import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia, StatusMap, status } from "elysia";
import { env } from "./lib/env";
import { authMiddleware } from "./middlewares/auth";
import { authHandler } from "./routes/auth";

const app = new Elysia()
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    console.log(`${request.method} ${url.pathname}`);
  })
  .onAfterHandle(({ request, response }) => {
    const url = new URL(request.url);
    const status = response instanceof Response ? response.status : 200;
    console.log(`${request.method} ${url.pathname} - ${status}`);
  })
  .onError(({ code, error, request }) => {
    const url = new URL(request.url);
    console.error(`Error ${code} on ${request.method} ${url.pathname}:`, error);
  })
  .use(
    cors({
      origin: true, // Allow all origins (wildcard behavior) while supporting credentials
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
    "/anurag?policyKey=:policyKey",
    ({ query }) => {
      const { policyKey } = query;
      if (policyKey !== "anurag") {
        return status(StatusMap.Unauthorized, {
          message: "Invalid policy key",
          data: null,
        });
      }
      return status(StatusMap.OK, {
        message: "User Validated",
        data: {
          sessionId: "655a2984-98e1-4765-8372-58fad83d2ac7",
        },
      });
    },
    {
      detail: {
        summary: "Anurag",
        description: "Anurag",
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

console.log(`\n🚀 Auth Service running at http://localhost:${app.server?.port}`);
console.log(`📚 Swagger documentation available at http://localhost:${app.server?.port}/swagger\n`);
