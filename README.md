# 🚀 TikTok Orchestrator - Railway Node.js

TikTok farming otomasyonu için Railway'de çalışan Node.js orchestrator. PostgreSQL veritabanı, Puppeteer otomasyonu ve cron job'lar ile TikTok hesaplarını yönetir.

## 🎯 Özellikler

- **Hesap Yönetimi**: TikTok hesaplarını veritabanında saklama
- **Proxy Desteği**: Her hesap için ayrı proxy konfigürasyonu
- **İçerik Kuyruğu**: Video paylaşımı için zamanlanmış görevler
- **Warm-up Otomasyonu**: Hesap ısınma işlemleri
- **Cron Jobs**: Otomatik görev çalıştırma
- **API Endpoints**: RESTful API ile dış entegrasyon

## 🛠️ Teknoloji Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Automation**: Puppeteer
- **Scheduling**: node-cron
- **Hosting**: Railway

## 📦 Kurulum

### Lokal Geliştirme

```bash
# Bağımlılıkları yükle
npm install

# Environment variables
cp .env.example .env
# .env dosyasını düzenle

# Geliştirme sunucusunu başlat
npm run dev
```

### Railway Deployment

```bash
# Railway CLI ile giriş
railway login

# Projeyi linkle
railway link

# Deploy et
railway up
```

## 🔧 Environment Variables

```env
# Railway otomatik set eder
PORT=3000
DATABASE_URL=postgresql://...

# Manuel set edilecek
NODE_ENV=production
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Hesaplar
```
GET /api/accounts          # Tüm hesapları listele
POST /api/accounts         # Yeni hesap ekle
```

### İçerik
```
GET /api/content           # İçerik kuyruğunu listele
POST /api/content          # Yeni içerik ekle
```

### Görevler
```
GET /api/tasks             # Tüm görevleri listele
POST /api/automation/warm-up/:accountId  # Warm-up başlat
```

## 📊 Veritabanı Şeması

### accounts
- id, email, password, username
- proxy_ip, proxy_port, proxy_username, proxy_password
- status, risk_score, followers, following, total_likes, total_views
- created_at, last_activity

### content_queue
- id, account_id, video_url, caption, hashtags
- scheduled_time, status, created_at

### tasks
- id, account_id, task_type, task_data
- status, created_at, completed_at

## 🤖 Otomasyon Akışı

1. **Hesap Ekleme**: API ile hesap bilgileri + proxy
2. **Warm-up**: 7-10 gün organik davranış simülasyonu
3. **İçerik Planlama**: Video + caption + hashtag kuyruğu
4. **Otomatik Paylaşım**: Cron job ile zamanlanmış görevler
5. **Analytics**: Performans takibi ve risk skorlama

## 🔒 Güvenlik

- Proxy rotasyonu ile IP değişimi
- Human-like delays ve random behavior
- Risk skorlama sistemi
- Ban detection ve recovery

## 📈 Monitoring

- Health check endpoint
- Task status tracking
- Error logging
- Performance metrics

## 🚀 Deployment

Railway'de otomatik deploy:
1. GitHub repo'ya push
2. Railway otomatik build
3. PostgreSQL database otomatik oluşturulur
4. Environment variables otomatik set edilir

## 📝 Kullanım Örneği

```bash
# Hesap ekle
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "username": "testuser",
    "proxy_ip": "1.2.3.4",
    "proxy_port": 8080
  }'

# Warm-up başlat
curl -X POST http://localhost:3000/api/automation/warm-up/1

# İçerik ekle
curl -X POST http://localhost:3000/api/content \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": 1,
    "video_url": "https://example.com/video.mp4",
    "caption": "Amazing video! #viral",
    "hashtags": "#viral #trending",
    "scheduled_time": "2024-01-15T10:00:00Z"
  }'
```

## 🔧 Geliştirme

```bash
# Yeni endpoint ekle
# server.js dosyasında route tanımla

# Database migration
# initDatabase() fonksiyonunda schema güncelle

# Puppeteer script ekle
# TikTok automation fonksiyonlarını genişlet
```

## 📞 Destek

- Railway Dashboard: https://railway.app
- API Documentation: `/` endpoint
- Health Check: `/health` endpoint

---

**Not**: Bu sistem TikTok ToS'a uygun kullanılmalıdır. Sorumlu kullanım önerilir.
