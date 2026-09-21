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
const IMAGE_SIZE = "1080x1920";
const OUTPUT_FORMAT = "png";

const THUMBNAIL_PROMPT = `Generate a single high-quality thumbnail image for a short-form video.

Use all provided images as visual references from the same finished video.

Create one brand-new thumbnail image, not a collage and not simply a copy of one frame.

Requirements:
- Stay grounded in the real footage.
- Preserve the identity and recognizable appearance of people in the reference images.
- Preserve important clothing, objects, environment, and scene context.
- Create a stronger, cleaner and more eye-catching composition suitable for a YouTube Short/Reel cover.
- The main subject should be immediately understandable on a mobile screen.
- Avoid an obviously synthetic or generic AI-generated look.
- Do not invent unrelated people, objects, locations, or story elements.
- Do not add any text, captions, logos, watermarks, UI elements, or typography.
- Return one final thumbnail image.`;

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
    // Keeps faces and objects close to the reference frames.
    input_fidelity: "high",
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
