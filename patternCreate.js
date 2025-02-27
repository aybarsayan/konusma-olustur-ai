const OpenAI = require("openai");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeText(text) {
  const initialPrompt = `Sen bir kişilik analiz uzmanısın. Bu metni derinlemesine analiz et:

1. Konuşma Yapısı:
- Giriş cümleleri ve selamlaşma tarzı
- Muhatabına hitap şekli
- Cümle geçişleri ve bağlantıları
- Kapanış cümleleri ve veda tarzı

2. Dil ve İfade:
- Sık kullandığı kelimeler ve deyimler
- Cümle uzunlukları ve yapıları
- Vurgu yaptığı noktalar
- Özel terimler ve jargon

3. Düşünce Yapısı:
- Problem çözme yaklaşımı
- Karar verme mekanizması
- Mantık kurgusu
- Analiz şekli

4. Duygusal Özellikler:
- Hassasiyet gösterdiği konular
- Tepki verme biçimleri
- Önemsediği değerler
- Kaçındığı temalar

5. Karakteristik Detaylar:
- Kendine özgü ifadeler
- Konuşma ritmi
- Özel alışkanlıklar
- Tekrar eden davranışlar`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "user", content: initialPrompt + "\n\nMetin:\n" + text },
    ],
  });

  return response.choices[0].message.content;
}

async function mergeAnalysis(newAnalysis, existingPattern) {
  const mergePrompt = `Mevcut Pattern Analizi:
${existingPattern}

Yeni Analiz:
${newAnalysis}

Görev:
1. Bu iki analizi birleştir
2. Mevcut pattern'deki bilgileri koru
3. Yeni analizdeki eksik noktaları ekle
4. Çelişen bilgilerde daha karakteristik olanı seç
5. Gerekirse yeni başlıklar ekle

NOT: Sonuç daha kapsamlı ve detaylı olmalı, önceki bilgiler kaybolmamalı.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: mergePrompt }],
  });

  return response.choices[0].message.content;
}

async function processFiles() {
  try {
    const textDir = "texts";
    const files = await fs.readdir(textDir);
    let currentPattern = "";

    for (const file of files) {
      if (!file.endsWith(".txt")) continue;

      console.log(`Processing ${file}...`);
      const text = await fs.readFile(path.join(textDir, file), "utf-8");

      const newAnalysis = await analyzeText(text);
      currentPattern = currentPattern
        ? await mergeAnalysis(newAnalysis, currentPattern)
        : newAnalysis;

      await fs.writeFile("pattern.txt", currentPattern, "utf-8");
      console.log(`Updated pattern.txt with analysis from ${file}`);
    }

    console.log("Pattern analysis completed for all files.");
  } catch (error) {
    console.error("Error:", error);
  }
}

processFiles();
