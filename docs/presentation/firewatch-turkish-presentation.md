# FIREWATCH DSS - Türkçe Sunum


---

## 1. Başlık

# FIREWATCH DSS

## Türkiye için hava verisine dayalı orman yangını risk karar destek sistemi

**Kısa tanım:**

FIREWATCH DSS, seçilen bir Türkiye konumu için canlı hava verisini alır, makine öğrenmesi modeli ile göreli yangın riskini hesaplar ve görevliye karar desteği verir.


---

## 2. Proje Ne Yapıyor?

```mermaid
flowchart LR
    A["Kullanıcı<br/>konum seçer"] --> B["Canlı hava verisi<br/>alınır"]
    B --> C["ML modeli<br/>risk skoru üretir"]
    C --> D["Risk seviyesi<br/>low / medium / high / critical"]
    D --> E["Önerilen aksiyon<br/>ve izleme yarıçapı"]
    E --> F["Harita ve panelde<br/>gösterilir"]
```

**Ana fikir:**

- Kullanıcı Türkiye'de bir konum seçer.
- Sistem canlı hava ve tahmin verisi alır.
- Model yangın için uygun hava koşullarını değerlendirir.
- Sonuç harita, panel, geçmiş kayıt ve uyarı olarak gösterilir.


---

## 3. Bu Proje Ne Değildir?

```mermaid
flowchart TB
    A["FIREWATCH DSS"] --> B["Karar destek sistemi"]
    A --> C["Göreli risk tahmini"]
    A --> D["Canlı hava verisi kullanır"]

    X["Değil"] --> Y["Aktif yangın tespiti değil"]
    X --> Z["Resmi acil durum alarmı değil"]
    X --> K["Türkiye için resmi yangın tehlike sınıfı değil"]
```

**Önemli sınır:**

Bu proje **relative wildfire risk** verir. Yani "bu hava koşullarında risk daha düşük mü, daha yüksek mi?" sorusuna cevap verir.


---

## 4. Kullanıcılar

```mermaid
flowchart LR
    A["Orman görevlisi"] --> C["Yerel alanı izler"]
    B["Afet yönetimi yetkilisi"] --> D["Bölgesel öncelik görür"]
    C --> E["FIREWATCH DSS"]
    D --> E
```

**İki ana kullanıcı:**

- Orman görevlisi: yerel risk ve önerilen aksiyon.
- Afet yönetimi yetkilisi: bölgesel öncelik ve izleme.


---

## 5. Genel Mimari

```mermaid
flowchart LR
    U["Kullanıcı"] --> F["Frontend<br/>React + TypeScript"]
    F --> MB["Mapbox<br/>harita"]
    F --> API["Backend<br/>FastAPI"]
    API --> W["Weather API<br/>Open-Meteo"]
    API --> OW["OpenWeather<br/>fallback"]
    API --> ML["ML Model<br/>scikit-learn"]
    API --> R["Kural tablosu<br/>aksiyon + uyarı"]
    API --> G["Groq<br/>açıklama metni"]
    API --> DB["SQLite<br/>geçmiş + uyarılar"]
```

**Tek cümle:**

Frontend sadece gösterir ve kullanıcı etkileşimini yönetir. Backend ise risk kararının ana kaynağıdır.


---

## 6. Canlı Değerlendirme Akışı

```mermaid
sequenceDiagram
    participant U as Kullanıcı
    participant F as Frontend
    participant A as FastAPI Backend
    participant W as Open-Meteo
    participant M as ML Model
    participant D as Karar Kuralları
    participant DB as SQLite

    U->>F: Konum seçer
    F->>A: POST /api/assessments
    A->>W: Hava ve tahmin verisi ister
    W-->>A: now, 24h, 48h, 72h verileri
    A->>A: Veriyi normalize eder
    A->>M: 6 runtime feature gönderir
    M-->>A: Risk skoru + güven değeri
    A->>D: Risk seviyesi ve aksiyon seçer
    A->>DB: Geçmiş ve uyarı kaydeder
    A-->>F: Tam assessment response
    F-->>U: Harita, panel, history güncellenir
```


---

## 7. Frontend Nasıl Çalışıyor?

