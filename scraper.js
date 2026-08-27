require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

async function leadToplaVeKaydet(targetUrl) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  console.log("SUPABASE_URL Kontrolü:", supabaseUrl ? "BAŞARILI" : "EKSİK/BOŞ");

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ SUPABASE_URL veya SUPABASE_KEY tanımlı değil!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  console.log(`🌐 Site taranıyor: ${targetUrl}`);
  try {
    const { data: html } = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });
    const $ = cheerio.load(html);

    $('script, style, iframe').remove();
    const sayfaMetni = $('body').text().replace(/\s+/g, ' ').slice(0, 3000);

    console.log("🤖 Yapay zeka verileri analiz ediyor...");

    const modelsList = await groq.models.list();
    const activeModel = modelsList.data[0]?.id;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Sen bir B2B veri ayıklama uzmanısın. Verilen metinden şirket adını, e-posta adresini ve sektörünü ayıkla. Yanıtı SADECE geçerli bir JSON formatında ver: {"sirket_adi": "...", "email": "...", "sektor": "..."}. E-posta yoksa "email" değerini null yap.'
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

    console.log("🎯 Bulunan Veri:", leadData);

    const { error } = await supabase.from('leads').insert([
      {
        sirket_adi: leadData.sirket_adi || 'Bilinmiyor',
        email: leadData.email,
        sektor: leadData.sektor || 'Genel',
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
      console.log("🚀 Veri Supabase veritabanına başarıyla kaydedildi!");
    }

  } catch (err) {
    console.error("❌ İşlem Hatası:", err.message);
  }
}

leadToplaVeKaydet('https://www.google.com');