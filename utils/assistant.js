// utils/assistant.js

const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ASSISTANT_ID, assistantPrompt } = require("./consts");
const openai = require("./openai");

// Asistan oluşturma veya mevcut olanı alma
async function getOrCreateAssistant() {
  if (ASSISTANT_ID) {
    // Mevcut asistanı alın
    try {
      const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
      console.log("Mevcut asistan kullanılıyor:", assistant.id);
      return assistant;
    } catch (error) {
      console.error(
        "Mevcut asistan alınamadı, yeni bir asistan oluşturuluyor..."
      );
    }
  }
  // Yeni bir asistan oluşturun
  const assistant = await openai.beta.assistants.create({
    name: "Sağlık Analist Asistanı",
    instructions: assistantPrompt(),
    model: "gpt-4o",
    tools: [{ type: "file_search" }],
  });
  console.log("Yeni asistan oluşturuldu:", assistant.id);
  return assistant;
}

// Yeni Thread ve Run oluşturma (Stream ve File Search ile)
async function createThreadAndRunWithFileSearch(
  assistantId,
  vectorStoreId,
  userMessage
) {
  try {
    console.log("Creating a thread...");
    const thread = await openai.beta.threads.create();
    console.log("Thread created:", thread.id);

    console.log("Adding a message to the thread...");
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage,
    });

    console.log("Running the thread with file search...");
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      },
      stream: true,
    });

    console.log("Assistant's response:");
    let fullResponse = "";

    for await (const event of run) {
      if (event.event === "thread.message.delta") {
        const content = event.data.delta.content;
        if (content && content.length > 0 && content[0].type === "text") {
          const textValue = content[0].text.value;
          fullResponse += textValue;
          process.stdout.write(textValue);
        }
      } else if (event.event === "thread.run.completed") {
        console.log("\nRun completed");
      } else if (event.event === "thread.run.failed") {
        console.error("\nRun failed:", event.data.last_error);
      }
    }

    console.log("\n\nFull response:");
    console.log(fullResponse);

    return { threadId: thread.id, runId: run.id, response: fullResponse };
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

// Fonksiyonları dışa aktar
module.exports = {
  getOrCreateAssistant,
  createThreadAndRunWithFileSearch, // Yeni eklenen fonksiyon burada export ediliyor
};
