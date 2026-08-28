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

    console.log("🤖 Groq AI ile skorlama ve veri zenginleştirme yapılıyor...");

    // Hesabının erişebildiği modeli otomatik seçer
    const modelsList = await groq.models.list();
    const activeModel = modelsList.data[0]?.id || 'llama-3.1-70b-versatile';

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

    if (!leadData.email) {
      console.log("⚠️ E-posta adresi bulunamadı, veritabanına eklenmedi.");
      return;
    }

    const yuksekSkorluMu = leadData.potansiyel_skoru >= 7;
    let baslangicDurumu = 'bekliyor';

    if (yuksekSkorluMu) {
      console.log("🔥 Yüksek potansiyelli lead tespit edildi! E-posta gönderiliyor...");
      try {
        await resend.emails.send({
          from: 'Lead Otomasyon <onboarding@resend.dev>',
          to: leadData.email,
          subject: `${leadData.sirket_adi || 'Şirketiniz'} İçin Dijital Büyüme Teklifi`,
          html: `<p>Merhaba,</p><p>Web sitenizi inceledik ve ${leadData.sektor} sektöründeki potansiyelinizi gördük. Dijital süreçlerinizi optimize etmek için görüşelim mi?</p>`
        });
        baslangicDurumu = 'mail_atildi';
        console.log("🚀 Resend ile teklif e-postası başarıyla gönderildi!");
      } catch (emailErr) {
        console.error("❌ E-posta gönderilemedi:", emailErr.message);
        baslangicDurumu = 'mail_hatasi';
      }
    } else {
      console.log(`ℹ️ Skor ${leadData.potansiyel_skoru}/10 olduğu için e-posta atlandı.`);
    }

    const { error } = await supabase.from('leads').insert([
      {
        sirket_adi: leadData.sirket_adi || 'Bilinmiyor',
        email: leadData.email,
        sektor: leadData.sektor || 'Genel',
        potansiyel_skoru: leadData.potansiyel_skoru || 5,
        skor_nedeni: leadData.skor_nedeni || 'Otomatik analiz edildi.',
        hedef_unvan: leadData.hedef_unvan || 'Kurucu / CEO',
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

  if (!supabaseUrl || !supabaseKey || !resendApiKey) {
    console.error("❌ Gerekli çevre değişkenleri eksik!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const resend = new Resend(resendApiKey);

  for (const url of HEDEF_SITELER) {
    await siteyiAnalizEtVeKaydet(url, supabase, groq, resend);
  }
}

main();