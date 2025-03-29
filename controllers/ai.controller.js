import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEM);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });
const MAGIC_HOUR_API_KEY = process.env.MAGIC;
const BASE_URL = "https://api.magichour.ai/v1";

// Verify credentials on startup
if (!process.env.GEM) {
  console.error("Gemini token missing! Set GEM environment variable");
  process.exit(1);
}

if (!process.env.MAGIC) {
  console.error("Magic Hour token missing! Set MAGIC environment variable");
  process.exit(1);
}

// Unified error handler
const handleError = (res, error, type) => {
  console.error(`${type} Generation Error:`, error);
  return res.status(500).render("main", {
    message: `Failed to generate ${type}`,
    error: error.message,
    currentTab: type,
  });
};

const chatGen = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const result = await model.generateContent(prompt);
    const responseText =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    res.render("main", { output: responseText });
  } catch (error) {
    console.error("Chat Error:", error);
    res.render("main", { output: "Error generating response." });
  }
};

// Image Generation Controller (Magic Hour)
const imgGen = async (req, res) => {
  try {
    const {
      prompt,
      image_count = 1,
      orientation = "landscape",
      name = `AI Image - ${new Date().toISOString()}`,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const response = await fetch(`${BASE_URL}/ai-image-generator`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAGIC_HOUR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        image_count,
        orientation,
        style: { prompt },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Image generation failed: ${errorData.error || response.statusText}`
      );
    }

    const { id } = await response.json();

    // Polling mechanism to check the status of the image generation
    let status = "queued";
    let imageUrl = "";
    while (status !== "complete") {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before polling again
      const statusResponse = await fetch(`${BASE_URL}/image-projects/${id}`, {
        headers: {
          Authorization: `Bearer ${MAGIC_HOUR_API_KEY}`,
        },
      });
      const statusData = await statusResponse.json();
      status = statusData.status;
      if (status === "complete") {
        imageUrl = statusData.downloads[0].url;
      } else if (status === "error") {
        throw new Error("Image generation encountered an error.");
      }
    }

    res.render("main", {
      result: {
        type: "image",
        imageUrl: generatedImageUrl,
      },
    });
  } catch (error) {
    console.error("Image Generation Error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate image",
      success: false,
    });
  }
};

// Audio Generation Controller (Gemini)
const audGen = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt)
      return res.status(400).render("main", {
        message: "No prompt provided",
        currentTab: "audio",
      });

    console.log("Audio Generation Request:", { prompt });

    // Use Gemini for text-to-speech
    // Note: As of March 2025, if Gemini has a specific TTS API endpoint, you would use it here
    // This is a placeholder implementation assuming Gemini has TTS capabilities
    const ttsEndpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

    const response = await fetch(ttsEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEM,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseFormat: "audio", // Assuming Gemini supports this
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini TTS API error: ${response.statusText}`);
    }

    const audioData = await response.arrayBuffer();
    console.log(
      "Gemini Audio Response received, size:",
      audioData.byteLength,
      "bytes"
    );

    res.render("main", {
      currentTab: "audio",
      result: {
        type: "audio",
        audioBuffer: Buffer.from(audioData).toString("base64"),
      },
    });
  } catch (error) {
    handleError(res, error, "audio");
  }
};

// Video Generation Controller (Magic Hour)
const vidGen = async (req, res) => {
  try {
    const {
      prompt,
      end_seconds = 5,
      orientation = "landscape",
      name = `Text To Video - ${new Date().toISOString()}`,
    } = req.body;

    if (!prompt) {
      return res
        .status(400)
        .render("main", { error: "Prompt is required", videoUrl: null });
    }

    const response = await fetch(`${BASE_URL}/text-to-video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAGIC_HOUR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        end_seconds,
        orientation,
        style: { prompt },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Video generation failed: ${errorData.error || response.statusText}`
      );
    }

    const { id } = await response.json();

    // Polling mechanism to check the status of the video generation
    let status = "queued";
    let videoUrl = "";
    while (status !== "complete") {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds before polling again
      const statusResponse = await fetch(`${BASE_URL}/video-projects/${id}`, {
        headers: {
          Authorization: `Bearer ${MAGIC_HOUR_API_KEY}`,
        },
      });
      const statusData = await statusResponse.json();
      status = statusData.status;
      if (status === "complete") {
        videoUrl = statusData.downloads[0].url;
      } else if (status === "error") {
        throw new Error("Video generation encountered an error.");
      }
    }

    res.render("main", { videoUrl, error: null });
  } catch (error) {
    console.error("Video Generation Error:", error);
    res.status(500).render("main", {
      error: error.message || "Failed to generate video",
      videoUrl: null,
    });
  }
};

export default { imgGen, audGen, vidGen, chatGen };
