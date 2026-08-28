require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

// Test etmek istediğin gerçek B2B web sitelerinin URL'lerini buraya ekle:
const HEDEF_SITELER = [
  'https://www.metrik.com.tr', // Örnek B2B site 1 (Kendi hedef listene göre güncelleyebilirsin)
  // 'https://ornek-ajans.com/iletisim',
];

async function siteyiAnalizEtVeKaydet(targetUrl, supabase, groq) {
  console.log(`\n🌐 Site taranıyor: ${targetUrl}`);
  try {
    const { data: html } = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });
    const $ = cheerio.load(html);

    $('script, style, iframe, noscript').remove();
    const sayfaMetni = $('body').text().replace(/\s+/g, ' ').slice(0, 3000);

    console.log("🤖 Groq AI ile skorlama ve veri zenginleştirme yapılıyor...");

    const modelsList = await groq.models.list();
    const activeModel = modelsList.data[0]?.id || 'llama-3.3-70b-versatile';

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Sen bir B2B Müşteri Analistisin. Verilen metni detaylıca incele.
SADECE aşağıdaki JSON formatında yanıt ver, ekstra açıklama ekleme:
{
  "sirket_adi": "Şirket Adı veya null",
  "email": "Metindeki gerçek e-posta adresi (Örn: info@..., iletisim@...) veya null",
  "sektor": "Şirketin ana sektörü",
  "potansiyel_skoru": 1 ile 10 arasında bir puan (Ticari potansiyeli ve dijital olgunluğuna göre),
  "skor_nedeni": "Bu puanın kısa gerekçesi (1 cümle)",
  "hedef_unvan": "Ulaşılacak ideal karar verici (Örn: CEO, Pazarlama Direktörü, Kurucu)"
}`
        },
        {
          role: 'user',
          content: sayfaMetni
        }
      ],
      model: activeModel,
      response_format: { type: "json_object" }
    });

    const leadData = JSON.parse(completion.choices[0].message.content);

    // E-posta yoksa veri kirliliğini önlemek için kaydı atla
    if (!leadData.email) {
      console.log("⚠️ E-posta adresi bulunamadı, veritabanına eklenmedi.");
      return;
    }

    console.log("🎯 AI Tarafından Analiz Edilen Nitelikli Veri:", leadData);

    const { error } = await supabase.from('leads').insert([
      {
        sirket_adi: leadData.sirket_adi || 'Bilinmiyor',
        email: leadData.email,
        sektor: leadData.sektor || 'Genel',
        potansiyel_skoru: leadData.potansiyel_skoru || 5,
        skor_nedeni: leadData.skor_nedeni || 'Otomatik analiz edildi.',
        hedef_unvan: leadData.hedef_unvan || 'Kurucu / CEO',
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
      console.log("🚀 Gerçek nitelikli lead Supabase'e kaydedildi!");
    }

  } catch (err) {
    console.error(`❌ ${targetUrl} taranırken hata oluştu:`, err.message);
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ SUPABASE_URL veya SUPABASE_KEY tanımlı değil!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  for (const url of HEDEF_SITELER) {
    await siteyiAnalizEtVeKaydet(url, supabase, groq);
  }
}

main();