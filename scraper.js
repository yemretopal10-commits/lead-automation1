require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

// Test etmek istediğin web sitelerini buraya ekleyebilirsin:
const HEDEF_SITELER = [
  'https://www.w3schools.com/about/about_contact.asp'
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
          content: `Sen bir B2B Dijital Pazarlama Ajansı için müşteri analistisin. Verilen metni incele ve firmayı değerlendir.
SADECE aşağıdaki JSON formatında yanıt ver, ekstra açıklama yazma:
{
  "sirket_adi": "Şirket Adı veya null",
  "email": "Metinde geçen ilk e-posta adresi veya null",
  "sektor": "Sektör bilgisi",
  "potansiyel_skoru": 1 ile 10 arasında bir tamsayı,
  "skor_nedeni": "Neden bu puan verildi? (Kısa 1 cümle)",
  "hedef_unvan": "Ulaşılacak ideal karar verici (Örn: CEO, Kurucu, Pazarlama Müdürü)"
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

    if (!leadData.email) {
      console.log("⚠️ E-posta adresi bulunamadı, kayıt atlandı.");
      return;
    }

    console.log("🎯 AI Tarafından Zenginleştirilen Veri:", leadData);

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
      console.log("🚀 Nitelikli veri Supabase veritabanına başarıyla eklendi!");
    }

  } catch (err) {
    console.error(`❌ ${targetUrl} işlenirken hata oluştu:`, err.message);
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