require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testVerisiEkle() {
  // BURAYA KENDİ E-POSTA ADRESİNİZİ YAZIN (Mailin size ulaşıp ulaşmadığını görmek için)
  const testEmail = "yemretopal10@gmail.com"; 

  const { data, error } = await supabase.from('leads').insert([
    {
      sirket_adi: 'Örnek Teknoloji A.Ş.',
      email: testEmail,
      sektor: 'Yazılım',
      durum: 'bekliyor'
    }
  ]);

  if (error) {
    console.error("❌ Hata:", error.message);
  } else {
    console.log("✅ Test kaydı Supabase'e başarıyla eklendi! E-posta:", testEmail);
  }
}

testVerisiEkle();