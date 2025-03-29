document.addEventListener("DOMContentLoaded", () => {
  // Tab selection logic
  const tabs = document.querySelectorAll(".generation-tab");
  let selectedType = null;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active state from all tabs
      tabs.forEach((t) => {
        t.classList.remove("tab-active");
        t.classList.add("text-gray-400");
      });

      // Add active state to clicked tab
      tab.classList.add("tab-active");
      tab.classList.remove("text-gray-400");

      // Store selected type
      selectedType = tab.dataset.type;
    });
  });

  // Generate button logic
  const generateBtn = document.getElementById("generate-btn");
  const promptInput = document.getElementById("prompt-input");
  const resultContainer = document.getElementById("result-container");

  // Download functionality
  function downloadContent(content, filename, mimeType) {
    // Create a blob from the content
    const blob = new Blob([content], { type: mimeType });

    // Create a link element
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Add download button functionality
  function addDownloadButton(type, content) {
    // Remove any existing download button
    const existingDownloadBtn = document.getElementById("download-btn");
    if (existingDownloadBtn) {
      existingDownloadBtn.remove();
    }

    // Create download button based on content type
    const downloadBtn = document.createElement("button");
    downloadBtn.id = "download-btn";
    downloadBtn.textContent = "Download";
    downloadBtn.className =
      "mt-2 w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md";

    switch (type) {
      case "text":
        downloadBtn.onclick = () =>
          downloadContent(content, "generated_text.txt", "text/plain");
        break;
      case "image":
        downloadBtn.onclick = () => {
          const link = document.createElement("a");
          link.href = `data:image/png;base64,${content}`;
          link.download = "generated_image.png";
          link.click();
        };
        break;
      case "audio":
        downloadBtn.onclick = () => {
          const link = document.createElement("a");
          link.href = `data:audio/mpeg;base64,${content}`;
          link.download = "generated_audio.mp3";
          link.click();
        };
        break;
      case "video":
        downloadBtn.onclick = () => {
          const link = document.createElement("a");
          link.href = `data:video/mp4;base64,${content}`;
          link.download = "generated_video.mp4";
          link.click();
        };
        break;
    }

    // Append download button after result container
    resultContainer.appendChild(downloadBtn);
  }

  generateBtn.addEventListener("click", async () => {
    const prompt = promptInput.value.trim();

    // Validation: Check if prompt is empty or type not selected
    if (!prompt) {
      // Highlight input field
      promptInput.classList.add("border-red-500", "border-2");
      promptInput.placeholder = "Prompt cannot be empty";

      // Remove red border after 3 seconds
      setTimeout(() => {
        promptInput.classList.remove("border-red-500", "border-2");
        promptInput.placeholder = "Enter your prompt";
      }, 3000);

      return;
    }

    // Validate type selection
    if (!selectedType) {
      alert("Please select a generation type");
      return;
    }

    try {
      const response = await fetch(`/generate-${selectedType}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, type: selectedType }),
      });

      const result = await response.json();

      // Reload the page with the result
      window.location.reload();

      // Add download functionality for the result
      if (result.content) {
        addDownloadButton(result.type, result.content);
      }
    } catch (error) {
      console.error("Generation error:", error);
      alert("Failed to generate content");
    }
  });
});
