import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { supabase } from "../lib/supabase";
import { callGemini, ImagePart } from "../lib/gemini";

// Placeholder until auth middleware populates req.user.
const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000000";

const MAX_FILES = 10;

// Memory storage only — frames live in RAM for the request and are never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/", upload.array("frames", MAX_FILES), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  if (files.length === 0) {
    return res.status(400).json({ error: "No frames uploaded" });
  }

  const userId = req.user?.id ?? PLACEHOLDER_USER_ID;
  const jobId = randomUUID();

  // Create the job row before any processing starts.
  const { error: insertError } = await supabase
    .from("jobs")
    .insert({ id: jobId, user_id: userId, status: "processing" });

  if (insertError) {
    console.error("Failed to create job:", insertError);
    return res.status(500).json({ error: "Failed to create job" });
  }

  try {
    const imageParts: ImagePart[] = files.map((file) => ({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString("base64"),
      },
    }));

    const geminiResult = await callGemini(imageParts);

    // Placeholder for real rendering: hand back the chosen input frame untouched.
    const chosenFrame = files[geminiResult.frameChoice];
    if (!chosenFrame) {
      throw new Error(`frameChoice ${geminiResult.frameChoice} is out of range`);
    }

    const result = {
      ...geminiResult,
      thumbnailBase64: chosenFrame.buffer.toString("base64"),
      thumbnailMimeType: chosenFrame.mimetype,
    };

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "done",
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (updateError) throw new Error(updateError.message);

    return res.json({ jobId, status: "done", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Job ${jobId} failed:`, message);

    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return res.status(500).json({ jobId, status: "failed", error: message });
  }
});

export default router;
