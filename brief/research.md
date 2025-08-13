TikTok Otomasyonu için Railway Node.js Teknik Brief
Genel Bakış
Bu teknik brief, Railway’in Hobby planını ($5/ay, ~170 TL) kullanarak Node.js ve Puppeteer ile TikTok otomasyon sistemi kurmayı adım adım açıklar. Sistem, 10-20 TikTok hesabını yöneterek günlük 50.000-100.000+ organik görüntüleme elde etmeyi, mobil uygulamalarınızı (PetPop, Sakinah Calm, Calfit AI, DietSnap) tanıtmaya ve TikTok’tan gelir sağlamayı hedefler. PostgreSQL veritabanı, proxy’ler ve Creatomate API ile entegre çalışır. Cursor AI (veya benzeri) ile kod yazımı desteklenir.
Hedefler

Organik Görüntüleme: 50.000-100.000+ günlük TikTok görüntülemesi.
Uygulama Tanıtımı: Biyografi bağlantılarıyla uygulama indirme ve etkileşim.
Gelir: Creator Fund, ortaklık pazarlaması, hesap satışı.
Güvenlik: Proxy’ler ve Puppeteer ile ban riskini azaltma.

Adım Adım Teknik Kurulum
Adım 1: Railway’de Proje Oluşturma
Railway’in Hobby planıyla bir Node.js projesi başlatın.

Railway Hesabı ve Proje Kurulumu:
Railway.app’e gir, Hobby planını seç ($5/ay, ~170 TL).
Yeni proje oluştur, “Node.js” şablonunu seç.
Proje adını belirle (örneğin, tiktok-otomasyon).
Otomatik olarak bir GitHub reposu bağlanacak, kodları buraya push edeceksin.


Başlangıç Kodu:
Railway, varsayılan bir server.js dosyası oluşturur. Cursor AI ile aşağıdaki temel Node.js kodunu yazdır:const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('TikTok Otomasyon Sunucusu Çalışıyor!');
});

app.listen(port, () => {
  console.log(`Sunucu ${port} portunda çalışıyor`);
});


Cursor’a şu prompt’u ver: “Express.js ile basit bir Node.js sunucusu oluştur. Railway’de çalışacak şekilde PORT ortam değişkenini kullan.”


package.json oluştur:{
  "name": "tiktok-otomasyon",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^23.0.0"
  }
}


Cursor’a: “Railway için Node.js package.json dosyası oluştur, express ve puppeteer bağımlılıklarıyla.”


Kodu GitHub’a push et, Railway otomatik deploy eder.



Adım 2: PostgreSQL Veritabanı Ekleme
Hesap bilgileri ve paylaşım takvimini saklamak için veritabanı ekleyin.

Railway’de Veritabanı Oluşturma:
Railway dashboard’da projene git, “New” > “Database” > “PostgreSQL” seç.
Veritabanı otomatik oluşturulur ve bağlantı bilgileri (DATABASE_URL) ortam değişkeni olarak eklenir.


Veritabanı Şeması:
Cursor’a şu prompt’u ver: “PostgreSQL için TikTok hesaplarını (email, password, proxy_ip, proxy_port, schedule) saklayacak bir tablo şeması oluştur.”Örnek çıktı:CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  proxy_ip VARCHAR(50),
  proxy_port INTEGER,
  schedule JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


Bu SQL’i Railway’in veritabanı konsolunda çalıştır.


Node.js ile Veritabanı Bağlantısı:
pg kütüphanesini ekle (npm install pg).
Cursor’a: “Node.js’de PostgreSQL bağlantısı için express rotası yaz, accounts tablosundan veri çeksin.”Örnek kod:const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM accounts');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Veritabanı hatası');
  }
});


DATABASE_URL’yi Railway ortam değişkenlerinden al.



Adım 3: Puppeteer ile TikTok Otomasyonu
Puppeteer ile TikTok hesaplarını yönetin (giriş, kaydırma, paylaşım).

Puppeteer Kurulumu:
Railway’e Puppeteer bağımlılığını ekledin (package.json’da). Railway’in Linux ortamında çalışır, ancak puppeteer için Chrome bağımlılıkları gerekir.
Cursor’a: “Railway’de çalışacak Puppeteer kurulumu için Node.js kodu yaz, headless tarayıcı başlatsın.”Örnek:const puppeteer = require('puppeteer');

async function startBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  return browser;
}




TikTok Hesap Yönetimi:
10-20 hesap için veritabanındaki bilgileri kullan.
Cursor’a: “Puppeteer ile TikTok’a giriş yapan, rastgele videoları kaydıran ve beğenen bir script yaz. Proxy desteği ekle.”Örnek:async function tiktokAutomation(email, password, proxyIp, proxyPort) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [`--proxy-server=${proxyIp}:${proxyPort}`, '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://www.tiktok.com/login');
  // Giriş işlemleri (email, password)
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  // 15-20 dakika kaydırma ve beğenme
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(Math.random() * 5000 + 5000);
    if (Math.random() > 0.7) {
      await page.click('button.like-button');
    }
  }
  await browser.close();
}




