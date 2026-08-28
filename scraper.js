require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const { Resend } = require('resend');

const HEDEF_SITELER = [
  'https://www.metrik.com.tr',
];

async function siteyiAnalizEtVeKaydet(targetUrl, supabase, groq, resend) {
  console.log(`\n🌐 Site taranıyor: ${targetUrl}`);
  try {
    const { data: html } = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });
    const $ = cheerio.load(html);

    $('script, style, iframe, noscript').remove();
    const sayfaMetni = $('body').text().replace(/\s+/g, ' ').slice(0, 3000);

    console.log("🤖 Groq AI ile profesyonel B2B analizi yapılıyor...");

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Sen profesyonel bir B2B Müşteri Analistisin. Verilen web sitesi metnini analiz et. SADECE saf bir JSON objesi döndür, markdown blokları veya ekstra metin ekleme:
{
  "sirket_adi": "Şirket Adı",
  "email": "Sitede geçen gerçek e-posta veya null",
  "sektor": "Ana faaliyet sektörü",
  "potansiyel_skoru": 8,
  "skor_nedeni": "Skorun kısa gerekçesi",
  "hedef_unvan": "CEO / Kurucu"
}`
        },
        {
          role: 'user',
          content: sayfaMetni
        }
      ],
      model: 'llama-3.3-70b-versatile'
    });

    const rawContent = completion.choices[0].message.content.trim();
    const jsonStart = rawContent.indexOf('{');
    const jsonEnd = rawContent.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.log("❌ AI geçerli bir JSON formatı döndürmedi.");
      return;
    }

    const leadData = JSON.parse(rawContent.substring(jsonStart, jsonEnd + 1));

    if (!leadData.email) {
      leadData.email = 'metrik@metrik.com.tr';
    }

    console.log(`📌 Analiz Edilen Şirket: ${leadData.sirket_adi}`);
    console.log(`📌 Hedef E-posta: ${leadData.email}`);
    console.log(`📌 Potansiyel Skoru: ${leadData.potansiyel_skoru}/10`);

    const yuksekSkorluMu = leadData.potansiyel_skoru >= 7;
    let baslangicDurumu = 'bekliyor';

    if (yuksekSkorluMu) {
      console.log("🔥 Yüksek potansiyelli lead tespit edildi! E-posta gönderiliyor...");
      
      const { error: emailErr } = await resend.emails.send({
        from: 'Lead Otomasyon <onboarding@resend.dev>',
        to: leadData.email,
        subject: `${leadData.sirket_adi} İçin Dijital Büyüme Teklifi`,
        html: `<p>Merhaba,</p><p>Web sitenizi inceledik ve ${leadData.sektor} sektöründeki potansiyelinizi gördük. Dijital süreçlerinizi optimize etmek için görüşelim mi?</p>`
      });

      if (emailErr) {
        console.error("❌ E-posta gönderilemedi:", emailErr.message || emailErr.name);
        baslangicDurumu = 'mail_hatasi';
      } else {
        baslangicDurumu = 'mail_atildi';
        console.log("🚀 Resend ile teklif e-postası başarıyla gönderildi!");
      }
    } else {
      console.log(`ℹ️ Skor ${leadData.potansiyel_skoru}/10 olduğu için e-posta atlandı.`);
    }

    const { error } = await supabase.from('leads').insert([
      {
        sirket_adi: leadData.sirket_adi,
        email: leadData.email,
        sektor: leadData.sektor,
        potansiyel_skoru: leadData.potansiyel_skoru,
        skor_nedeni: leadData.skor_nedeni,
        hedef_unvan: leadData.hedef_unvan,
        durum: baslangicDurumu
      }
    ]);

    if (error) {
      if (error.code === '23505') {
        console.log("⚠️ Bu e-posta adresi veritabanında zaten mevcut.");
      } else {
        console.error("❌ Supabase Kayıt Hatası:", error.message);
      }
    } else {
      console.log("💾 Veri Supabase veritabanına kaydedildi.");
    }

  } catch (err) {
    console.error(`❌ ${targetUrl} taranırken hata oluştu:`, err.message);
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!supabaseUrl || !supabaseKey || !resendApiKey || !groqApiKey) {
    console.error("❌ Çevre değişkenleri (ENV) eksik!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const groq = new Groq({ apiKey: groqApiKey });
  const resend = new Resend(resendApiKey);

  for (const url of HEDEF_SITELER) {
    await siteyiAnalizEtVeKaydet(url, supabase, groq, resend);
  }
}

main();