```mermaid
flowchart TB
    A["AppShell"] --> B["TopBar<br/>view + theme + settings"]
    A --> C["MapCanvas<br/>Mapbox + seçili konum"]
    A --> D["MapSearch<br/>Türkiye konum arama"]
    A --> E["LocationInfoPanel<br/>kısa sonuç"]
    A --> F["DecisionSupportPanel<br/>detaylı assessment"]
    A --> G["MonitoringRail<br/>aktif risk uyarıları"]
    A --> H["PredictionHistoryPanel<br/>geçmiş kayıtlar"]
    A --> I["SettingsDrawer<br/>model + sistem durumu"]
```

**Frontend görevi:**

- Harita merkezli dashboard.
- Konum arama ve haritadan konum seçme.
- Risk paneli, uyarılar, geçmiş ve sistem durumu.
- Dark/light tema.
- Model algoritması seçme desteği.


---

## 8. Backend Nasıl Çalışıyor?

```mermaid
flowchart LR
    A["Request<br/>konum + forecast windows"] --> B["Weather client"]
    B --> C["Normalization<br/>birimler düzeltilir"]
    C --> D["Runtime feature contract"]
    D --> E["PredictionService"]
    E --> F["Thresholds<br/>risk level"]
    F --> G["Recommendation rules"]
    G --> H["Narrative briefing"]
    H --> I["History + alerts"]
    I --> J["API response"]
```

**Backend sorumlulukları:**

- Hava verisi almak.
- Birimleri standart hale getirmek.
- Model girişlerini doğrulamak.
- Risk seviyesini ve öneriyi üretmek.
- Uyarı ve geçmiş kayıtlarını tutmak.
- Servis bozulursa bunu açıkça göstermek.


---

## 9. Hava Verisi ve Forecast Window

```mermaid
flowchart TB
    A["Open-Meteo"] --> B["Hourly forecast"]
    B --> C["now"]
    B --> D["24h"]
    B --> E["48h"]
    B --> F["72h"]

    C --> G["Aynı ML modeli"]
    D --> G
    E --> G
    F --> G
    G --> H["Her zaman penceresi için risk"]
```

**Kullanılan kaynak:**

- Varsayılan: Open-Meteo.
- Fallback: OpenWeather, API key varsa.
- Hava kaynakları yangın olayı kaynağı değildir.


---

## 10. Model Feature Contract

```mermaid
flowchart LR
    A["Weather API"] --> B["Normalize"]
    B --> C["6 model input"]
    C --> D["ML model"]

    C --> F1["temperature_c"]
    C --> F2["temperature_min_c"]
    C --> F3["temperature_max_c"]
    C --> F4["rain_mm"]
    C --> F5["wind_speed_mps"]
    C --> F6["wind_gust_mps"]
```

| Feature | Birim | Neden kullanılıyor? |
| --- | --- | --- |
| temperature_c | C | Sıcaklık riski etkiler |
| temperature_min_c | C | Günlük düşük sıcaklık |
| temperature_max_c | C | Günlük yüksek sıcaklık |
| rain_mm | mm | Yağış riski düşürebilir |
| wind_speed_mps | m/s | Rüzgar yayılmayı etkiler |
| wind_gust_mps | m/s | Ani rüzgar riski artırabilir |


---

## 11. ML Eğitim Süreci

```mermaid
flowchart LR
    A["Morocco Wildfire Dataset<br/>2010-2022"] --> B["Temizlik + unit conversion"]
    B --> C["Sadece runtime features"]
    C --> D["7 algoritma eğitildi"]
    D --> E["Validation + confusion matrix"]
    E --> F["Seçilen model<br/>stacking_hybrid"]
    F --> G["model.joblib"]
    G --> H["FastAPI runtime prediction"]
```

**Dataset:**

- Morocco Wildfire Dataset, 2010-2022.
- Türkiye verisi olmadığı için proxy dataset kullanıldı.
- Sonuçlar Türkiye için resmi doğruluk değildir.


---

## 12. Kaç Algoritma Kullandım?

**Toplam 7 algoritma / model adayı test edildi:**

| Algoritma | Rol |
| --- | --- |
| Logistic Regression | Basit baseline |
| Random Forest | Ağaç tabanlı güçlü model |
| Extra Trees | Daha rastgele ağaç ensemble |
| Gradient Boosting | Boosting tabanlı model |
| XGBoost | Güçlü boosting adayı |
| Soft Voting Hybrid | Birden çok modelin oylaması |
| Stacking Hybrid | Seçilen serving model |


---

## 13. Model Performansı

