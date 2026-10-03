import express from "express";
import { errorHandler, notFound, requestContext } from "../shared/http.js";

export function createApp(routes?: express.Router) {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(express.json({ limit: "100kb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Salon backend is running." });
  });
  if (routes) app.use("/api", routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
