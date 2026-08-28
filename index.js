require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function baglantiTesti() {
  console.log("Sistemler test ediliyor...");

  // 1. Supabase Testi
  try {
    const { data, error } = await supabase.from('leads').select('*');
    if (error) {
      console.error('❌ Supabase Hatası:', error.message);
    } else {
      console.log('✅ Supabase Bağlantısı Başarılı! Tablodaki Kayıt Sayısı:', data.length);
    }
  } catch (err) {
    console.error('❌ Supabase Bağlantı Hatası:', err.message);
  }

  // 2. Google Gemini AI Testi
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY tanımlı değil.");
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent("Sadece 'Hazırım' de.");
    const aiYanit = result.response.text().trim();
    console.log('✅ Yapay Zeka (Gemini) Bağlantısı Başarılı! Yanıt:', aiYanit);
  } catch (err) {
    console.error('❌ AI Hatası:', err.message);
  }
}

baglantiTesti();