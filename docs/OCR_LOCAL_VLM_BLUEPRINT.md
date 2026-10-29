# BLUEPRINT ARSITEKTUR OCR VLM RINGAN ON-DEVICE (BROWSER PWA)
**Proyek:** MyDuit PWA (Offline-First Financial Management)  
**Dokumen:** Spesifikasi & Blueprint Teknis Integrasi OCR VLM Lokal  
**Target Runtime:** Browser HP (Android Chrome WebGPU/WASM) & Browser PC (Desktop WebGPU/WASM)  

---

## 1. Latar Belakang & Akar Masalah Engine OCR Saat Ini

### Limitasi Tesseract.js (Engine Eksisting)
1. **Model Klasik Non-Semantik:** Tesseract.js mengandalkan segmentasi garis dan fitur piksel (*pattern matching*). Pada struk belanja fisik yang terlipat, pudar tintanya (struk termal Indomaret/Alfamart), atau difoto miring, karakter angka sering tertukar:
   - `8` terbaca `0` atau `B`
   - `5` terbaca `6` atau `S`
   - Koma/titik ribuan sering hilang atau dianggap debu piksel.
2. **Ketergantungan pada Regex Parsing Kaku:** Tesseract hanya menghasilkan teks mentah (*raw string*). Untuk mengekstrak `Total`, `Merchant`, dan `Tanggal`, aplikasi harus mengandalkan regular expression di `src/lib/ocrStruk.js` dan `src/lib/strukMeta.js`. Jika layout struk bervariasi (misalnya total ditulis di kanan bawah sejajar diskon), regex rentan salah memilih angka terbesar.

---

## 2. Hasil Riset Model Vision & OCR On-Device Terbaik (2026)

Berdasarkan investigasi pustaka terbuka di Hugging Face, GitHub, dan runtime web browser:

| Model Candidate | Parameter | Ukuran Model (Quantized) | Runtime Web | Keunggulan Struk | Beban Perangkat HP |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Microsoft Florence-2-base** | 0.23B | **~140 MB – 220 MB** (q4 / fp16) | Transformers.js v3 (`@huggingface/transformers`) WebGPU | Sangat akurat pada teks padat, ada task khusus `<OCR>` dan `<OCR_WITH_REGION>` | Ringan-Menengah (Butuh WebGPU atau fallback WASM) |
| **PP-OCRv5 / v6 Tiny** | ~10M | **~15 MB – 25 MB** | ONNX Runtime Web (`ppu-paddle-ocr`) | Deteksi teks miring/berantakan sangat cepat, ukuran super kecil | Sangat Ringan (Lancar di semua HP low-end) |
| **SmolVLM-256M-Instruct** | 0.25B | **~180 MB** (q4f16) | Transformers.js v3 WebGPU | Bisa langsung output JSON terstruktur via prompt | Menengah (Butuh RAM browser ~1 GB) |
| **Chrome Built-in AI (Prompt API)** | ~1.5B (Gemini Nano) | **0 MB** (Sudah ada di OS/Chrome) | `window.ai` / Chrome Built-in AI | Zero-download, zero footprint di PWA | Terbatas pada Chrome versi tertentu dengan flag aktif |

---

## 3. Desain Arsitektur Hybrid OCR 3-Tier (Solusi Ideal MyDuit PWA)

Agar pengguna HP tidak terbebani kuota ratusan MB saat pertama kali menggunakan scan struk, diterapkan arsitektur **Adaptive Multi-Tier**:

