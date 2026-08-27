require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function baglantiTesti() {
  console.log("Sistemler test ediliyor...");

  // 1. Supabase Testi
  const { data, error } = await supabase.from('leads').select('*');
  if (error) {
    console.error('❌ Supabase Hatası:', error.message);
  } else {
    console.log('✅ Supabase Bağlantısı Başarılı! Tablodaki Kayıt Sayısı:', data.length);
  }

  // 2. Groq AI Testi (Hesaptaki aktif modeli otomatik yakalar)
  try {
    const modelsList = await groq.models.list();
    const activeModel = modelsList.data[0]?.id;

    if (!activeModel) {
      throw new Error("Hesabınızda aktif model bulunamadı.");
    }

    console.log(`🤖 Bulunan Aktif Model: ${activeModel}`);

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: "Sadece 'Hazırım' de." }],
      model: activeModel,
    });
    
    console.log('✅ Yapay Zeka (Groq) Bağlantısı Başarılı! Yanıt:', completion.choices[0].message.content.trim());
  } catch (err) {
    console.error('❌ AI Hatası:', err.message);
  }
}

baglantiTesti();