Hesap Isıtma (7-10 gün):
Günde 15-20 dakika kaydırma, 2-3 beğeni, 1-2 takip.
Cursor’a: “Puppeteer ile TikTok’ta organik kullanıcı gibi davranan bir script yaz (kaydırma, beğenme, yorum).”
Örnek yorum: “Harika video! 😍 Bunu nasıl yaptın?”



Adım 4: Proxy ve Coğrafi Hedefleme
Ban riskini azaltmak için her hesaba benzersiz IP atayın.

Proxy Servisi:
Mobilehop (IP başına saatlik ~10 TL) veya ProxyTR (aylık 300-500 TL/IP).
10 hesap için 10 IP (~3.000-5.000 TL/ay).
Railway ortam değişkenlerine proxy bilgilerini ekle (örneğin, PROXY_IP_1, PROXY_PORT_1).


Sanal Numaralar:
Hushed ile ABD/İngiltere numaraları (10 numara için aylık 600-1.500 TL).
Veritabanında sakla.


Puppeteer’da Proxy:
Yukarıdaki script’te proxy argümanları eklendi. Cursor’a: “Puppeteer’da proxy ile TikTok’a giriş yapan bir fonksiyon yaz.”



Adım 5: İçerik Oluşturma ve Paylaşım
Creatomate ile videolar üretin, Puppeteer ile paylaşın.

Creatomate Entegrasyonu:
Creatomate hesabı aç (aylık 1.200-3.000 TL).
Cursor’a: “Node.js’de Creatomate API ile TikTok videosu üreten bir fonksiyon yaz. 3 saniyelik kanca, altyazı ve uygulama demosu içersin.”Örnek:const axios = require('axios');

async function createVideo(appName, templateId) {
  const response = await axios.post('https://api.creatomate.com/v1/renders', {
    template_id: templateId,
    modifications: {
      'text': `Hemen ${appName} indir!`,
      'video_url': 'https://your-app-demo.com/video.mp4'
    }
  }, {
    headers: { Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}` }
  });
  return response.data.url;
}


CREATOMATE_API_KEY’i Railway ortam değişkenlerine ekle.


Paylaşım Otomasyonu:
Cursor’a: “Puppeteer ile TikTok’a video yükleyen bir script yaz.”Örnek:async function uploadVideo(page, videoPath) {
  await page.goto('https://www.tiktok.com/upload');
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(videoPath);
  await page.type('textarea', 'Bu uygulamayı dene! #PetPop');
  await page.click('button.post-button');
  await page.waitForNavigation();
}


Günde 30-60 video (hesap başına 3, 10-20 hesap).
TikTok’un zamanlama aracıyla 10 günlük paylaşım planla.



Adım 6: Analitik ve Optimizasyon

Google Analytics 4: UTM parametreleriyle biyografi tıklamalarını izle.
TikTok Analytics: En iyi videoları analiz et, formatlarını tekrarlayın.
A/B Testi: #PetPop vs. #EvcilHayvanMeydanOkuması.

Adım 7: Gelir ve Maliyet

Gelir:
Creator Fund: 100.000 görüntüleme için günlük 60-120 TL.
Ortaklık: İndirme başına 30-150 TL.
Uygulama İçi Satın Almalar: Kullanıcı başına 150-300 TL.
Toplam: Aylık 55.800-102.600 TL.


Maliyet:
Railway: ~620 TL/ay.
Proxy’ler ve Numaralar: 3.600-6.500 TL/ay.
Yazılımlar: 3.250-7.900 TL/ay.
Toplam: Aylık 7.470-14.420 TL.



Adım 8: Zaman Çizelgesi

1. Hafta: Railway projesi, PostgreSQL, Puppeteer kurulumu, 10-20 hesap ısıtma.
2. Hafta: 30 video/gün, paylaşım ve izleme.
3-4. Hafta: 60 videoya ölçeklendirme, Creator Fund.
2. Ay+: Hesap satışı, indirme artışı.

Uygulamalarınıza Öneriler

PetPop: #EvcilHayvanMeydanOkuması ile AR filtreleri.
Sakinah Calm: Meditasyon videoları, #HuzurBul.
Calfit AI/DietSnap: Yemek tarama, #SağlıklıBeslenme.

Sonuç
Railway’in Hobby planı ve Puppeteer ile düşük maliyetli bir TikTok otomasyon sistemi kurarak aylık 55.800-102.600 TL gelir elde edebilirsiniz. Cursor AI ile kodları hızlıca yazdır, hesap güvenliğine odaklan ve performansa göre ölçeklendir.