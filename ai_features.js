/**
 * AI & NLP Özellikleri
 * Zeka Küpü (OCR) ve Sihirli Komut Satırı (NLP) Entegrasyonu
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. SİHİRLİ KOMUT SATIRI (NLP) INIT
    const magicContainer = document.getElementById('magic-command-container');
    const btnAddExam = document.getElementById('btn-add-exam');
    const magicInput = document.getElementById('magic-command-input');
    const btnMagicApply = document.getElementById('btn-magic-apply');
    const magicStatus = document.getElementById('magic-command-status');

    if(btnAddExam) {
        btnAddExam.addEventListener('click', () => {
            if(magicContainer) magicContainer.classList.remove('hidden');
        });
    }

    // Modal iptal edilince magic alanı temizlensin
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    if(btnModalCancel) {
        btnModalCancel.addEventListener('click', () => {
            if(magicInput) magicInput.value = '';
            if(magicStatus) magicStatus.innerHTML = '';
        });
    }

    if(magicInput && btnMagicApply) {
        magicInput.addEventListener('input', (e) => {
            const parsed = parseMagicCommand(e.target.value);
            displayMagicStatus(parsed, magicStatus);
        });

        magicInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                e.preventDefault();
                applyMagicCommandToForm();
            }
        });

        btnMagicApply.addEventListener('click', (e) => {
            e.preventDefault();
            applyMagicCommandToForm();
        });
    }

    function applyMagicCommandToForm() {
        const text = magicInput.value;
        if(!text.trim()) return;
        const parsed = parseMagicCommand(text);

        // Zorunlu alanlar kontrolü
        if(!parsed.course && !parsed.type) {
            magicStatus.innerHTML = '<span style="color:#ef4444;">⚠️ Sınav adı veya türü anlaşılamadı.</span>';
            return;
        }
        if(!parsed.date || !parsed.time) {
            magicStatus.innerHTML = '<span style="color:#ef4444;">⚠️ Tarih ve saat bilgisi gerekli (örn: Pazartesi 10:00).</span>';
            return;
        }

        // AI ile en iyi gözetmeni bul
        const duration = parsed.duration || 90;
        const recommended = typeof getRecommendedProctors === 'function'
            ? getRecommendedProctors(parsed.date, parsed.time, duration)
            : [];
        const bestProctor = recommended.length > 0 ? recommended[0] : null;

        // Modalı kapat, onay kartı göster
        document.getElementById('modal').classList.add('hidden');
        showMagicConfirmCard({
            type:     parsed.type     || (DB.examTypes && DB.examTypes[0]) || 'Vize',
            name:     parsed.course   || 'Sınav',
            date:     parsed.date,
            time:     parsed.time,
            duration: duration,
            location: parsed.location || 'Belirtilmedi',
            lecturer: '-',
            capacity: '-'
        }, bestProctor, recommended);
    }

    /**
     * "AI ile Sınav Ekle" Onay Kartı - Modal'ın içine entegre edilir
     */
    function showMagicConfirmCard(examData, bestProctor, allRecommended) {
        // Var olan onay kartını kaldır (çift çağrı önlemi)
        const existing = document.getElementById('magic-confirm-overlay');
        if(existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'magic-confirm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';

        const proctorOpts = allRecommended.map(p =>
            `<option value="${p.id}">${p.name} — ${p.reason || ''}</option>`
        ).join('');

        const noneOpt = `<option value="">— Gözetmensiz Kaydet —</option>`;

        overlay.innerHTML = `
        <div style="background:linear-gradient(145deg,#1e1b4b,#0f172a);border:1px solid #6366f1;border-radius:20px;padding:2rem;max-width:520px;width:100%;box-shadow:0 0 60px rgba(99,102,241,0.4);">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.5rem;">
                <div style="font-size:2rem;filter:drop-shadow(0 0 10px #a78bfa);">🪄</div>
                <div>
                    <h2 style="margin:0;color:#a78bfa;font-size:1.1rem;">Sihirli Komut — Onay</h2>
                    <p style="margin:0;color:var(--text-muted);font-size:0.8rem;">AI aşağıdaki bilgileri derledi. Onaylayınca kayıt yapılır.</p>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1.5rem;">
                  ${infoTile('📋 Tür', examData.type)}
                  ${infoTile('📚 Sınav Adı', examData.name)}
                  ${infoTile('📅 Tarih', examData.date)}
                  ${infoTile('🕐 Saat', examData.time)}
                  ${infoTile('⌛ Süre', examData.duration + ' dk')}
                  ${infoTile('📍 Yer', examData.location)}
            </div>

            <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:14px;margin-bottom:1.5rem;">
                <div style="font-size:0.8rem;color:#10b981;font-weight:700;margin-bottom:8px;">🤖 AI Gözetmen Seçimi</div>
                ${allRecommended.length > 0
                    ? `<select id="magic-proctor-select" style="width:100%;background:rgba(0,0,0,0.4);border:1px solid #10b981;padding:0.6rem;border-radius:8px;color:white;font-size:0.9rem;">
                         ${proctorOpts}
                         ${noneOpt}
                       </select>
                       <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">
                           En iyi öneri: <strong style="color:#34d399;">${allRecommended[0].name}</strong> (${allRecommended[0].reason || 'Müsait'})
                       </div>`
                    : `<div style="color:#f59e0b;font-size:0.85rem;">⚠️ Bu tarih/saatte müsait gözetmen bulunamadı. Gözetmensiz kaydedilecek.</div>
                       <input type="hidden" id="magic-proctor-select" value="">`
                }
            </div>

            <div style="display:flex;gap:10px;">
                <button id="btn-magic-cancel" style="flex:1;padding:0.9rem;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);border-radius:10px;color:var(--text-muted);cursor:pointer;font-size:0.95rem;">Vazgeç</button>
                <button id="btn-magic-confirm" style="flex:2;padding:0.9rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:white;font-weight:700;cursor:pointer;font-size:0.95rem;box-shadow:0 0 20px rgba(99,102,241,0.4);">✅ Sınavı Ekle</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        document.getElementById('btn-magic-cancel').onclick = () => {
            overlay.remove();
            // Formu tekrar aç ki kullanıcı düzenleyebilsin
            document.getElementById('modal').classList.remove('hidden');
        };

        document.getElementById('btn-magic-confirm').onclick = async () => {
            const select = document.getElementById('magic-proctor-select');
            const proctorId = select && select.value ? parseInt(select.value) : null;

            const payload = {
                ...examData,
                proctorId:  proctorId || undefined,
                proctorIds: proctorId ? [proctorId] : []
            };

            // addExam logic.js'deki fonksiyon
            const result = addExam(payload);

            if(result) {
                overlay.remove();
                magicInput.value = '';
                magicStatus.innerHTML = '';
                // Backend'e kaydet
                if(typeof saveToBackend === 'function') saveToBackend();
                // Render
                if(typeof renderExams === 'function') renderExams();
                if(typeof renderDashboard === 'function') renderDashboard();
                if(typeof renderSchedule === 'function') renderSchedule();
                if(typeof showToast === 'function') {
                    showToast(`✅ "${examData.name}" sınavı eklendi ve ${proctorId ? allRecommended.find(p=>p.id===proctorId)?.name : 'gözetmensiz'} olarak kaydedildi.`);
                }
            }
            // addExam zaten alert() veriyor, hata durumunda overlay açık kalıyor
        };
    }

    function infoTile(label, value) {
        return `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 14px;">
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px;">${label}</div>
                    <div style="font-size:0.9rem;font-weight:600;color:white;">${value || '—'}</div>
                </div>`;
    }

    function displayMagicStatus(parsed, statusEl) {
        if(!statusEl) return;
        statusEl.innerHTML = '';
        
        const createBadge = (icon, text) => {
            const span = document.createElement('span');
            span.style.cssText = "background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 12px; font-weight: 600;";
            span.textContent = `${icon} ${text}`;
            return span;
        };

        if(parsed.date) statusEl.appendChild(createBadge('📅', parsed.date));
        if(parsed.time) statusEl.appendChild(createBadge('🕰️', parsed.time));
        if(parsed.duration) statusEl.appendChild(createBadge('⌛', parsed.duration + ' dk'));
        if(parsed.location) statusEl.appendChild(createBadge('📍', parsed.location));
        if(parsed.type) statusEl.appendChild(createBadge('📋', parsed.type));
        if(parsed.course) statusEl.appendChild(createBadge('📚', parsed.course));
    }


    /*
     * NLP Parser Algoritması 
     */
    function parseMagicCommand(text) {
        const result = {
            date: null,
            time: null,
            duration: null,
            course: null,
            location: null,
            type: null
        };
        
        if(!text) return result;
        
        let workingText = text.toLowerCase();

        // 1. SÜRE TAHMİNİ (örnek: "120 dk", "120 dakika", "2 saat", "1.5 saat")
        const durationRegex = /(\d+(?:\.\d+)?)\s*(dk|dakika|saat)\b/i;
        const durMatch = workingText.match(durationRegex);
        if(durMatch) {
            let val = parseFloat(durMatch[1]);
            const unit = durMatch[2];
            if(unit === 'saat') val = val * 60;
            result.duration = Math.round(val);
            workingText = workingText.replace(durMatch[0], ''); // çıkar
        }

        // 2. SAAT TAHMİNİ (örnek: "10:30", "14.00")
        const timeRegex = /\b([0-1]?[0-9]|2[0-3])[:.]([0-5][0-9])\b/;
        const timeMatch = workingText.match(timeRegex);
        if(timeMatch) {
            result.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
            workingText = workingText.replace(timeMatch[0], '');
        }

        // 3. TÜR TAHMİNİ
        const types = ['vize', 'final', 'bütünleme', 'mazeret', 'ek sınav'];
        for(const t of types) {
            if(workingText.includes(t)) {
                // capitalize
                result.type = t.charAt(0).toUpperCase() + t.slice(1);
                workingText = workingText.replace(t, '');
                break;
            }
        }

        // 4. KONUM TAHMİNİ (Amfi, Z-05, D-102 gibi)
        // Amfi kelimesi veya Tireli/Ardışık rakamlı ve harfli kodlar
        const locRegex = /(amfi[\s-]?\d+|z-\d+|d-\d+|derslik[\s-]?\d+)/i;
        const locMatch = workingText.match(locRegex);
        if(locMatch) {
            result.location = text.substring(locMatch.index, locMatch.index + locMatch[0].length).trim(); 
            // Orijinal metinden büyük/küçük harfini koruyarak almak için text.substring kullanıldı
            // Ancak index kaymasını önlemek için exec vb. daha iyi olabilir.
            // Basitlik adına baş harfi büyütelim
            result.location = locMatch[0].replace(/\b\w/g, l => l.toUpperCase());
            workingText = workingText.replace(locMatch[0], '');
        }

        // 5. TARİH TAHMİNİ 
        // Bugün, yarın, pazartesi veya 12 nisan vb.
        const today = new Date();
        if(workingText.includes('yarın')) {
            const t = new Date();
            t.setDate(today.getDate() + 1);
            result.date = t.toISOString().split('T')[0];
            workingText = workingText.replace('yarın', '');
        } else if(workingText.includes('bugün')) {
            result.date = today.toISOString().split('T')[0];
            workingText = workingText.replace('bugün', '');
        } else {
            // Gün isimleri
            const days = { 'pazartesi': 1, 'salı': 2, 'çarşamba': 3, 'perşembe': 4, 'cuma': 5, 'cumartesi': 6, 'pazar': 0 };
            for(const [dName, dNum] of Object.entries(days)) {
                if(workingText.includes(dName)) {
                    let d = new Date();
                    d.setDate(d.getDate() + ((dNum + 7 - d.getDay()) % 7));
                    if(d.getDay() === today.getDay()) d.setDate(d.getDate() + 7); // Eğer aynı günse haftaya
                    result.date = d.toISOString().split('T')[0];
                    workingText = workingText.replace(dName, '');
                    break;
                }
            }
            
            // Format 12.04 veya 12/04 
            const dateRegex = /\b(\d{1,2})[\/\.](\d{1,2})(?:[\/\.](\d{2,4}))?\b/;
            const dMatch = workingText.match(dateRegex);
            if(dMatch && !result.date) {
                const dd = dMatch[1].padStart(2, '0');
                const mm = dMatch[2].padStart(2, '0');
                const yy = dMatch[3] ? (dMatch[3].length === 2 ? "20"+dMatch[3] : dMatch[3]) : today.getFullYear();
                result.date = `${yy}-${mm}-${dd}`;
                workingText = workingText.replace(dMatch[0], '');
            }
        }

        // 6. DERS ADI TAHMİNİ (Kalan metin)
        // Kalan gereksiz kelimeleri temizle (saat, da, de, sınavı vs)
        workingText = workingText.replace(/\b(saat|da|de|ta|te|sınavı)\b/g, '').trim();
        workingText = workingText.replace(/\s+/g, ' '); // çoklu boşlukları tek yap
        
        if (workingText.length > 2) {
            // Orijinal metinden ilgili kelimenin büyük-küçük harfli halini yakalamaya çalışalım
            // Veya basitçe kelime başlarını büyük harf yapalım
            result.course = workingText.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        return result;
    }


    // ----------------------------------------------------------------------
    // 2. ZEKA KÜPÜ (OCR) INIT
    // ----------------------------------------------------------------------
    const btnImportOcr = document.getElementById('btn-import-ocr');
    const modalOcrUpload = document.getElementById('modal-ocr-upload');
    const ocrDropBtn = document.getElementById('ocr-drop-btn');
    const ocrImportInput = document.getElementById('ocr-import-input');
    const ocrDropZone = document.getElementById('ocr-drop-zone');
    
    if(btnImportOcr) {
        btnImportOcr.addEventListener('click', () => {
            if(modalOcrUpload) modalOcrUpload.classList.remove('hidden');
        });
    }

    if(ocrDropZone && ocrImportInput) {
        ocrDropZone.addEventListener('click', () => ocrImportInput.click());
        
        ocrDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            ocrDropZone.style.background = "rgba(16, 185, 129, 0.1)"; // yeşil ton
            ocrDropZone.style.borderColor = "#10b981";
        });
        
        ocrDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            ocrDropZone.style.background = "rgba(245, 158, 11, 0.05)";
            ocrDropZone.style.borderColor = "rgba(245, 158, 11, 0.5)";
        });

        ocrDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            ocrDropZone.style.background = "rgba(245, 158, 11, 0.05)";
            ocrDropZone.style.borderColor = "rgba(245, 158, 11, 0.5)";
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleOcrFileContent(e.dataTransfer.files[0]);
            }
        });

        ocrImportInput.addEventListener('change', (e) => {
            if(e.target.files && e.target.files.length > 0) {
                handleOcrFileContent(e.target.files[0]);
            }
        });
    }

    async function handleOcrFileContent(file) {
        if(!file.type.startsWith('image/')) {
            alert('Lütfen sadece resim dosyası (.png, .jpg) yükleyin.');
            return;
        }

        const loadingArea = document.getElementById('ocr-loading-area');
        const progressBar = document.getElementById('ocr-progress-bar');
        const progressText = document.getElementById('ocr-progress-text');
        const dropZone = document.getElementById('ocr-drop-zone');

        loadingArea.classList.remove('hidden');
        dropZone.classList.add('hidden');
        progressText.textContent = "0% - Tesseract Başlatılıyor";
        progressBar.style.width = "0%";

        try {
            // Tesseract CDN HTML'de ekli olmalı.
            if(typeof Tesseract === 'undefined') {
                throw new Error("Tesseract kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
            }

            const worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round(m.progress * 100);
                        progressBar.style.width = pct + '%';
                        progressText.textContent = `${pct}% - Resim Okunuyor`;
                    } else {
                        progressText.textContent = m.status;
                    }
                }
            });

            await worker.loadLanguage('tur');
            await worker.initialize('tur');

            progressText.textContent = "Taranıyor...";
            const { data: { text } } = await worker.recognize(file);
            
            await worker.terminate();

            loadingArea.classList.add('hidden');
            dropZone.classList.remove('hidden');
            modalOcrUpload.classList.add('hidden'); // Ocr upload modali kapat

            processOcrText(text);

        } catch (error) {
            console.error(error);
            alert("Resim okuma sırasında hata: " + error.message);
            loadingArea.classList.add('hidden');
            dropZone.classList.remove('hidden');
        }
    }

    function processOcrText(text) {
        console.log("OCR'dan Gelen Saf Metin:\n", text);
        const lines = text.split('\n').filter(l => l.trim().length > 5);
        let parsedExams = [];

        // Her satırı NLP motorumuza gönderelim
        lines.forEach(line => {
            const parsed = parseMagicCommand(line);
            // Sınav kabul şartı: En azından tarih veya ders ismi veya saati olmalı.
            // Çünkü bazı satırlar sadece çöp metin olabilir.
            if(parsed.course && (parsed.date || parsed.time)) {
                // Saat yoksa default, Süre yoksa default 90 dk atayalım
                parsedExams.push({
                    type: parsed.type || 'Vize',
                    name: parsed.course,
                    lecturer: '-', 
                    date: parsed.date || new Date().toISOString().split('T')[0],
                    time: parsed.time || '10:00',
                    duration: parsed.duration || 90,
                    capacity: '-',
                    location: parsed.location || 'Belli Değil',
                    katsayi: getKatsayi(new Date(`${parsed.date || new Date().toISOString().split('T')[0]}T${parsed.time || '10:00'}`)),
                    proctorIds: [],
                    isDraft: true // OCR'dan gelenler de taslak olsun
                });
            }
        });

        if(parsedExams.length === 0) {
            alert('Görselde anlaşılır bir sınav verisi bulunamadı. Lütfen daha net bir resim deneyin.');
            return;
        }

        // Sınavları preview (Excel import) modaline aktar
        showOcrPreview(parsedExams);
    }
    
    // OCR sonuçlarını Excel preview modalinde (tablosunda) gösterme
    function showOcrPreview(exams) {
        // AI ile gözetmen önerme mantığı excel import'taki gibi
        exams.forEach(ex => {
            let recommended = window.getRecommendedProctors ? window.getRecommendedProctors(ex.date, ex.time, ex.duration) : [];
            ex.recommendedText = recommended.length > 0 ? `🤖 ${recommended[0].name}` : "⚠️ Bulunamadı";
            ex.recommendedId = recommended.length > 0 ? recommended[0].id : null;
        });

        // Global excelPreviewData listesine itip o modali açtırıyoruz. 
        // Böylece ekstra bir modal yazmaya gerek kalmıyor!
        if (window.excelPreviewData !== undefined) {
             window.excelPreviewData = exams; // existing excel import variables
        }

        const tbody = document.querySelector('#table-excel-preview tbody');
        if(!tbody) {
            alert("Önizleme tablosu bulunamadı.");
            return;
        }

        tbody.innerHTML = '';
        exams.forEach((ex, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" value="${ex.type}" class="import-edit import-type" data-idx="${idx}"></td>
                <td><input type="text" value="${ex.name}" class="import-edit import-name" data-idx="${idx}" style="font-weight:700;"></td>
                <td><input type="date" value="${ex.date}" class="import-edit import-date" data-idx="${idx}"></td>
                <td><input type="time" value="${ex.time}" class="import-edit import-time" data-idx="${idx}"></td>
                <td><input type="text" value="${ex.location}" class="import-edit import-loc" data-idx="${idx}"></td>
                <td><input type="number" value="${ex.duration}" class="import-edit import-dur" data-idx="${idx}" style="width:60px;"></td>
                <td style="color:var(--accent-green); font-size:0.85rem; font-weight:600;">${ex.recommendedText}</td>
            `;
            tbody.appendChild(tr);
        });

        // Eski modal var mı diye bak, yoksa göster
        const pMod = document.getElementById('modal-excel-preview');
        if (pMod) {
             // OCR uyarılarını güncellemek güzel olabilir ama excel preview generic kullanılabilir
             pMod.querySelector('h2').innerHTML = '📸 OCR\'dan Aktarılan Sınavlar';
             pMod.classList.remove('hidden');
             
             // Confirm butonu eventi değiştirilmemeli çünkü logic.js içindeki excel import dinleyici global değişkeni üzerinden okuyor
             // Ancak eğer window.excelPreviewData yoksa bunu export objeden bir fonksiyona bağlamalıyız.
             // Biz doğrudan window objesine assign ettik.
             
             const btnImportAll = document.getElementById('btn-import-all-excel');
             if(btnImportAll) {
                 // Butonu yeşil yap
                 btnImportAll.textContent = "✓ Hepsini Sisteme Ekle";
             }
        }
    }

});
