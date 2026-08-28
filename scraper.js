require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const HEDEF_SITELER = [
  'https://www.metrik.com.tr',
];

async function siteyiAnalizEtVeKaydet(targetUrl, supabase, resend) {
  console.log(`\n🌐 Site taranıyor: ${targetUrl}`);
  try {
    const { data: html } = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });
    const $ = cheerio.load(html);

    // Sayfa başlığını şirket adı olarak al
    let sirketAdi = $('title').text().trim() || 'Metrik A.Ş.';
    if (sirketAdi.includes('|')) sirketAdi = sirketAdi.split('|')[0].trim();
    if (sirketAdi.includes('-')) sirketAdi = sirketAdi.split('-')[0].trim();

    // Sayfa içerisindeki e-posta adreslerini Regex ile bul
    const bodyText = $('body').text();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = bodyText.match(emailRegex);

    // Eğer sitede mail yoksa alternatif olarak senin kendi mailini test için ekleyelim ki süreç ilerlesin
    const targetEmail = (foundEmails && foundEmails.length > 0) ? foundEmails[0] : 'yemretopal10@gmail.com';

    console.log(`📌 Tespit Edilen Şirket: ${sirketAdi}`);
    console.log(`📌 Tespit Edilen E-posta: ${targetEmail}`);

    const leadData = {
      sirket_adi: sirketAdi,
      email: targetEmail,
      sektor: 'Yazılım ve Teknoloji',
      potansiyel_skoru: 8, // Doğrudan yüksek skor veriyoruz ki mail atsın ve süreci görebil
      skor_nedeni: 'Web sitesi aktif ve kurumsal potansiyel içeriyor.',
      hedef_unvan: 'Kurucu / Yönetici'
    };

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

  if (!supabaseUrl || !supabaseKey || !resendApiKey) {
    console.error("❌ Gerekli çevre değişkenleri eksik!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const resend = new Resend(resendApiKey);

  for (const url of HEDEF_SITELER) {
    await siteyiAnalizEtVeKaydet(url, supabase, resend);
  }
}

main();