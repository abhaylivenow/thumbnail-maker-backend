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


export async function callGemini(imageParts: { inlineData: { data: string; mimeType: string } }[]) {
  await new Promise((resolve) => setTimeout(resolve, 500)); // simulate network delay

  const randomIndex = Math.floor(Math.random() * imageParts.length);

  return {
    frameChoice: randomIndex,
    totalFramesReceived: imageParts.length,
    text: "Sample hook text",
    style: "bold",
    color: "#FF3B30",
  };
}
