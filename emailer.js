require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

async function otomasyonuCalistir() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !supabaseKey || !resendApiKey) {
    console.error("❌ Çevre değişkenleri (ENV) eksik!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const resend = new Resend(resendApiKey);

  console.log("📧 Gönderilecek mailler kontrol ediliyor...");

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('durum', 'bekliyor')
    .limit(5);

  if (error) {
    console.error("❌ Veri çekme hatası:", error.message);
    return;
  }

  if (!leads || leads.length === 0) {
    console.log("ℹ️ Gönderilecek yeni lead bulunamadı.");
    return;
  }

  for (const lead of leads) {
    try {
      console.log(`✉️ Mail gönderiliyor: ${lead.sirket_adi} (${lead.email})`);

      const { data, error: sendError } = await resend.emails.send({
        from: 'Lead Otomasyon <onboarding@resend.dev>',
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

      if (sendError) {
        throw new Error(sendError.message);
      }

      await supabase
        .from('leads')
        .update({ durum: 'mail_atildi' })
        .eq('id', lead.id);

      console.log(`✅ Mail başarıyla gönderildi ve statü güncellendi: ${lead.email}`);

    } catch (err) {
      console.error(`❌ ${lead.email} adresine mail gönderilemedi:`, err.message);

      await supabase
        .from('leads')
        .update({ durum: 'mail_hatasi' })
        .eq('id', lead.id);
    }
  }
}

otomasyonuCalistir();