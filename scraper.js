require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function leadToplaVeKaydet(targetUrl) {
  console.log(`🌐 Site taranıyor: ${targetUrl}`);
  try {
    // 1. Web sitesinin içeriğini indir
    const { data: html } = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });
    const $ = cheerio.load(html);

    // Gereksiz kod bloklarını temizle ve ham metni al
    $('script, style, iframe').remove();
    const sayfaMetni = $('body').text().replace(/\s+/g, ' ').slice(0, 3000);

    console.log("🤖 Yapay zeka verileri analiz ediyor...");

    // Aktif modeli al
    const modelsList = await groq.models.list();
    const activeModel = modelsList.data[0]?.id;

    // 2. Groq AI'dan metni JSON formatında ayıklamasını iste
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

    // 3. Supabase Veritabanına Kaydet
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

// TEST: Denemek istediğiniz hedef firmanın web/iletişim sayfasını buraya yazın
leadToplaVeKaydet('https://www.google.com');