```mermaid
flowchart TB
    A["Proxy validation<br/>daha yüksek skor"] --> C["Accuracy 82.62%<br/>ROC-AUC 91.27%<br/>Recall 81.85%"]
    B["Grouped validation<br/>daha zor ve dürüst test"] --> D["Accuracy 58.11%<br/>ROC-AUC 65.24%<br/>Recall 32.33%"]
    C --> E["Sonuç: prototip için iyi sinyal"]
    D --> F["Sonuç: Türkiye için kesin doğruluk iddiası yok"]
```

**Seçilen model: `stacking_hybrid`**

| Metrik | Normal proxy validation | Grouped validation |
| --- | ---: | ---: |
| Accuracy | 82.62% | 58.11% |
| ROC-AUC | 91.27% | 65.24% |
| Wildfire precision | 83.06% | 66.79% |
| Wildfire recall | 81.85% | 32.33% |
| Wildfire F1 | 82.45% | 43.57% |


---

## 14. Neden Daha Yüksek Performans Alamadım?

```mermaid
flowchart TB
    A["Performans limiti"] --> B["Türkiye için etiketli veri yok"]
    A --> C["Morocco proxy dataset kullanıldı"]
    A --> D["Sadece runtime features seçildi"]
    A --> E["Güçlü ama canlı olmayan kolonlar çıkarıldı"]
    A --> F["Gerçek dünya hava-yangın ilişkisi karmaşık"]

    E --> G["NDVI çıkarıldı"]
    E --> H["Soil moisture çıkarıldı"]
    E --> I["Koordinat ve istasyon metadata çıkarıldı"]
    E --> J["15 günlük lag ve uzun geçmiş çıkarıldı"]
```

**Basit açıklama:**

Modeli daha yüksek göstermek mümkündü, ama bu doğru olmazdı. Çünkü bazı güçlü kolonlar canlı Türkiye kullanımında yoktu.


---

## 15. Risk Skoru Nasıl Karara Dönüşüyor?

```mermaid
flowchart LR
    A["Risk score<br/>0 - 1"] --> B{"Threshold"}
    B --> C["low<br/><= 0.33"]
    B --> D["medium<br/><= 0.66"]
    B --> E["high<br/>< 0.85"]
    B --> F["critical<br/>>= 0.85"]
```

| Risk level | Önerilen aksiyon | Monitoring radius | Alert |
| --- | --- | --- | --- |
| low | routine monitoring | 5 km | yok |
| medium | increase weather review | 10 km | yok |
| high | prioritize local inspection | 20 km | 24 saat |
| critical | immediate supervisor review | 30 km | 12 saat |


---

## 16. LLM / Groq Katmanı

```mermaid
flowchart LR
    A["Structured assessment payload"] --> B["Groq narrative provider"]
    B --> C["Kısa açıklama metni"]
    A --> D["Template fallback"]
    D --> C
```

**Önemli nokta:**

LLM risk skorunu üretmez. LLM sadece backend'in ürettiği güvenli ve yapılandırılmış bilgileri basit açıklama metnine çevirir.


---

## 17. Veri Kaynağı Etiketleri ve Güvenilirlik

```mermaid
flowchart TB
    A["Data source label"] --> B["live"]
    A --> C["fallback"]
    A --> D["cached"]
    A --> E["demo"]
    A --> F["unavailable"]

    B --> G["Kullanıcı neyin gerçek canlı veri olduğunu görür"]
    E --> H["Demo veri, canlı assessment gibi gösterilmez"]
```


---

## 18. Canlı Demo Planı

```mermaid
flowchart TB
    A["1. Dashboard aç"] --> B["2. Sistem durumunu göster"]
    B --> C["3. Ankara ara"]
    C --> D["4. Sonucu seç"]
    D --> E["5. Harita + kısa panel"]
    E --> F["6. Full assessment aç"]
    F --> G["7. Forecast windows göster"]
    G --> H["8. Weather signals + model drivers"]
    H --> I["9. Recommended action + alert"]
    I --> J["10. History panel"]
    J --> K["11. Settings/model evidence"]
```


---

## 18A. Kullanıcı Perspektifi: Genel Kullanım

```mermaid
flowchart LR
    A["1. Dashboard açılır"] --> B["2. Türkiye konumu seçilir"]
    B --> C["3. Risk sonucu okunur"]
    C --> D["4. Önerilen aksiyon görülür"]
    D --> E["5. Forecast ve hava sinyalleri kontrol edilir"]
    E --> F["6. History ve alert takip edilir"]
```

**Kullanıcı ne yapar?**

