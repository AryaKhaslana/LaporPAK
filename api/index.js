import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkRadiusQuota,
  createTicket,
  getFullSnapshot,
  resetDemoState,
  simulateTicketTimeShift,
  startTicketWork,
  submitCitizenValidation,
  submitRepairEvidence,
  supportTicketPriority,
  transferTicketAgency,
} from "../src/core/laporpak.engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "..", "public");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(publicPath));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "LaporPAK! Civic-Tech Monorepo API",
    competition: "Techcomfest 2027 - Sub-Tema 1 Smart Governance (SDG 16)",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/state", (_req, res) => {
  res.json({ ok: true, data: getFullSnapshot() });
});

app.get("/api/tickets/check-radius", (req, res) => {
  const { lat, lng, category } = req.query;
  const result = checkRadiusQuota(Number(lat), Number(lng), String(category || ""));
  res.json({ ok: true, data: result });
});

app.post("/api/tickets", (req, res) => {
  const result = createTicket(req.body || {});
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  return res.status(201).json({
    ok: true,
    ticket: result.ticket,
    state: getFullSnapshot(),
  });
});

app.post("/api/tickets/:id/support", (req, res) => {
  const result = supportTicketPriority(
    req.params.id,
    req.body?.citizenId || "CITIZEN_2"
  );
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  return res.json({
    ok: true,
    ticket: result.ticket,
    state: getFullSnapshot(),
  });
});

app.post("/api/tickets/:id/transfer", (req, res) => {
  const result = transferTicketAgency(req.params.id, req.body || {});
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  return res.json({
    ok: true,
    ticket: result.ticket,
    state: getFullSnapshot(),
  });
});

app.post("/api/tickets/:id/start", (req, res) => {
  const result = startTicketWork(req.params.id, req.body || {});
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  return res.json({
    ok: true,
    ticket: result.ticket,
    state: getFullSnapshot(),
  });
});

app.post("/api/tickets/:id/repair", (req, res) => {
  const result = submitRepairEvidence(req.params.id, req.body || {});
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  return res.json({
    ok: true,
    ticket: result.ticket,
    state: getFullSnapshot(),
  });
});

app.post("/api/tickets/:id/validate", (req, res) => {
  const result = submitCitizenValidation(req.params.id, req.body || {});
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  return res.json({
    ok: true,
    ticket: result.ticket,
    state: getFullSnapshot(),
  });
});

app.post("/api/tickets/:id/simulate-time", (req, res) => {
  const result = simulateTicketTimeShift(
    req.params.id,
    req.body?.mode || "EXPIRE_24H_OR_SLA"
  );
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  return res.json({
    ok: true,
    ticket: result.ticket,
    state: getFullSnapshot(),
  });
});

app.post("/api/simulation/reset", (_req, res) => {
  const state = resetDemoState();
  res.json({ ok: true, data: state });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 5050;
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`LaporPAK! server running on http://localhost:${PORT}`);
  });
}

export default app;
