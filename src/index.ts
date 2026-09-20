import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import jobsRouter from "./routes/jobs";
import { supabase } from "./lib/supabase";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase.from("jobs").select("*").limit(1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ connected: true, sampleData: data });
});

app.use("/jobs", jobsRouter);

// Turns multer/upload errors into clean 400s instead of a generic 500.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError || err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
