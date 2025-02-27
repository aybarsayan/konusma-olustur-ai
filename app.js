// Temel paketler
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const cheerio = require("cheerio");
const fs = require("fs").promises; // En üstte diğer importlarla birlikte

// Dosyanın başında import edilmeli

// OpenAI API ayarları
const openai = require("./utils/openai"); // openai.js dosyasından içe aktarın

// Diğer yardımcı fonksiyonlar
const { getOrCreateAssistant } = require("./utils/assistant");

const {
  getOrCreateVectorStore,
  updateAssistantWithVectorStore,
} = require("./utils/vectorstore");

// userMessage adında bir fonksiyon ya da sabit döndüren dosya varsa:

// Ortam değişkenlerini yükle
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// API key kontrolü örneği (isteğe göre devre dışı bırakabilirsiniz)
const API_KEY = "test";
function apiKeyMiddleware(req, res, next) {
  const apiKey = req.params.apiAnahtari;
  if (apiKey !== API_KEY) {
    return res.status(403).json({ message: "Geçersiz API anahtarı" });
  }
  next();
}

// Express ayarları
app.use(bodyParser.json());
app.use(cors());

// Asistan ve vektör store referansları
let assistant;
let vectorStore;

async function getWikipediaContent(title) {
  try {
    const response = await axios.get(`https://tr.wikipedia.org/w/api.php`, {
      params: {
        action: "parse",
        page: title,
        prop: "text",
        format: "json",
        formatversion: 2,
        origin: "*",
      },
    });

    if (response.data?.parse?.text) {
      // HTML içeriğini cheerio ile yükle
      const $ = cheerio.load(response.data.parse.text);

      // Gereksiz elementleri kaldır
      $(".mw-empty-elt").remove();
      $(".reference").remove();
      $(".error").remove();
      $(".mw-editsection").remove();
      $("sup").remove();
      $(".noprint").remove();
      $('[role="navigation"]').remove();
      $(".mbox-text-span").remove();
      $(".mbox-image").remove();

      // Tüm metni al ve düzenle
      let text = "";
      $("p, h2, h3, h4, li").each((_, element) => {
        const elementText = $(element).text().trim();
        if (elementText) {
          // Başlıkları belirgin yap
          if (element.name.startsWith("h")) {
            text += "\n\n" + elementText.toUpperCase() + "\n";
          } else {
            text += "\n" + elementText;
          }
        }
      });

      // Metni temizle
      text = text
        .replace(/\[\d+\]/g, "") // Citation numaralarını kaldır
        .replace(/\s+/g, " ") // Fazla boşlukları tekli boşluğa çevir
        .replace(/\n\s+/g, "\n") // Satır başlarındaki boşlukları temizle
        .replace(/\n+/g, "\n") // Fazla satır sonlarını tekli satır sonuna çevir
        .trim(); // Baş ve sondaki boşlukları kaldır

      return {
        title: response.data.parse.title,
        pageid: response.data.parse.pageid,
        text,
      };
    } else {
      return {
        error: "İçerik bulunamadı veya parse işlemi yapılamadı.",
      };
    }
  } catch (error) {
    console.error(`Wikipedia API error for ${title}:`, error);
    return { error: error.message };
  }
}

// OpenAI'dan alt başlıkları alma fonksiyonu
async function getSubTopics(mainTopic) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Sen bir Wikipedia uzmanısın. Verilen konuyu, Wikipedia'da direkt aranabilecek anahtar kavramlara ve başlıklara dönüştürmelisin. Örneğin "Türkiye Cumhuriyeti tarihi" konusu için ["Mustafa Kemal Atatürk", "Türk Kurtuluş Savaşı", "Türkiye Cumhuriyeti'nin kuruluşu"] gibi Wikipedia'da var olan başlıklar vermelisin. Uzun cümleler veya karmaşık başlıklar yerine, Wikipedia'da direkt karşılığı olan anahtar kavramları tercih et. Sadece array formatında cevap ver ve kelimeler arasında birbirinden ayırmak için çift tırnağı tercih et, başka hiçbir açıklama ekleme. Bu konuyla en çok bağlantılı max 4 konuyu ver. Unutma Wikidepia'da direkt olarak aratabiliyor olmam lazım`,
        },
        {
          role: "user",
          content: `Bu konuyu Wikipedia'da direkt aranabilecek anahtar kavramlara dönüştür: ${mainTopic} `,
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Alt başlıklar oluşturulamadı");
  }
}