- Dashboard'u açar.
- Haritadan veya aramadan bir Türkiye konumu seçer.
- Risk seviyesini ve skoru okur.
- Sistem önerisini ve izleme yarıçapını kontrol eder.
- Gerekirse forecast, history ve alert bölümlerine bakar.


---

## 18B. Demo Sırası: Kullanıcı Yolculuğu

```mermaid
flowchart TB
    A["Başla"] --> B["Dashboard'u göster"]
    B --> C["Sistem durumunu göster"]
    C --> D["Ankara veya başka konum ara"]
    D --> E["Konumu seç"]
    E --> F["Risk seviyesi + skor göster"]
    F --> G["Önerilen aksiyonu oku"]
    G --> H["Forecast pencerelerini göster"]
    H --> I["History ve alert panelini göster"]
    I --> J["Limitasyonu açıkla"]
    J --> K["Bitir"]
```

**Demo adımları:**

1. Dashboard'u aç.
2. Sistem durumunu göster.
3. Bir Türkiye konumu ara.
4. Konumu seç ve sonucu bekle.
5. Risk seviyesini, skoru ve öneriyi anlat.
6. Forecast, history ve alert panellerini göster.
7. Sonunda model limitasyonunu açıkça söyle.


---


## 20. En Güçlü Taraf

```mermaid
mindmap
  root((Güçlü taraflar))
    Uçtan uca sistem
      Frontend
      Backend
      ML runtime
      Weather API
      Database
    Dürüst model kapsamı
      Proxy dataset
      Transfer limitation
      Runtime features only
    Operasyonel dashboard
      Mapbox
      Forecast windows
      Alerts
      History
```


> En güçlü tarafı, sadece notebook modeli olmaması. Model gerçek backend içinde çalışıyor. Frontend, API, hava entegrasyonu, persistence, uyarılar ve açıklama katmanı birlikte uçtan uca çalışıyor.

---

## 21. En Büyük Limitasyon


> En büyük limitasyon Türkiye için etiketli ve güvenilir wildfire outcome dataset eksikliği. Bu yüzden Fas veri seti proxy olarak kullanıldı. Sonuçlar resmi Türkiye doğruluğu değildir. Operasyonel kullanım için Türkiye yangın kayıtları ile tekrar eğitim ve validasyon gerekir.


---

## 22. Teknoloji Seçimi

| Teknoloji | Neden seçildi? |
| --- | --- |
| React + TypeScript | Harita ve panel tabanlı interaktif dashboard için |
| Vite | Hızlı frontend geliştirme |
| Mapbox GL JS | Türkiye merkezli interaktif harita için |
| FastAPI | Python ML modeli ile kolay backend entegrasyonu |
| scikit-learn + joblib | Model eğitimi ve runtime model artifact için |
| Open-Meteo | API key gerektirmeyen hava verisi için |
| OpenWeather | Hava servisi fallback için |
| Groq | Kısa açıklama metni üretmek için |
| SQLite | MVP için basit persistence |


---

## 23. Kapanış

```mermaid
flowchart LR
    A["Problem"] --> B["Türkiye'de erken risk farkındalığı"]
    B --> C["Çözüm"]
    C --> D["Canlı hava + ML + karar destek dashboard"]
    D --> E["Sonuç"]
    E --> F["Uçtan uca çalışan prototip"]
```


> FIREWATCH DSS, orman yangını riskini aktif yangın tespiti olarak değil, erken karar desteği olarak ele alır. Proje canlı hava verisi, makine öğrenmesi, backend kuralları ve harita tabanlı frontend'i birleştirerek uçtan uca çalışan bir prototip sunar.

---

## 24. 1 Dakikalık Özet

> Projemin adı FIREWATCH DSS. Türkiye için hava verisine dayalı orman yangını risk karar destek sistemidir. Kullanıcı haritadan veya aramadan konum seçer. Backend Open-Meteo'dan canlı hava verisini alır. Veriler normalize edilir ve 6 runtime feature ile makine öğrenmesi modeli çalışır. Model risk skoru üretir. Backend bu skoru low, medium, high veya critical seviyesine çevirir. Sonra önerilen aksiyon, izleme yarıçapı, forecast sonuçları, history ve alert bilgisi frontend'de gösterilir. Model Fas wildfire dataset'i ile eğitildiği için sonuçlar Türkiye için resmi doğruluk değildir. Bu proje bir aktif yangın tespit sistemi değil, dürüst kapsamlı bir karar destek prototipidir.

