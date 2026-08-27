# 🚀 B2B Autonomous Lead Generation & Outreach Engine

Tamamen ücretsiz ve bulut tabanlı araçlar kullanılarak geliştirilmiş, uçtan uca otonom çalışan B2B potansiyel müşteri (lead) toplama ve e-posta pazarlama sistemidir.

## 🛠️ Teknoloji Yığını (Tech Stack)

* **Runtime:** Node.js
* **Database:** Supabase (PostgreSQL)
* **AI Engine:** Groq API (Llama 3 / Fast Inference)
* **Email Delivery:** Resend
* **Automation / Cron:** GitHub Actions
* **Scraper:** Axios & Cheerio

## ⚙️ Nasıl Çalışır?

1. **Web Scraping:** Hedef firmanın web sitesindeki ham metin ve iletişim sayfaları taranır.
2. **AI Analysis:** Groq API (Llama) aracılığıyla metinden şirket adı, sektör ve e-posta adresi JSON formatında süzülür.
3. **Database Storage:** Elde edilen veriler Supabase üzerindeki `leads` tablosuna kaydedilir (Çift kayıt engellenir).
4. **Automated Outreach:** Resend altyapısı kullanılarak kişiselleştirilmiş B2B teklif e-postası otomatik iletilir ve veritabanı statüsü güncellenir.
5. **24/7 Cloud Automation:** GitHub Actions (Cron Jobs) sayesinde sistem her gün belirlenen saatte bilgisayardan bağımsız otonom çalışır.

## 🔒 Güvenlik

Tüm API anahtarları `.env` ve GitHub Secrets üzerinde saklanmakta olup repo içerisinde hiçbir hassas veri barındırılmamaktadır.