import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import RunwayML from "@runwayml/sdk";

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

async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
}

const chatGen = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const result = await model.generateContent(prompt);
    const responseText =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    // For example, if you're maintaining chatHistory in session or DB:
    // const chatHistory = [...existingChatHistory, { role: 'user', content: prompt }, { role: 'assistant', content: responseText }];
    // For simplicity, we pass the response only:
    res.render("main", {
      output: responseText,
      currentTab: "chat",
      chatHistory: [
        { role: "user", content: prompt },
        { role: "assistant", content: responseText },
      ],
      result: {
        type: "text",
        generated_text: responseText,
      },
    });
  } catch (error) {
    console.error("Chat Error:", error);
    res.render("main", {
      output: "Error generating response.",
      currentTab: "chat",
      error: error.message,
      chatHistory: [],
    });
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

    // Polling mechanism
    let status = "queued";
    let imageUrl = "";
    while (status !== "complete") {
      await new Promise((resolve) => setTimeout(resolve, 5000));
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
        imageUrl: imageUrl,
      },
      currentTab: "image",
    });
  } catch (error) {
    console.error("Image Generation Error:", error);
    res.status(500).render("main", {
      error: error.message || "Failed to generate image",
      currentTab: "image",
      result: null, // Ensures result is always defined to prevent EJS errors
    });
  }
};

// Audio Generation Controller (Gemini)
const audGen = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).render("main", {
        message: "No prompt provided",
        currentTab: "audio",
      });
    }

    console.log("Audio Generation Request:", { prompt });

    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Replace with a valid voice ID

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.LAB,
        },
        body: JSON.stringify({
          text: prompt,
          model_id: "eleven_multilingual_v2",
          output_format: "mp3",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs TTS API error: ${response.status} - ${errorText}`
      );
    }

    const audioData = await response.arrayBuffer();

    res.render("main", {
      currentTab: "audio",
      result: {
        type: "audio",
        audioUrl: `data:audio/mpeg;base64,${Buffer.from(audioData).toString(
          "base64"
        )}`,
      },
    });
  } catch (error) {
    console.error("Audio Generation Error:", error);
    res.status(500).render("main", {
      error: error.message || "Failed to generate audio",
      currentTab: "audio",
      result: null,
    });
  }
};

// Video Generation Controller (Magic Hour)
const vidGen = async (req, res) => {
  try {
    const { prompt, duration = 5 } = req.body;
    if (!prompt) {
      return res.status(400).render("main", {
        error: "Prompt is required",
        currentTab: "video",
        result: null,
      });
    }

    console.log("Minimax Video Generation Request:", { prompt });

    // Start a video generation job with Minimax.
    // The endpoint and payload fields are based on the documentation.
    const startResponse = await fetch(
      "https://api.minimaxi.chat/v1/video_generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MINIMAX}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          duration: duration,
          resolution: "720p", // Adjust or remove if not required by the docs.
        }),
      }
    );

    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      throw new Error(
        `Minimax API error: ${errorData.error || startResponse.statusText}`
      );
    }

    // Assume the response returns a job ID (named jobId)
    const { jobId } = await startResponse.json();
    console.log("Minimax Job Started:", jobId);

    // Poll for job status
    let status = "pending";
    let videoUrl = "";
    const startTime = Date.now();
    const maxWaitTime = 300000; // 5 minutes max

    while (status !== "completed" && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

      const statusResponse = await fetch(
        `https://api.minimax.ai/v1/video/jobs/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MINIMAX}`,
          },
        }
      );

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json();
        throw new Error(
          `Minimax Job status error: ${
            errorData.error || statusResponse.statusText
          }`
        );
      }

      const statusData = await statusResponse.json();
      status = statusData.status;

      if (status === "completed") {
        videoUrl = statusData.video_url; // Adjust the property name per documentation
        break;
      } else if (status === "failed") {
        throw new Error("Video generation failed at Minimax.");
      }
    }

    if (!videoUrl) {
      throw new Error("Video generation timed out after 5 minutes");
    }

    res.render("main", {
      result: {
        type: "video",
        videoUrl: videoUrl,
      },
      currentTab: "video",
    });
  } catch (error) {
    console.error("Minimax Video Generation Error:", error);
    res.status(500).render("main", {
      error: error.message || "Failed to generate video",
      currentTab: "video",
      result: null,
    });
  }
};

export default { imgGen, audGen, vidGen, chatGen };
