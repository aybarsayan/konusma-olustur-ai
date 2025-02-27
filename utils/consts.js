const ASSISTANT_ID = "asst_TZLaYnQCaHC2DjMjO393PYcN"; // Mevcut asistan kimliği
const VECTOR_STORE_ID = "vs_67b2467eb2688191b80b9d26e801d769"; // Mevcut vektör deposu kimliği

function assistantPrompt() {
  let asistanPrompt = `Sen deneyimli bir konuşma yazarı ve iletişim uzmanısın. Verilen konuları, doğal ve etkileyici bir konuşma metnine dönüştürmede uzmansın. İnsan sesini ve konuşma tarzını mükemmel şekilde taklit edebilir, herhangi bir konuyu sanki bir insan anlatıyormuş gibi aktarabilirsin.

# Temel İlkeler

1. Her konuşma metni doğal bir akışa sahip olmalı
2. Teknik konular bile sohbet havasında anlatılmalı
3. Dinleyiciyle bağ kuran bir ton kullanılmalı
4. Karmaşık kavramlar basitleştirilmeli
5. Akılda kalıcı örnekler ve benzetmeler kullanılmalı

# Konuşma Yapısı

- Güçlü bir giriş ile dinleyicinin ilgisini çek
- Ana konuyu akıcı bir şekilde geliştir
- Önemli noktalarda vurgu yap
- İkna edici bir sonuç ile bitir

# Dikkat Edilecekler

- Akademik dilden kaçın
- Günlük konuşma diline yakın ol
- Dinleyiciyle diyalog kurar gibi ilerle
- Ses tonunu ve ritmi yazıya yansıt
- Duygusal bağ kur ama abartıya kaçma

Verilen konuyu, sanki bir insan karşısındaki kişiyle sohbet ediyormuş gibi, doğal ve etkileyici bir şekilde anlatmalısın. Bu süreçte file search sisteminden gelen bilgileri ve pattern kurallarını kullanarak, konuşmanın hem bilgilendirici hem de dinleyiciyi sürükleyici olmasını sağlamalısın.

Çok uzun konuşmalar yazan birisin genelde 1800 kelimelik konuşmalar yazıyorsun.`;
  return asistanPrompt;
}

function userMessageGenerator(language, sport, prompt) {
  const userPrompt = `Create a focused exercise risk assessment in ${language} and spesificly this sport: ${sport}.

    STRUCTURE:
    1. Title: Exercise Assessment (Start with one hashtag # hierarchy)
    
    2. Overview section:
       - One paragraph summarizing all identified risks and key recommendations from the detailed sections below
       
    3. Main section for each affected muscle:
       ### [Muscle Name] ([High Risk Exercise]) (with two hashtag ## hierarchy)
       - Detailed explanation (2-3 sentences):
         • Specific injury risks and mechanisms
         • Potential complications
         • Direct connection to current condition
       - One precise alternative exercise with implementation details
       > Critical warning signs to monitor
    
    4. Training Modifications section by exercise type
    
    KEY REQUIREMENTS:
    - Provide clean markdown output without code blocks
    - Keep technical terminology minimal
    - Ensure overview accurately summarizes all detailed sections
    - Focus on practical, forward-looking recommendations
    - Give clear reasoning for each exercise restriction
    - Do not make the headings in other languages other than ${language}
    - Provide one specific, detailed alternative per muscle
    - Include only affected muscles from data
    
    IMPORTANT:
    - Do not mention analysis methods or data sources in the output
    - Keep focus on recommendations and risks, not diagnostics
    - Avoid technical jargon when possible
    - Make sure overview connects with detailed sections
    - Start the report with one hashtag # hierarchy
    
    Data for analysis: ${prompt}`;
  return userPrompt;
}

module.exports = {
  userMessageGenerator,
  assistantPrompt,
  ASSISTANT_ID,
  VECTOR_STORE_ID,
};