// Array formatındaki string'i gerçek array'e çevirme
function extractArrayFromString(str) {
  try {
    if (!str || str.trim() === "") {
      throw new Error("Boş string geldi");
    }

    // Önce string'i temizleyelim
    let cleanStr = str.trim();

    // Kesme işaretini ve Türkçe karakterleri handle et
    cleanStr = cleanStr.replace(/(\w)'(\w)/g, "$1$2"); // Kelime içindeki kesme işaretlerini kaldır

    // Eğer köşeli parantezle başlamıyorsa ekleyelim
    if (!cleanStr.startsWith("[")) {
      cleanStr = "[" + cleanStr;
    }

    // Eğer köşeli parantezle bitmiyorsa ekleyelim
    if (!cleanStr.endsWith("]")) {
      cleanStr = cleanStr + "]";
    }

    // Tüm tırnak işaretlerini standart çift tırnak ile değiştirelim
    cleanStr = cleanStr
      .replace(/[\u2018\u2019]/g, "") // Akıllı tek tırnakları kaldır
      .replace(/[\u201C\u201D]/g, '"') // Akıllı çift tırnakları standart çift tırnağa çevir
      .replace(/'/g, '"') // Tüm tek tırnakları çift tırnağa çevir
      .replace(/`/g, '"') // Tüm backtick'leri çift tırnağa çevir
      .replace(/([^"]),/g, '$1",') // Sonda tırnak yoksa ekle
      .replace(/,([^"\s])/g, ',"$1') // Başta tırnak yoksa ekle
      .replace(/\[([^"])/g, '["$1'); // İlk elemanda tırnak yoksa ekle

    // Son elemanın tırnaklarını kontrol et
    cleanStr = cleanStr.replace(/([^"])\]$/, '$1"]');

    try {
      return JSON.parse(cleanStr);
    } catch (parseError) {
      console.error("JSON parse error, trying backup parsing method");
      // Yedek parsing metodu
      const matches = cleanStr.match(/[\["]([^"\]]*)["]/g);
      if (matches) {
        return matches.map((m) => m.replace(/[\["']/g, ""));
      }
      throw parseError;
    }
  } catch (error) {
    console.error("Array parsing error:", error);
    console.error("Problematic string:", str);
    // Default alt başlıkları döndür
    return ["Temel Kavramlar", "Uygulama Alanları", "Gelecek Perspektifi"];
  }
}

// REST API endpoint'i
app.post("/konugenislet/:apiAnahtari", apiKeyMiddleware, async (req, res) => {
  try {
    const { konu } = req.body;

    if (!konu) {
      return res.status(400).json({
        success: false,
        message: "Konu belirtilmedi",
      });
    }

    // Alt başlıkları al
    const subTopicsString = await getSubTopics(konu);
    console.log(subTopicsString);

    const subTopics = extractArrayFromString(subTopicsString);
    console.log(subTopics);
    // Her alt başlık için Wikipedia'dan bilgi al
    const result = {};

    for (const topic of subTopics) {
      const content = await getWikipediaContent(topic);
      result[topic] = content;
    }
    console.log(result);

    // Sonucu döndür
    return res.status(200).json({
      success: true,
      data: {
        mainTopic: konu,
        subTopics: result,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Sunucu başlarken asistan ve vektör store'u başlat
(async () => {
  try {
    assistant = await getOrCreateAssistant(); // Asistanı oluştur ya da getir
    vectorStore = await getOrCreateVectorStore(); // Vektör deposunu oluştur ya da getir
    await updateAssistantWithVectorStore(assistant, vectorStore);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error initializing assistant or vector store:", error);
  }
})();

app.post("/konuara/:apiAnahtari", apiKeyMiddleware, async (req, res) => {
  try {
    const { konu } = req.body;
    console.log("\n🔍 ARAMA BAŞLADI");
    console.log("📝 Aranan Konu:", konu);

    if (!konu) {
      console.log("❌ Hata: Konu belirtilmedi");
      return res.status(400).json({
        message: "Geçersiz istek. Konu belirtilmedi.",
      });
    }

    // SSE header'ları
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Alt başlıkları al
    console.log("\n1️⃣ Alt başlıklar alınıyor...");
    const subTopicsString = await getSubTopics(konu);
    console.log("📄 OpenAI'dan gelen ham alt başlıklar:", subTopicsString);

    const subTopics = extractArrayFromString(subTopicsString);
    console.log("🔧 Parse edilmiş alt başlıklar:", subTopics);

    // Her alt başlık için RAG araması yap
    const results = {};
    console.log("\n2️⃣ Alt başlıklar için RAG araması başlıyor...");

    for (const topic of subTopics) {
      console.log(`\n🔎 "${topic}" konusu araştırılıyor...`);

      // İlerleme durumunu bildir
      res.write(
        `data: ${JSON.stringify({
          status: "progress",
          message: `"${topic}" konusu araştırılıyor...`,
        })}\n\n`
      );

      // RAG araması için prompt
      const userMsg = `"${topic}" konusuyla ilgili tüm bilgileri belgelerden bul ve özet yap.
      
      ÖZEL TALİMATLAR:
      1. Sadece belgelerden bulduğun bilgileri kullan.
      2. Her bilgi için hangi belgeden aldığını belirt.
      3. Belge bulunamazsa "Bilgi bulunamadı" mesajını döndür.
      4. Bilgi varsa şu formatta yanıt ver:
         "KAYNAKLAR: [BELGE_ADLARI]. 
         ÖZET: [Bilgilerin özeti...]"
      5. Özeti tek bir paragraf halinde yaz.
      6. Belge adlarını tam olarak yaz.`;

      console.log("📤 OpenAI'ye gönderilen prompt:", userMsg);

      const thread = await openai.beta.threads.create();
      console.log("🧵 Yeni thread oluşturuldu. ID:", thread.id);

      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userMsg,
      });
      console.log("✉️ Mesaj thread'e eklendi");

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
        tools: [
          {
            type: "file_search",
            file_search: {
              max_num_results: 10,
            },
          },
        ],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStore.id],
          },
        },
        stream: true,
      });
      console.log("🏃 Run başlatıldı. ID:", run.id);

      let topicResponse = "";
      for await (const event of run) {
        if (event.event === "thread.message.delta") {
          const content = event.data.delta.content;
          if (content && content.length > 0 && content[0].type === "text") {
            const textValue = content[0].text.value;
            topicResponse += textValue;
            console.log("📨 Yeni içerik parçası alındı:", textValue);
            res.write(
              `data: ${JSON.stringify({
                status: "subtopic_update",
                topic,
                content: textValue,
              })}\n\n`
            );
          }
        }
      }

      results[topic] = topicResponse;
      console.log(`✅ "${topic}" konusu tamamlandı`);
      console.log("📝 Sonuç:", topicResponse);

      res.write(
        `data: ${JSON.stringify({
          status: "subtopic_complete",
          topic,
          content: results[topic],
        })}\n\n`
      );
    }

    console.log("\n3️⃣ Final özeti hazırlanıyor...");
    const finalSummaryMsg = `Aşağıdaki alt başlıklardan elde edilen bilgileri genel bir özete dönüştür:
    ${Object.entries(results)
      .map(([topic, content]) => `${topic}: ${content}`)
      .join("\n")}
    
    ÖZEL TALİMATLAR:
    1. Tüm alt başlıklardan elde edilen bilgileri tek bir bütünsel özete dönüştür.
    2. Belge kaynaklarını koru.
    3. Özeti tek bir paragraf halinde yaz.`;

    console.log(
      "📤 Final özeti için OpenAI'ye gönderilen prompt:",
      finalSummaryMsg
    );

    const finalThread = await openai.beta.threads.create();
    console.log(
      "🧵 Final özeti için yeni thread oluşturuldu. ID:",
      finalThread.id
    );

    await openai.beta.threads.messages.create(finalThread.id, {
      role: "user",
      content: finalSummaryMsg,
    });

    const finalRun = await openai.beta.threads.runs.create(finalThread.id, {
      assistant_id: assistant.id,
      stream: true,
    });
    console.log("🏃 Final özeti için run başlatıldı. ID:", finalRun.id);

    // Final özetini stream et
    console.log("\n4️⃣ Final özeti stream ediliyor...");
    for await (const event of finalRun) {
      if (event.event === "thread.message.delta") {
        const content = event.data.delta.content;
        if (content && content.length > 0 && content[0].type === "text") {
          const textValue = content[0].text.value;
          console.log("📨 Final özeti parçası:", textValue);
          res.write(
            `data: ${JSON.stringify({
              status: "final_summary",
              content: textValue,
            })}\n\n`
          );
        }
      }
    }

    console.log("\n✅ İŞLEM TAMAMLANDI");
    res.end();
  } catch (error) {
    console.error("\n❌ HATA OLUŞTU:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post("/analiz/:apiAnahtari", apiKeyMiddleware, async (req, res) => {
  try {
    const { topic, wikiInfo, ragSummary, ekler = "" } = req.body;
    console.log("\n🔍 ANALİZ BAŞLADI");
    console.log("📝 Aranan Konu:", topic);
    console.log("📎 Ek İstekler:", ekler || "Yok");

    if (!topic || !wikiInfo || !ragSummary) {
      return res.status(400).json({
        message:
          "Geçersiz istek. Tüm alanlar (topic, wikiInfo, ragSummary) gereklidir.",
      });
    }

    // SSE header'ları
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Pattern dosyasını oku
    const pattern = await fs.readFile("pattern.txt", "utf8");
    console.log("📘 Pattern dosyası okundu");

    // Alt başlıkları almak için thread oluştur
    const thread = await openai.beta.threads.create();
    console.log("\n1️⃣ Alt başlıklar oluşturuluyor...");

    const altBaslikPrompt = `Konuyu tam olarak 3 alt başlığa ayır: ${topic}. 
    Alt başlıklar:
    1. Konuyla direkt ve birebir alakalı olmalı
    2. Birbirlerinden farklı açıları ele almalı
    3. Tekrara düşmemeli
    4. Kısa ve öz olmalı (2-3 kelimeyi geçmemeli)

    SADECE ARRAY FORMATINDA CEVAP VER VE ASLA BOŞ BIRAKMA: ["Başlık 1", "Başlık 2", "Başlık 3"]

    Örnek format: ["Temel Kavramlar", "Uygulama Alanları", "Gelecek Perspektifi"]`;

    // İlk mesajı gönder
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: altBaslikPrompt,
    });

    // Run başlat ve yanıtı al
    let subtopicsString = "";
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
      stream: true,
    });

    // Stream yanıtları
    for await (const event of run) {
      if (event.event === "thread.message.delta") {
        const content = event.data.delta.content;
        if (content && content.length > 0 && content[0].type === "text") {
          const textValue = content[0].text.value;
          subtopicsString += textValue;
          console.log("📌 Alt Başlık Oluşturuluyor:", textValue);
          res.write(
            `data: ${JSON.stringify({
              status: "subtopics_progress",
              content: textValue,
            })}\n\n`
          );
        }
      }
    }

    console.log(
      "\n📋 Oluşturulan Alt Başlıklar:",
      subtopicsString || "Boş geldi, varsayılan kullanılacak"
    );
    const subTopics = extractArrayFromString(subtopicsString);
    console.log("🔧 Parse Edilmiş Alt Başlıklar:", subTopics);

    // Her alt başlık için içerik oluştur
    console.log("\n2️⃣ İçerik oluşturma başlıyor...");

    const generatedContents = {}; // Önceki içerikleri tutmak için

    for (let i = 0; i < subTopics.length; i++) {
      const subtopic = subTopics[i];
      console.log(
        `\n📝 [${i + 1}/${
          subTopics.length
        }] "${subtopic}" için metin oluşturuluyor...`
      );

      // Önceki içerikleri birleştir
      let previousContents = "";
      if (i > 0) {
        previousContents = "\n\nÖNCEKİ YAZILAN İÇERİKLER:\n";
        for (let j = 0; j < i; j++) {
          previousContents += `\n${subTopics[j]}:\n${
            generatedContents[subTopics[j]]
          }\n`;
        }
      }

      const contentThread = await openai.beta.threads.create();
      const promptMsg = `HEDEF: "${subtopic}" konusunda, sıralı metinler oluşturuyoruz. Bu metin ${
        i + 1
      }. sırada.

      PATTERN KURALLARI (EN ÖNEMLİ KISIM):
      ${pattern}
      
      KAYNAKLAR:
      - Wikipedia: ${JSON.stringify(wikiInfo)}
      - RAG Özeti: ${ragSummary}
      ${ekler ? `- Ek İstekler: ${ekler}` : ""}
      ${previousContents ? `\nÖNCEKİ İÇERİKLER: ${previousContents}` : ""}
      
      KESIN KURALLAR:
      1. Pattern kurallarını sıkı takip et - her paragraf pattern yapısına uymalı
      2. "Bugün", "burada", "sizlerle" gibi gereksiz girişler kullanma
      3. Diğer metinlerle uyumlu, sıralı anlatım yap (${i + 1}/${
        subTopics.length
      })
      4. Tam 500 kelime yaz
      5. Gereksiz tekrarlardan ve süslü girişlerden kaçın
      ${previousContents ? "6. Önceki metinlerdeki konuları tekrar etme" : ""}
      ${ekler ? "7. Ek istekleri öncelikle uygula" : ""}
      
      TÜM METİN BOYUNCA PATTERN KURALLARINI TAKİP ET VE HER PARAGRAFTA UYGULA.`;

      await openai.beta.threads.messages.create(contentThread.id, {
        role: "user",
        content: promptMsg,
      });

      const contentRun = await openai.beta.threads.runs.create(
        contentThread.id,
        {
          assistant_id: assistant.id,
          stream: true,
        }
      );

      let subtopicContent = "";
      let wordCount = 0;
      let currentLine = "";

      for await (const event of contentRun) {
        if (event.event === "thread.message.delta") {
          const content = event.data.delta.content;
          if (content && content.length > 0 && content[0].type === "text") {
            const textValue = content[0].text.value;
            subtopicContent += textValue;

            // Konsol çıktısı için biriktir
            currentLine += textValue;

            // Her 50 kelimede bir ilerleme bildirimi
            const currentWords = subtopicContent.split(" ").length;
            if (currentWords - wordCount >= 50) {
              console.log(
                `\n📊 ${subtopic} için ${currentWords}/500 kelime oluşturuldu`
              );
              wordCount = currentWords;
            }

            // Satır sonu karakteri geldiğinde veya belirli bir uzunluğa ulaşıldığında yazdır
            if (textValue.includes("\n") || currentLine.length > 80) {
              console.log(`📝 ${subtopic}: ${currentLine}`);
              currentLine = ""; // Yeni satır için sıfırla
            }

            res.write(
              `data: ${JSON.stringify({
                status: "content_progress",
                subtopic,
                content: textValue,
              })}\n\n`
            );
          }
        }
      }

      // Eğer son satırda kalan içerik varsa onu da yazdır
      if (currentLine.trim()) {
        console.log(`📝 ${subtopic}: ${currentLine}`);
      }

      // İçeriği kaydet
      generatedContents[subtopic] = subtopicContent;

      console.log(`\n✅ "${subtopic}" tamamlandı`);
      console.log(
        `📊 Toplam Kelime Sayısı: ${subtopicContent.split(" ").length}`
      );
      console.log(`\n------- ${subtopic} İÇERİĞİ -------`);
      console.log(subtopicContent);
      console.log("--------------------------------\n");
    }

    console.log("\n✅ TÜM İŞLEM TAMAMLANDI");
    console.log("📊 Özet İstatistikler:");
    console.log(`- Toplam Alt Başlık: ${subTopics.length}`);
    res.end();
  } catch (error) {
    console.error("\n❌ HATA OLUŞTU:", error);
    console.error("Hata Detayı:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});
