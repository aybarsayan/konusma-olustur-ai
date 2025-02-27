"use client";

import React, { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, Check, Info, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return { copied, copy };
};

interface SubTopic {
  title: string;
  text: string;
}

interface ApiResponse {
  success: boolean;
  data: {
    mainTopic: string;
    subTopics: {
      [key: string]: {
        title?: string;
        text?: string;
        error?: string;
      };
    };
  };
}

interface FinalData {
  selectedTopics: {
    title: string;
    content: string | undefined;
  }[];
  wikiInfo: {
    success: boolean;
    data: {
      mainTopic: string;
      subTopics: {
        [key: string]: {
          title?: string;
          text?: string;
        };
      };
    };
  };
  ragData: string | null;
}

interface AnalysisRequest {
  topic: string;
  wikiInfo: {
    success: boolean;
    data: {
      mainTopic: string;
      subTopics: {
        [key: string]: {
          title?: string;
          text?: string;
        };
      };
    };
  };
  ragSummary: string;
  ekler?: string;
}

interface SelectedData {
  selectedTopics: {
    title: string;
    content: string | undefined;
  }[];
  wikiInfo: {
    success: boolean;
    data: {
      mainTopic: string;
      subTopics: {
        [key: string]: {
          title?: string;
          text?: string;
        };
      };
    };
  };
}

