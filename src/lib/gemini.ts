export type ImagePart = {
  inlineData: {
    mimeType: string;
    data: string; // base64, no data: prefix
  };
};

export type GeminiResult = {
  frameChoice: number;
  text: string;
  style: string;
};

// Stub — replace with the real Gemini call.
export async function callGemini(imageParts: ImagePart[]): Promise<GeminiResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log(`callGemini stub received ${imageParts.length} image(s)`);
  return { frameChoice: 0, text: "sample", style: "bold" };
}
