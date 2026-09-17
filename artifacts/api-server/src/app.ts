import express, { type Express, type Request } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDistDirectory = path.resolve(
  currentDirectory,
  "../../elite-care-medical/dist/public",
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(
  express.json({
    verify: (_req, req, buffer) => {
      (req as unknown as Request & { rawBody?: Buffer }).rawBody = buffer;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(webDistDirectory, { index: false }));

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(path.join(webDistDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

export default app;