interface RagResponse {
  status: string;
  topic?: string;
  content?: string;
  message?: string;
  error?: string;
}
const TopicForm: React.FC = () => {
  const { copied, copy } = useCopyToClipboard();
  const [step, setStep] = useState<number>(1);
  const [topic, setTopic] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [subtopics, setSubtopics] = useState<SubTopic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [expandedCards, setExpandedCards] = useState<string[]>([]);
  const [selectedData, setSelectedData] = useState<SelectedData | null>(null);
  const [ragData, setRagData] = useState<string>("");
  const [ragExpanded, setRagExpanded] = useState(false);
  const [ragSelected, setRagSelected] = useState(false);
  const [finalData, setFinalData] = useState<FinalData | null>(null);
  const [additionalPrompt, setAdditionalPrompt] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!topic.trim()) {
      setError("Lütfen bir konu giriniz");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:3000/konugenislet/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ konu: topic }),
      });

      const data: ApiResponse = await response.json();

      if (data.success && data.data.subTopics) {
        const topics = Object.keys(data.data.subTopics).map((key) => ({
          title: key,
          text: data.data.subTopics[key].text || "İçerik bulunamadı",
        }));
        setSubtopics(topics);
        setStep(2);
      } else {
        setError("Veri alınamadı");
      }
    } catch (err) {
      setError("Bir hata oluştu: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = (title: string) => {
    if (selectedTopics.includes(title)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== title));
    } else {
      setSelectedTopics([...selectedTopics, title]);
    }
  };

  const handleExpand = (e: React.MouseEvent, title: string) => {
    e.stopPropagation(); // Kartın seçilmesini engelle
    if (expandedCards.includes(title)) {
      setExpandedCards(expandedCards.filter((t) => t !== title));
    } else {
      setExpandedCards([...expandedCards, title]);
    }
  };

  const handleNext = () => {
    const data: SelectedData = {
      selectedTopics: selectedTopics.map((topic) => {
        const topicData = subtopics.find((st) => st.title === topic);
        return {
          title: topic,
          content: topicData?.text || "",
        };
      }),
      wikiInfo: {
        success: true,
        data: {
          mainTopic: topic,
          subTopics: subtopics.reduce((acc, curr) => {
            acc[curr.title] = {
              title: curr.title,
              text: curr.text,
            };
            return acc;
          }, {} as { [key: string]: { title: string; text: string } }),
        },
      },
    };

    console.log("Step 2 Seçimleri:", JSON.stringify(data, null, 2));
    setSelectedData(data);
    setStep(3);
  };

  const generateAnalysis = async () => {
    setIsGenerating(true);
    setAnalysisResult("");

    const requestData: AnalysisRequest = {
      topic,
      wikiInfo: selectedData?.wikiInfo || {
        success: true,
        data: {
          mainTopic: topic,
          subTopics: {},
        },
      },
      ragSummary: finalData?.ragData || "",
      ekler: additionalPrompt,
    };

    try {
      const response = await fetch("http://localhost:3000/analiz/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Response body is null");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                // Her karakteri tek tek ekleyelim
                for (const char of data.content) {
                  await new Promise((resolve) => setTimeout(resolve, 10));
                  setAnalysisResult((prev) => prev + char);
                }
              }
            } catch (err) {
              console.error("Parse error:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Analiz oluşturulurken bir hata oluştu: " + err);
    } finally {
      setIsGenerating(false);
    }
  };

  const startRagSearch = async () => {
    setLoading(true);
    setRagData("");

    try {
      const response = await fetch("http://localhost:3000/konuara/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ konu: topic }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Response body is null");
      }

      let isFinalSummary = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: RagResponse = JSON.parse(line.slice(6));

              // Final özet geldiğinde önceki içeriği temizle
              if (data.status === "final_summary") {
                if (!isFinalSummary) {
                  setRagData(""); // İlk final_summary chunk'ında içeriği temizle
                  isFinalSummary = true;
                }

                if (data.content) {
                  // Her karakteri tek tek ekleyelim
                  for (const char of data.content) {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    setRagData((prev) => prev + char);
                  }
                }
              }
              // Final özet değilse ve önceki içerikse
              else if (data.content && !isFinalSummary) {
                for (const char of data.content) {
                  await new Promise((resolve) => setTimeout(resolve, 10));
                  setRagData((prev) => prev + char);
                }
              }
            } catch (err) {
              console.error("Parse error:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Veri alınırken bir hata oluştu: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRagNext = () => {
    if (!selectedData) return; // Early return if no selectedData

    const finalResult: FinalData = {
      selectedTopics: selectedData.selectedTopics,
      wikiInfo: selectedData.wikiInfo,
      ragData: ragSelected ? ragData : null,
    };

    console.log("Final Data:", JSON.stringify(finalResult, null, 2));
    setFinalData(finalResult);
    setStep(4);
  };

  const handleRagSkip = () => {
    if (!selectedData) return; // Early return if no selectedData

    const finalResult: FinalData = {
      selectedTopics: selectedData.selectedTopics,
      wikiInfo: selectedData.wikiInfo,
      ragData: null,
    };

    console.log("Final Data (Skipped):", JSON.stringify(finalResult, null, 2));
    setFinalData(finalResult);
    setStep(4);
  };

  if (step === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="w-full max-w-lg p-6 space-y-6">
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-center text-gray-900">
                Konuşma Metninin Konusunu Giriniz
              </h2>
              <div className="space-y-2">
                <label
                  htmlFor="topic"
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  Konu giriniz
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Konuşma konusunu buraya giriniz</p>
                        <p>Örnek: Yapay Zeka, Teknoloji, Bilim vb.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <Input
                  id="topic"
                  type="text"
                  value={topic}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTopic(e.target.value)
                  }
                  placeholder="Örn: Yapay Zeka"
                  className="w-full transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <motion.p
                  className="text-sm text-red-600"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.p>
              )}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full h-12"
                >
                  {loading ? (
                    <motion.div
                      className="flex items-center justify-center space-x-2"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Yükleniyor...</span>
                    </motion.div>
                  ) : (
                    "Devam Et"
                  )}
                </Button>
              </motion.div>
            </motion.div>
          </Card>
        </motion.div>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-10 flex items-center justify-center space-x-4"
            >
              <div className="relative w-16 h-16">
                <motion.div
                  className="absolute inset-0 border-4 border-blue-500 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                    borderWidth: [4, 2, 4],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
              <motion.p
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-blue-600 font-medium"
              >
                Alt konuşma başlıkları oluşturuluyor
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
  if (step === 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 flex flex-col justify-center"
      >
        <div className="w-full max-w-6xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-4"
          >
            <h2 className="text-3xl font-bold text-gray-900">
              Alt Konuları Seçiniz
            </h2>
            <div className="flex justify-center items-center gap-2">
              <p className="text-gray-600">
                Konuşma metnine dahil edilecek konuları seçin
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>
                      Birden fazla konu seçebilirsiniz. Seçtiğiniz her konu
                      konuşmaya dahil edilecektir.
                    </p>
                    <p className="mt-2">
                      Detayları görmek için kartların sağ üst köşesindeki oku
                      kullanabilirsiniz.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center"
          >
            {subtopics.map((subtopic, index) => (
              <motion.div
                key={subtopic.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="w-full"
              >
                <Card
                  className={`w-full max-w-md p-6 transition-all relative cursor-pointer 
                    ${
                      selectedTopics.includes(subtopic.title)
                        ? "ring-2 ring-blue-500 bg-blue-50 shadow-lg"
                        : "hover:shadow-lg"
                    }`}
                  onClick={() => handleTopicSelect(subtopic.title)}
                >
                  <div className="relative">
                    <h3 className="font-bold text-lg mb-2 pr-8 text-gray-900">
                      {subtopic.title}
                    </h3>
                    <motion.button
                      onClick={(e) => handleExpand(e, subtopic.title)}
                      className="absolute top-1 right-1 p-1 text-gray-500 hover:text-gray-700 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-300 ${
                          expandedCards.includes(subtopic.title)
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </motion.button>
                    <motion.div
                      className={`overflow-hidden transition-all duration-300`}
                      initial={false}
                      animate={{
                        height: expandedCards.includes(subtopic.title)
                          ? "auto"
                          : "6rem",
                      }}
                    >
                      <p className="text-sm text-gray-600 pr-2">
                        {subtopic.text}
                      </p>
                    </motion.div>
                    {!expandedCards.includes(subtopic.title) &&
                      subtopic.text.length > 200 && (
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white pointer-events-none" />
                      )}
                  </div>

                  {selectedTopics.includes(subtopic.title) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 left-2 w-4 h-4 bg-blue-500 rounded-full"
                    />
                  )}
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex justify-center mt-8"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleNext}
                disabled={selectedTopics.length === 0}
                className="px-8 py-2 h-12 text-lg"
              >
                {selectedTopics.length === 0 ? (
                  "Lütfen en az bir konu seçin"
                ) : (
                  <span className="flex items-center gap-2">
                    İleri
                    <motion.span
                      animate={{ x: [0, 5, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      →
                    </motion.span>
                  </span>
                )}
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-gray-500 mt-4"
          >
            {selectedTopics.length > 0
              ? `${selectedTopics.length} konu seçildi`
              : "Henüz konu seçilmedi"}
          </motion.div>
        </div>
      </motion.div>
    );
  }
  if (step === 3) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 flex flex-col justify-center"
      >
        <div className="w-full max-w-6xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-4"
          >
            <h2 className="text-3xl font-bold text-gray-900">
              Konuşma Metnine Eklemek İçin Önceki Konuşmalar Kaynak Olarak
              Kullanılsın mı?
            </h2>
            <div className="flex justify-center items-center gap-2">
              <p className="text-gray-600">
                Daha detaylı konuşma metni için veritabanı araması
                yapabilirsiniz
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>
                      Veritabanı araması, konuşma metnini zenginleştirmek için
                      ek kaynaklar sağlar.
                    </p>
                    <p className="mt-2">
                      Bu işlem biraz zaman alabilir ancak daha kapsamlı sonuçlar
                      elde edersiniz.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </motion.div>

          {!ragData && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center gap-4"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={startRagSearch}
                  className="px-6 py-2 h-12 text-lg bg-blue-600 hover:bg-blue-700"
                >
                  <span className="flex items-center gap-2">
                    Evet, Aransın
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      🔍
                    </motion.span>
                  </span>
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={handleRagSkip}
                  variant="outline"
                  className="px-6 py-2 h-12 text-lg"
                >
                  Hayır, Atla →
                </Button>
              </motion.div>
            </motion.div>
          )}

          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center space-y-6"
              >
                <div className="relative">
                  <motion.div
                    className="w-16 h-16 border-4 border-blue-500 rounded-full"
                    animate={{
                      rotate: 360,
                      borderRadius: ["50%", "40%", "50%"],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: "linear",
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 border-t-4 border-blue-300 rounded-full"
                    animate={{ rotate: -360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "linear",
                    }}
                  />
                </div>
                <motion.p
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-blue-600 font-medium text-lg"
                >
                  Veritabanında Aranıyor...
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {ragData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="w-full p-6">
                  <div className="relative">
                    <h3 className="font-bold text-lg mb-4 pr-8 text-gray-900 flex items-center gap-2">
                      Veritabanı Sonuçları
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="inline-block text-green-500 text-sm"
                      >
                        ✓
                      </motion.span>
                    </h3>
                    <motion.button
                      onClick={() => setRagExpanded(!ragExpanded)}
                      className="absolute top-1 right-1 p-1 text-gray-500 hover:text-gray-700 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-300 ${
                          ragExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </motion.button>
                    <motion.div
                      className="overflow-hidden"
                      initial={false}
                      animate={{
                        height: ragExpanded ? "auto" : "6rem",
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-sm text-gray-600 pr-2 whitespace-pre-wrap font-mono">
                        {ragData}
                      </p>
                    </motion.div>
                    {!ragExpanded && ragData.length > 200 && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white pointer-events-none" />
                    )}
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4 flex justify-between items-center"
                  >
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <motion.input
                        type="checkbox"
                        checked={ragSelected}
                        onChange={(e) => setRagSelected(e.target.checked)}
                        className="form-checkbox h-5 w-5 text-blue-600 transition duration-150 ease-in-out group-hover:scale-110"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900">
                        Bu sonuçları kullan
                      </span>
                    </label>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={handleRagNext}
                        disabled={loading}
                        className="px-6 h-10"
                      >
                        İleri
                        <motion.span
                          animate={{ x: [0, 5, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="ml-1"
                        >
                          →
                        </motion.span>
                      </Button>
                    </motion.div>
                  </motion.div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }
  if (step === 4) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4"
      >
        <div className="w-full max-w-6xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-2"
          >
            <h2 className="text-3xl font-bold text-gray-900">
              Konuşma Metni Oluştur
            </h2>
            <p className="text-gray-600">
              Ek notlar ekleyerek konuşma metnini özelleştirebilirsiniz
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-lg font-medium text-gray-900">
                    Eklemek İstediğiniz Notlar
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Konuşma metnine eklemek istediğiniz özel notları
                          buraya yazabilirsiniz.
                        </p>
                        <p>
                          Örneğin: Hedef kitle, konuşma tonu, vurgulanacak
                          noktalar vb.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <textarea
                  value={additionalPrompt}
                  onChange={(e) => setAdditionalPrompt(e.target.value)}
                  className="w-full min-h-[120px] p-4 rounded-lg border border-gray-200 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             resize-y text-gray-800 placeholder-gray-400
                             transition-all duration-200"
                  placeholder="Konuşma metninde dikkate alınmasını istediğiniz özel notlarınızı buraya yazabilirsiniz..."
                />

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={generateAnalysis}
                    disabled={isGenerating}
                    className="w-full md:w-auto md:min-w-[160px] h-12"
                  >
                    {isGenerating ? (
                      <motion.span
                        className="flex items-center justify-center space-x-2"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Konuşma Metni Oluşturuluyor...</span>
                      </motion.span>
                    ) : (
                      <span className="flex items-center justify-center space-x-2">
                        <span>Konuşma Metnini Oluştur</span>
                      </span>
                    )}
                  </Button>
                </motion.div>
              </div>
            </Card>
          </motion.div>

          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center space-y-4"
              >
                <div className="relative w-16 h-16">
                  <motion.div
                    className="absolute inset-0 border-4 border-blue-500 rounded-full"
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 180, 360],
                      borderWidth: [4, 2, 4],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
                <motion.p
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-blue-600 font-medium"
                >
                  Konuşma Metni Hazırlanıyor
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {analysisResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="mt-8 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Oluşturulan Konuşma Metni
                      </h3>
                      <div className="flex items-center space-x-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Bu konuşma metni seçtiğiniz konular ve ek
                                talepleriniz doğrultusunda oluşturulmuştur.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copy(analysisResult)}
                          className="flex items-center space-x-1"
                        >
                          {copied ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200 }}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </motion.div>
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <span>{copied ? "Kopyalandı!" : "Kopyala"}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-white">
                    <motion.div
                      className="prose prose-lg max-w-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      {analysisResult.split("\n").map(
                        (paragraph, index) =>
                          paragraph.trim() && (
                            <motion.p
                              key={index}
                              className="mb-4 text-gray-800 leading-relaxed"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 * index }}
                            >
                              {paragraph}
                            </motion.p>
                          )
                      )}
                    </motion.div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  return null;
};

export default TopicForm;
