import express from "express";
import crypto from "crypto";
import cors from "cors";
import satelliteRouter, { resetSummaryCache } from "./satellite/router.js";
import { warmCache } from "./satellite/tleCache.js";

const app = express();

app.use(express.json());
app.use(cors());

app.use("/satellites", satelliteRouter);

app.get("/", (req, res) => {
  res.json({ status: "ok", endpoints: ["/hash", "/satellites"] });
});

app.post("/hash", (req, res) => {
  const {text, algorithm} = req.body;
  const hash = crypto.createHash(algorithm).update(text).digest("hex");
  res.json({hash});
});

// Vercel Cron: refresh TLE cache every 6 hours
app.get("/api/cron/update-tle", async (req, res) => {
  const start = Date.now();
  try {
    resetSummaryCache();
    const results = await warmCache();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    res.json({
      ok: true,
      elapsed: elapsed + 's',
      ...results,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 部署到 Vercel 則不需要
//const port = 3000;
// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });

// 部署到 Vercel 需要增加這一行
export default app;
