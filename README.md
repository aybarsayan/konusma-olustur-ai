# Konuşma Oluşturucu AI

Konuşma Oluşturucu AI, kullanıcının önceki konuşmalarını analiz ederek kişiye özel konuşma metinleri oluşturmayı hedefleyen yenilikçi bir sistemdir. Bu sistem sayesinde, kullanıcılar geçmiş konuşmalarını temel alarak, seçtikleri konu ve alt başlıklar doğrultusunda zengin içerikli ve kişiselleştirilmiş konuşma metinleri elde edebilmektedir.

## Özellikler

- **Kişisel Konuşma Analizi:** Kullanıcının önceki konuşmaları tek tek analiz edilerek, konuşma tarzı ve pattern'i oluşturulur.
- **Konu Seçimi ve Alt Başlık Oluşturma:** Arayüz üzerinden seçilen konuşma konusu için ilgili alt başlıklar otomatik olarak belirlenir.
- **Bilgi Entegrasyonu:** Belirlenen alt başlıklar için Wikipedia'dan ek bilgiler çekilir ve içeriğe entegre edilir.
- **Özel İçerik Eklenmesi:** Kullanıcının geçmiş konuşmalarında ilgili konuya dair metinler mevcutsa, bunlar da sisteme dahil edilerek daha zengin ve özgün bir metin oluşturulur.
- **Hazır Konuşma Metni:** Son aşamada, tüm bilgiler ve kullanıcı tercihleri doğrultusunda kişiye özel, hazır bir konuşma metni üretilir.

## Teknolojiler

- **WikipediaAPI:** Alt başlıklar için ek bilgilerin çekilmesinde kullanılır.
- **OpenAI:** Yapay zeka destekli içerik üretimi için temel motor olarak görev yapar.
- **Next.js:** Modern ve hızlı arayüz geliştirme.
- **Node.js (Backend):** Sunucu tarafı işlemleri ve API entegrasyonları için kullanılır.
- **RAG Sistemi:** Kaynak odaklı bilgi çekimi ve içerik üretimi sürecinde yapılandırılmış verilerin yönetimi için entegre edilmiştir.

## Kurulum

### Gereksinimler

- Node.js (LTS sürüm önerilir)
- npm veya yarn

### Adımlar

1. **Depoyu Klonlayın:**

   ```bash
   git clone https://github.com/kullaniciadi/konusma-olusturucu-ai.git
   cd konusma-olusturucu-ai
   ```

2. **Bağımlılıkları Yükleyin:**

   Hem frontend hem de backend dizinlerinde gerekli paketleri yükleyin:

   ```bash
   # Frontend için:
   cd frontend
   npm install

   # Backend için:
   cd ../backend
   npm install
   ```

3. **Ortam Değişkenlerini Ayarlayın:**

   Proje kök dizininde `.env` dosyasını oluşturun ve gerekli API anahtarları ile yapılandırmaları ekleyin. Örneğin:

   ```env
   NEXT_PUBLIC_WIKIPEDIA_API_URL=https://en.wikipedia.org/w/api.php
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Projeyi Çalıştırın:**

   Hem frontend hem de backend sunucularını başlatın:

   ```bash
   # Frontend:
   cd frontend
   npm run dev

   # Backend:
   cd ../backend
   npm run start
   ```

## Kullanım

1. **Konuşma Analizi:**  
   Kullanıcı, sistemde yer alan arayüzden önceki konuşmalarını yükler veya sisteme kaydeder.

2. **Konu Seçimi:**  
   Kullanıcı, oluşturulan konuşma pattern'i doğrultusunda bir konu seçer.

3. **Bilgi Entegrasyonu:**  
   Seçilen konuya ilişkin alt başlıklar oluşturulur ve WikipediaAPI üzerinden ek bilgiler çekilir.

4. **Kişiselleştirme:**  
   Kullanıcı, geçmiş konuşmalarında yer alan ilgili metinleri sisteme dahil edebilir.

5. **Metin Üretimi:**  
   Tüm veriler ve tercihler doğrultusunda, sistem OpenAI ve RAG sistemi entegrasyonu ile kişiye özel hazır bir konuşma metni üretir.

## Katkıda Bulunma

Proje ile ilgili katkılarınız memnuniyetle karşılanmaktadır. Katkıda bulunmak için:

1. Bu depoyu fork'layın.
2. Yeni bir özellik veya düzeltme için bir branch oluşturun.
3. Değişikliklerinizi commit'leyin ve push'layın.
4. Bir Pull Request açarak katkınızı bildirin.

## Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
