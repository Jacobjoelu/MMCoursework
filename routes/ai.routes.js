import express from "express";
import ai from "../controllers/ai.controller.js";

const router = express.Router();

router.post("/chat", ai.chatGen);
router.post("/image-gen", ai.imgGen);
router.post("/audio-gen", ai.audGen);
router.post("/video-gen", ai.vidGen);

router.get("/chat", (req, res) =>
  res.render("chat", {
    currentTab: "chat",
    chatHistory: [
      { role: "user", content: "User message" },
      { role: "assistant", content: "AI response" },
    ],
  })
);
router.get("/image", (req, res) => res.render("main", { currentTab: "image" }));
router.get("/audio", (req, res) => res.render("main", { currentTab: "audio" }));
router.get("/video", (req, res) => res.render("main", { currentTab: "video" }));
export default router;