```text
               +-----------------------------------+
               |       Foto Struk Pengguna         |
               +-----------------+-----------------+
                                 |
                                 v
               +-----------------------------------+
               |  Tier 0: Deteksi WebGPU & Memori  |
               +-----------------+-----------------+
                                 |
        +------------------------+------------------------+
        | (Koneksi Seluler / Low-End)                     | (WiFi / Device Support)
        v                                                 v
+-------------------------------+             +-------------------------------+
| Tier 1: Fast OCR (Tesseract / |             | Tier 2: Local Vision Model    |
| PP-OCR Tiny ~15MB)            |             | (Florence-2 WebGPU ~140MB)    |
| - Waktu: 1 - 2 detik          |             | - Waktu: 2 - 3 detik (GPU)    |
| - Ekstraksi: Regex Parser     |             | - Grounded OCR & Token Task   |
+---------------+---------------+             +---------------+---------------+
                |                                             |
                | (Confidence < 70% atau                      | (Ekstraksi Akurat)
                |  user klik "Scan Ulang dgn AI")             |
                +----------------------->+<-------------------+
                                         |
                                         v
                         +-------------------------------+
                         |  Ekstraksi Entitas Otomatis   |
                         |  (Total, Tanggal, Merchant)   |
                         +---------------+---------------+
                                         |
                                         v
                         +-------------------------------+
                         |  Auto-Fill Form Transaksi     |
                         +-------------------------------+
```

---

## 4. Spesifikasi Implementasi Transformers.js v3 (Florence-2)

### A. Dependensi Baru
```bash
npm install @huggingface/transformers
```

### B. Arsitektur Worker Terisolasi (`ocrVlmWorker.js`)
Agar inferensi model machine learning tidak memblokir UI thread dan animasi claymorphism tetap 60 FPS:

```javascript
// src/lib/workers/florenceOcrWorker.js
import { Florence2ForConditionalGeneration, AutoProcessor, AutoTokenizer, RawImage } from '@huggingface/transformers'

let model = null
let processor = null
let tokenizer = null

self.onmessage = async (e) => {
  const { type, imageBlob, promptType } = e.data
  
  if (type === 'INIT') {
    const model_id = 'onnx-community/Florence-2-base-ft'
    // Otomatis memilih WebGPU jika tersedia, fallback ke WASM
    const device = navigator.gpu ? 'webgpu' : 'wasm'
    
    self.postMessage({ status: 'PROGRESS', message: `Memuat model AI (${device})...` })
    
    model = await Florence2ForConditionalGeneration.from_pretrained(model_id, {
      dtype: {
        embed_tokens: 'fp16',
        vision_encoder: 'fp16',
        encoder_model: 'q4',
        decoder_model_merged: 'q4',
      },
      device,
    })
    processor = await AutoProcessor.from_pretrained(model_id)
    tokenizer = await AutoTokenizer.from_pretrained(model_id)
    self.postMessage({ status: 'READY' })
    return
  }

  if (type === 'PROCESS') {
    const image = await RawImage.fromBlob(imageBlob)
    const taskPrompt = promptType || '<OCR>' // atau '<OCR_WITH_REGION>'
    
    const inputs = await processor(image, taskPrompt)
    const generatedIds = await model.generate({
      ...inputs,
      max_new_tokens: 1024,
    })
    
    const generatedText = tokenizer.batch_decode(generatedIds, { skip_special_tokens: false })[0]
    const parsedResult = processor.post_process_generation(generatedText, taskPrompt, image.size)
    
    self.postMessage({ status: 'SUCCESS', result: parsedResult[taskPrompt] })
  }
}
```

---

## 5. Rencana Migrasi & Tahapan Implementasi

1. **Tahap 1 (Optimasi Regex & Pra-proses OpenCV/Sauvola):** Mempertahankan bundle ringan saat ini, menyempurnakan normalisasi karakter numerik di `ocrStruk.js`.
2. **Tahap 2 (Implementasi Web Worker Florence-2 On-Demand):** Menambahkan opsi tombol *"Tingkatkan Akurasi dengan AI Vision Lokal"* di modal scan struk. Pengguna diberi tahu estimasi unduhan cache pertama kali (~140MB) dan model di-cache permanen di CacheStorage PWA.
3. **Tahap 3 (Hybrid Auto-Switching):** Jika hasil Tesseract memiliki `confidence < 75%` atau gagal menemukan angka total yang valid, tawarkan transisi halus ke model Florence-2.

---
Dokumen ini menjadi acuan baku bagi pengembangan fitur OCR AI on-device pada rilis mendatang MyDuit PWA.
