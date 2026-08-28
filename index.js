require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function baglantiTesti() {
  console.log("Sistemler test ediliyor...");

  // 1. Supabase Testi
  const { data, error } = await supabase.from('leads').select('*');
  if (error) {
    console.error('❌ Supabase Hatası:', error.message);
  } else {
    console.log('✅ Supabase Bağlantısı Başarılı! Tablodaki Kayıt Sayısı:', data.length);
  }

  // 2. Google Gemini AI Testi
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY tanımlı değil.");
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        contents: [{ parts: [{ text: "Sadece 'Hazırım' de." }] }]
      }
    );

    const aiYanit = response.data.candidates[0].content.parts[0].text.trim();
    console.log('✅ Yapay Zeka (Gemini) Bağlantısı Başarılı! Yanıt:', aiYanit);
  } catch (err) {
    console.error('❌ AI Hatası:', err.response?.data || err.message);
  }
}

baglantiTesti();