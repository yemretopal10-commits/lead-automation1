require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

async function otomasyonuCalistir() {
  console.log("📧 Gönderilecek mailler kontrol ediliyor...");

  // Supabase'den durumu 'bekliyor' olan kayıtları çek
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('durum', 'bekliyor')
    .limit(5);

  if (error) {
    console.error("❌ Veri çekme hatası:", error.message);
    return;
  }

  if (leads.length === 0) {
    console.log("ℹ️ Gönderilecek yeni lead bulunamadı.");
    return;
  }

  for (const lead of leads) {
    try {
      console.log(`✉️ Mail gönderiliyor: ${lead.sirket_adi} (${lead.email})`);

      const response = await resend.emails.send({
        from: 'onboarding@resend.dev', // Resend ücretsiz test adresi
        to: lead.email,
        subject: `${lead.sirket_adi} İçin İş Birliği Teklifi`,
        html: `
          <h3>Merhaba ${lead.sirket_adi} Ekibi,</h3>
          <p>${lead.sektor} sektöründeki çalışmalarınızı inceledik.</p>
          <p>Süreçlerinizi otonom hale getirerek zaman kazanmanıza yardımcı olabiliriz.</p>
          <br>
          <p>Detaylı bilgi için bu maili yanıtlayabilirsiniz.</p>
        `
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Mail gittiyse veritabanında durumu güncelle
      await supabase
        .from('leads')
        .update({ durum: 'mail_atildi' })
        .eq('id', lead.id);

      console.log(`✅ Mail başarıyla gönderildi ve statü güncellendi: ${lead.email}`);

    } catch (sendError) {
      console.error(`❌ ${lead.email} adresine mail gönderilemedi:`, sendError.message);
    }
  }
}

otomasyonuCalistir();