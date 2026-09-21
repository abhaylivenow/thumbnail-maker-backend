import OpenAI from "openai";
import type { Responses } from "openai/resources/responses";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY");
}

const client = new OpenAI({ apiKey });

// Reasoning model that drives the tool call; the tool itself renders the image.
const RESPONSES_MODEL = "gpt-5.5";
const IMAGE_MODEL = "gpt-image-2.5-sunburst";

// Portrait, sized for a Short/Reel cover.
// Width and height must both be divisible by 16 — 1080 is not, so 1088 stands in for it.
const IMAGE_SIZE = "1088x1920";
const OUTPUT_FORMAT = "png";

const THUMBNAIL_PROMPT = `So these are the probable candidates for a YouTube short video and these are screenshots, I want you to create this into a YouTube thumbnail of dimension 9:16, judge yourself based on images what this image is about and create me a thumbnail`;

export type ThumbnailFrame = {
  buffer: Buffer;
  mimetype: string;
};

export type ThumbnailResult = {
  thumbnailBase64: string;
  thumbnailMimeType: string;
};

/**
 * Sends every frame to the Responses API as a reference image and returns the
 * thumbnail produced by the image_generation tool. Buffers stay in memory.
 */
export async function generateThumbnail(
  frames: ThumbnailFrame[],
): Promise<ThumbnailResult> {
  const referenceImages: Responses.ResponseInputContent[] = frames.map(
    (frame) => ({
      type: "input_image",
      detail: "high",
      image_url: `data:${frame.mimetype};base64,${frame.buffer.toString("base64")}`,
    }),
  );

  const imageTool: Responses.Tool = {
    type: "image_generation",
    model: IMAGE_MODEL,
    size: IMAGE_SIZE,
    quality: "high",
    output_format: OUTPUT_FORMAT,
    // No input_fidelity here: gpt-image-2.5-sunburst rejects it outright (400).
    // Reference adherence comes from the prompt instead.
  };

  const response = await client.responses.create({
    model: RESPONSES_MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: THUMBNAIL_PROMPT },
          ...referenceImages,
        ],
      },
    ],
    tools: [imageTool],
    tool_choice: { type: "image_generation" },
  });

  const imageCall = response.output.find(
    (item): item is Responses.ResponseOutputItem.ImageGenerationCall =>
      item.type === "image_generation_call",
  );

  if (!imageCall) {
    throw new Error("OpenAI returned no image_generation_call output");
  }

  if (imageCall.status !== "completed" || !imageCall.result) {
    throw new Error(`Image generation did not complete (${imageCall.status})`);
  }

  return {
    thumbnailBase64: imageCall.result,
    thumbnailMimeType: `image/${imageCall.output_format ?? OUTPUT_FORMAT}`,
  };
}
