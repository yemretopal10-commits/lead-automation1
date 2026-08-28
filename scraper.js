require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const HEDEF_SITELER = [
  'https://www.metrik.com.tr',
];

async function siteyiAnalizEtVeKaydet(targetUrl, supabase, geminiApiKey) {
  console.log(`\n🌐 Site taranıyor: ${targetUrl}`);
  try {
    const { data: html } = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });
    const $ = cheerio.load(html);

    $('script, style, iframe, noscript').remove();
    const sayfaMetni = $('body').text().replace(/\s+/g, ' ').slice(0, 3000);

    console.log("🤖 Google Gemini AI ile profesyonel B2B analizi yapılıyor...");

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    // Doğru model ismi ve garanti JSON çıktısı yapılandırması
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const promptText = `Sen profesyonel bir B2B Müşteri Analistisin. Verilen web sitesi metnini analiz et. SADECE bu şemaya uygun bir JSON objesi üret:
{
  "sirket_adi": "Şirket Adı",
  "email": "Sitede geçen gerçek e-posta veya null",
  "sektor": "Ana faaliyet sektörü",
  "potansiyel_skoru": 8,
  "skor_nedeni": "Skorun kısa gerekçesi",
  "hedef_unvan": "CEO / Kurucu"
}

Metin: ${sayfaMetni}`;

    const result = await model.generateContent(promptText);
    const rawContent = result.response.text().trim();
    const leadData = JSON.parse(rawContent);

    if (!leadData.email) {
      leadData.email = 'metrik@metrik.com.tr';
    }

    console.log(`📌 Analiz Edilen Şirket: ${leadData.sirket_adi}`);
    console.log(`📌 Hedef E-posta: ${leadData.email}`);
    console.log(`📌 Potansiyel Skoru: ${leadData.potansiyel_skoru}/10`);

    const { error } = await supabase.from('leads').insert([
      {
        sirket_adi: leadData.sirket_adi,
        email: leadData.email,
        sektor: leadData.sektor,
        potansiyel_skoru: leadData.potansiyel_skoru,
        skor_nedeni: leadData.skor_nedeni,
        hedef_unvan: leadData.hedef_unvan,
        durum: 'bekliyor'
      }
    ]);

    if (error) {
      if (error.code === '23505') {
        console.log("⚠️ Bu e-posta adresi veritabanında zaten mevcut.");
      } else {
        console.error("❌ Supabase Kayıt Hatası:", error.message);
      }
    } else {
      console.log("💾 Veri Supabase veritabanına kuyruğa eklendi.");
    }

  } catch (err) {
    console.error(`❌ ${targetUrl} taranırken hata oluştu:`, err.message);
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error("❌ Çevre değişkenleri (ENV) eksik!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  for (const url of HEDEF_SITELER) {
    await siteyiAnalizEtVeKaydet(url, supabase, geminiApiKey);
  }
}

main();