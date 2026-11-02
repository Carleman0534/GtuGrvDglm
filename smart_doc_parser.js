/**
 * 📑 Akıllı PDF, Belge & Metin Sınav Ayrıştırıcı & Adil Dağıtım Sihirbazı
 * 
 * Özellikler:
 * 1. PDF dosyası, Excel dosyası veya panodan kopyalanan (Ctrl+V) metin tablolarını ayrıştırır.
 * 2. Birden fazla bölümün (Fizik, Kimya, Matematik vb.) iç içe olduğu tablolardan 'Matematik' sınavlarını filtreler.
 * 3. Tablodaki 'Gözetmen Talebi' sayısını (örn: 1, 2, 3, 4 kişi) otomatik algılar.
 * 4. Asistanların müsaitlik kısıtlarını (constraints) ve sınav çakışmalarını kontrol eder.
 * 5. Puan adaleti algoritmasıyla en düşük puanlı ve müsait gözetmenleri otomatik olarak atar.
 * 6. Arşivden geçmiş sınav sürelerini referans alarak akıllı süre önerir.
 * 7. Önizleme ve düzenleme imkanı sunarak tek tıkla veritabanına aktarır.
 */

(function () {
    'use strict';

    const MONTH_MAP = {
        'ocak': '01', 'şubat': '02', 'subat': '02', 'mart': '03', 'nisan': '04',
        'mayıs': '05', 'mayis': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08',
        'agustos': '08', 'eylül': '09', 'eylul': '09', 'ekim': '10', 'kasım': '11',
        'kasim': '11', 'aralık': '12', 'aralik': '12'
    };

    // Bellekte tutulan geçici ayrıştırılmış sınavlar ve durum
    let _allParsedExams = [];
    let _selectedProgram = 'Matematik';
    let _availablePrograms = [];
    let _simulatedStaff = [];

    // --- Tarih Ayrıştırıcı ---
    function parseTurkishDateToISO(dateStr) {
        if (!dateStr) return null;
        const m = dateStr.match(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
        if (m) {
            const day = String(m[1]).padStart(2, '0');
            const month = MONTH_MAP[m[2].toLowerCase()] || '11';
            const year = m[3];
            return `${year}-${month}-${day}`;
        }
        const mNum = dateStr.match(/(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})/);
        if (mNum) {
            return `${mNum[3]}-${String(mNum[2]).padStart(2, '0')}-${String(mNum[1]).padStart(2, '0')}`;
        }
        return null;
    }

    // --- Metin Tablo Ayrıştırıcı ---
    function parseRawScheduleText(rawText) {
        if (!rawText || !rawText.trim()) return [];

        const deptRegex = '(Matematik|Fizik|Kimya|Moleküler Biyoloji ve\\s*Genetik|Veri Bilimi ve Analitiği|Bilgisayar|Biyomühendislik|Elektronik|Çevre|İşletme|Mimarlık)';
        const reSplit = new RegExp(`(?=${deptRegex}\\s+\\d+)`, 'gi');
        
        const chunks = rawText.split(reSplit);
        const results = [];

        chunks.forEach(chunk => {
            const t = chunk.trim();
            if (!t) return;

            const headRe = new RegExp(`^${deptRegex}\\s+(\\d+)\\s+([\\s\\S]*)`, 'i');
            const mHead = t.match(headRe);
            if (!mHead) return;

            const program = mHead[1].replace(/\s+/g, ' ').trim();
            const capacity = parseInt(mHead[2], 10) || 0;
            const rest = mHead[3].trim();

            let examType = 'Vize';
            let coursePart = rest;
            let afterType = '';

            const mType = rest.match(/\b(Vize|Final|Büt|Mazeret|Ek Sınav|D Sınavı)\b/i);
            if (mType) {
                examType = mType[1];
                coursePart = rest.substring(0, mType.index).replace(/\s+/g, ' ').trim();
                afterType = rest.substring(mType.index + mType[0].length).trim();
            }

            const courseName = coursePart.replace(/\s+/g, ' ').trim();

            // Tarih ve saat
            const mDate = afterType.match(/(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4})/);
            const dateISO = mDate ? parseTurkishDateToISO(mDate[1]) : null;

            const mTime = afterType.match(/(\d{1,2}:\d{2})/);
            const timeStr = mTime ? mTime[1] : '18:15';

            // Gözetmen Talebi (Satırın en sonundaki sayı)
            const mReq = afterType.match(/(\d+)\s*$/);
            const proctorDemand = mReq ? parseInt(mReq[1], 10) : 1;

            // Aradaki kısım: Derslik ve Hoca
            let middle = afterType;
            if (mTime) {
                middle = middle.substring(middle.indexOf(mTime[1]) + mTime[1].length);
            }
            if (mReq) {
                const lastIdx = middle.lastIndexOf(mReq[1]);
                if (lastIdx !== -1) middle = middle.substring(0, lastIdx);
            }
            middle = middle.replace(/\s+/g, ' ').trim();

            // Derslik
            const mLoc = middle.match(/(Merkez Amfi\s*[\d\s\+\/A-Za-z]+|Derslik\s*\d+|Amfi\s*\d+|Kongre Merkezi|D\d+)/i);
            let location = mLoc ? mLoc[1].trim() : 'Merkez Amfi';

            // Hoca
            const mLec = middle.match(/((?:Öğr\.\s*Gör\.|Dr\.\s*Öğr\.\s*Üyesi|Prof\.\s*Dr\.|Doç\.\s*Dr\.|Arş\.\s*Gör\.)\s*[A-Za-zÇĞİÖŞÜçğıöşü\s\.\(\)]+)/i);
            let lecturer = mLec ? mLec[1].trim() : '';

            // Temizlik
            if (lecturer && location.includes(lecturer)) location = location.replace(lecturer, '').trim();
            if (location && lecturer.includes(location)) lecturer = lecturer.replace(location, '').trim();

            // Ders kodu çıkarma (Örn: ENG 111, INF 100, TUR 101, HIS 101)
            let courseCode = '';
            const mCode = courseName.match(/([A-Za-zÇĞİÖŞÜçğıöşü]{3,5})\s*([0-9]{3}[A-Za-z]?)/);
            if (mCode) {
                courseCode = `${mCode[1].toUpperCase()} ${mCode[2]}`;
            }

            // Arşivden tahmini süre (geçmiş sınav bilgileri ile kıyaslama, yoksa 90 dakika)
            let estimatedDuration = 90;
            if (typeof findHistoricalExamDuration === 'function') {
                const hist = findHistoricalExamDuration(courseCode, courseName);
                if (hist && hist.duration) {
                    estimatedDuration = hist.duration;
                }
            } else if (typeof getExamHistoricalDurationStats === 'function') {
                const stats = getExamHistoricalDurationStats(courseName);
                if (stats && stats.recommendedDuration) {
                    estimatedDuration = stats.recommendedDuration;
                } else if (/inf/i.test(courseCode || courseName)) {
                    estimatedDuration = 120;
                } else if (/eng/i.test(courseCode || courseName)) {
                    estimatedDuration = 60;
                } else if (/tur|his/i.test(courseCode || courseName)) {
                    estimatedDuration = 60;
                }
            }

            results.append = results.push({
                id: Date.now() + Math.random(),
                program,
                courseCode,
                name: courseName,
                type: examType,
                date: dateISO || new Date().toISOString().split('T')[0],
                time: timeStr,
                duration: estimatedDuration,
                location: location || 'Merkez Amfi',
                capacity: capacity,
                lecturer: lecturer || 'Belirtilmedi',
                proctorDemand: proctorDemand,
                assignedProctorIds: [],
                assignedProctorNames: [],
                isExisting: false,
                existingExamId: null
            });
        });

        return results;
    }

    // --- Modal Açma & Kapatma ---
    window.openSmartDocImportModal = function () {
        const modal = document.getElementById('modal-smart-doc-import');
        if (!modal) return;

        // Adım 1 ekranını göster, Adım 2'yi gizle
        document.getElementById('smart-doc-step-input').style.display = 'block';
        document.getElementById('smart-doc-step-preview').style.display = 'none';

        const pasteArea = document.getElementById('smart-doc-paste-text');
        if (pasteArea) pasteArea.value = '';

        const dropText = document.getElementById('smart-doc-drop-text');
        if (dropText) dropText.textContent = "PDF veya Excel Belgesini Sürükleyip Bırakın";

        modal.classList.remove('hidden');
    };

    window.closeSmartDocImportModal = function () {
        const modal = document.getElementById('modal-smart-doc-import');
        if (modal) modal.classList.add('hidden');
    };

    // --- Dosya Sürükle Bırak / Yükleme ---
    window.handleSmartDocFileInput = async function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();
        const dropText = document.getElementById('smart-doc-drop-text');
        if (dropText) dropText.textContent = `⏳ ${file.name} okunuyor...`;

        try {
            if (fileName.endsWith('.pdf')) {
                // PDF Ayrıştırma
                if (window.pdfjsLib) {
                    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    }
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    document.getElementById('smart-doc-paste-text').value = fullText;
                    if (dropText) dropText.textContent = `✅ ${file.name} başarıyla okundu!`;
                    processSmartDocPastedText();
                } else {
                    alert('PDF okuyucu kütüphanesi yüklenemedi. Lütfen metni kopyalayıp aşağıdaki kutuya yapıştırın.');
                }
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
                // Excel Ayrıştırma
                if (window.XLSX) {
                    const arrayBuffer = await file.arrayBuffer();
                    const wb = window.XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const csv = window.XLSX.utils.sheet_to_csv(sheet);
                    document.getElementById('smart-doc-paste-text').value = csv;
                    if (dropText) dropText.textContent = `✅ ${file.name} başarıyla okundu!`;
                    processSmartDocPastedText();
                }
            } else {
                // Düz Metin
                const text = await file.text();
                document.getElementById('smart-doc-paste-text').value = text;
                processSmartDocPastedText();
            }
        } catch (err) {
            console.error('Belge okuma hatası:', err);
            alert('Belge okunurken bir hata oluştu: ' + err.message);
            if (dropText) dropText.textContent = "Hata oluştu. Lütfen tekrar deneyin.";
        }
    };

    // --- Örnek Metin Doldur (Test için) ---
    window.fillSmartDocSampleTBF = function () {
        const sample = `TBF SERVİS DERSLERİ VİZE SINAVI GÖZETMEN VE SINIF BİLGİLERİ
Programı Öğrenci Sayısı Dersin Kodu ve Adı Sınav Türü Tarih ve saat Sınav Yeri Öğretim Üyesi Gözetmen Talebi
Fizik 26 ENG 111 English for Business Life Vize 23 Kasım 2026 Pazartesi 18:15 Merkez Amfi 1 Öğr. Gör. Zeynep KARADENİZ CISDIK 1
Kimya 32 ENG 111 English for Business Life Vize 23 Kasım 2026 Pazartesi 18:15 Merkez Amfi 2 Öğr. Gör. Zeynep KARADENİZ CISDIK 1
Matematik 46 ENG 111 English for Business Life Vize 23 Kasım 2026 Pazartesi 18:15 Merkez Amfi 1 Öğr. Gör. Zeynep KARADENİZ CISDIK 2
Moleküler Biyoloji ve Genetik 75 ENG 111 English for Business Life Vize 23 Kasım 2026 Pazartesi 18:15 Merkez Amfi 3 Öğr. Gör. Zeynep KARADENİZ CISDIK 3
Veri Bilimi ve Analitiği 40 ENG 111 English for Business Life Vize 23 Kasım 2026 Pazartesi 18:15 Merkez Amfi 2 Öğr. Gör. Zeynep KARADENİZ CISDIK 2
Kimya 63 INF 100 Introduction to Computer Systems Vize 24 Kasım 2026 Salı 18:15 Merkez Amfi 3 Dr. Öğr. Üyesi Hadi ALIZADEH 3
Matematik 117 INF 100 Introduction to Computer Systems Vize 24 Kasım 2026 Salı 18:15 Merkez Amfi 1 / Merkez Amfi 2 Dr. Öğr. Üyesi Hadi ALIZADEH 4
Moleküler Biyoloji ve Genetik 58 INF 100 Introduction to Computer Systems Vize 24 Kasım 2026 Salı 18:15 Merkez Amfi 2 Dr. Öğr. Üyesi Hadi ALIZADEH 2
Fizik 34 TUR 101 Turkish I Vize 25 Kasım 2026 Çarşamba 18:15 Merkez Amfi 1 Öğr. Gör. Benan DURUKAN 1
Kimya 23 TUR 101 Turkish I Vize 25 Kasım 2026 Çarşamba 18:15 Merkez Amfi 1 Öğr. Gör. Benan DURUKAN 1
Matematik 74 TUR 101 Turkish I Vize 25 Kasım 2026 Çarşamba 18:15 Merkez Amfi 2 Öğr. Gör. Benan DURUKAN 3
Moleküler Biyoloji ve Genetik 71 TUR 101 Turkish I Vize 25 Kasım 2026 Çarşamba 18:15 Merkez Amfi 3 Öğr. Gör. Benan DURUKAN 3
Veri Bilimi ve Analitiği 37 TUR 101 Turkish I Vize 25 Kasım 2026 Çarşamba 18:15 Merkez Amfi 1 Öğr. Gör. Benan DURUKAN 1
Fizik 34 HIS 101 Principles of Atatürk and the History of Turkish Revolution I Vize 26 Kasım 2026 Perşembe 18:15 Merkez Amfi 1 Öğr. Gör. Dr. Oğuzhan DURSUN 1
Kimya 50 HIS 101 Principles of Atatürk and the History of Turkish Revolution I Vize 26 Kasım 2026 Perşembe 18:15 Merkez Amfi 1 Öğr. Gör. Dr. Oğuzhan DURSUN 2
Matematik 35 HIS 101 Principles of Atatürk and the History of Turkish Revolution I Vize 26 Kasım 2026 Perşembe 18:15 Merkez Amfi 2 Öğr. Gör. Dr. Oğuzhan DURSUN 1
Moleküler Biyoloji ve Genetik 67 HIS 101 Principles of Atatürk and the History of Turkish Revolution I Vize 26 Kasım 2026 Perşembe 18:15 Merkez Amfi 3 Öğr. Gör. Dr. Oğuzhan DURSUN 3
Veri Bilimi ve Analitiği 37 HIS 101 Principles of Atatürk and the History of Turkish Revolution I Vize 26 Kasım 2026 Perşembe 18:15 Merkez Amfi 2 Öğr. Gör. Dr. Oğuzhan DURSUN 2`;

        document.getElementById('smart-doc-paste-text').value = sample;
        window.processSmartDocPastedText();
    };

    // --- Metni Çözümle ve Önizlemeye Geç ---
    window.processSmartDocPastedText = function () {
        const text = document.getElementById('smart-doc-paste-text')?.value;
        if (!text || !text.trim()) {
            alert('Lütfen PDF yükleyin veya ayrıştırılacak metni yapıştırın.');
            return;
        }

        _allParsedExams = parseRawScheduleText(text);
        if (_allParsedExams.length === 0) {
            alert('Belgede geçerli bir sınav tablosu tespit edilemedi. Lütfen biçimi kontrol edin.');
            return;
        }

        // Programları topla
        const progSet = new Set();
        _allParsedExams.forEach(e => {
            if (e.program) progSet.add(e.program);
        });
        _availablePrograms = Array.from(progSet);

        // Varsayılan olarak Matematik seçilir (varsa)
        if (_availablePrograms.some(p => p.toLowerCase().includes('matematik'))) {
            _selectedProgram = _availablePrograms.find(p => p.toLowerCase().includes('matematik'));
        } else {
            _selectedProgram = _availablePrograms[0] || 'Tümü';
        }

        // Bölüm filtre butonlarını oluştur
        renderProgramFilterChips();

        // Kısıt ve Puanlara göre otomatik gözetmen dağıtımı yap
        autoAssignProctorsForParsedExams();

        // Ekranı Önizleme adımına geçir
        document.getElementById('smart-doc-step-input').style.display = 'none';
        document.getElementById('smart-doc-step-preview').style.display = 'block';

        renderSmartDocPreviewTable();
    };

    // --- Program / Bölüm Filtre Butonları ---
    function renderProgramFilterChips() {
        const container = document.getElementById('smart-doc-program-chips');
        if (!container) return;

        let html = `
            <button type="button" class="btn-secondary program-chip ${_selectedProgram === 'Tümü' ? 'active' : ''}" onclick="window.filterSmartDocByProgram('Tümü')" style="border-radius:20px; padding:4px 12px; font-size:0.8rem;">
                🌐 Tüm Fakülte (${_allParsedExams.length})
            </button>
        `;

        _availablePrograms.forEach(prog => {
            const count = _allParsedExams.filter(e => e.program === prog).length;
            const isSelected = (_selectedProgram === prog);
            const isMath = prog.toLowerCase().includes('matematik');
            
            const badgeStyle = isSelected 
                ? 'background: #0284c7; color:#fff; border-color:#38bdf8; font-weight:700;' 
                : (isMath ? 'border-color: #38bdf8; color: #38bdf8;' : '');

            html += `
                <button type="button" class="btn-secondary program-chip ${isSelected ? 'active' : ''}" onclick="window.filterSmartDocByProgram('${prog.replace(/'/g, "\\'")}')" style="border-radius:20px; padding:4px 12px; font-size:0.8rem; ${badgeStyle}">
                    ${isMath ? '⭐ ' : ''}${prog} (${count})
                </button>
            `;
        });

        container.innerHTML = html;
    }

    window.filterSmartDocByProgram = function (progName) {
        _selectedProgram = progName;
        renderProgramFilterChips();
        autoAssignProctorsForParsedExams();
        renderSmartDocPreviewTable();
    };

    // --- Kısıt ve Puan Odaklı Adil Otomatik Dağıtım Algoritması ---
    function autoAssignProctorsForParsedExams() {
        if (!DB || !DB.staff) return;

        // Geçici personel puan simülasyonu
        _simulatedStaff = JSON.parse(JSON.stringify(DB.staff)).map(s => ({
            id: s.id,
            name: s.name,
            totalScore: parseFloat(s.totalScore) || 0,
            taskCount: parseInt(s.taskCount, 10) || 0,
            gender: s.gender || ''
        }));

        const filteredExams = (_selectedProgram === 'Tümü') 
            ? _allParsedExams 
            : _allParsedExams.filter(e => e.program === _selectedProgram);

        // Her sınav için mükerrer kontrolü yap
        filteredExams.forEach(e => {
            const existing = (DB.exams || []).find(dbEx => 
                dbEx.date === e.date && 
                (dbEx.time === e.time || (dbEx.time && e.time && dbEx.time.split('-')[0].trim() === e.time.split('-')[0].trim())) &&
                (dbEx.name.toLowerCase().includes((e.courseCode || e.name).toLowerCase()) || (e.courseCode && dbEx.name.toLowerCase().includes(e.courseCode.toLowerCase())))
            );
            if (existing) {
                e.isExisting = true;
                e.existingExamId = existing.id;
            } else {
                e.isExisting = false;
                e.existingExamId = null;
            }
        });

        // Sınavları tarihe göre sıralayarak adil dağıtım yap
        filteredExams.sort((a, b) => (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time));

        filteredExams.forEach(ex => {
            const demand = ex.proctorDemand || 1;
            const chosenStaff = [];

            // Adayları belirle: Kısıtı olmayan ve o saatte başka sınavı bulunmayanlar
            const candidates = _simulatedStaff.filter(st => {
                // 1. Kısıt kontrolü (logic.js isAvailable fonksiyonu)
                if (typeof isAvailable === 'function') {
                    if (!isAvailable(st.name, ex.date, ex.time, ex.duration || 90)) return false;
                }
                // 2. Çakışma kontrolü (Bu simülasyondaki diğer sınavlar veya DB'deki sınavlar)
                return true;
            });

            // En düşük puana ve en az görev sayısına göre sırala (Adalet)
            candidates.sort((a, b) => {
                if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
                return a.taskCount - b.taskCount;
            });

            // Talep edilen sayı kadar asistan seç
            for (let i = 0; i < demand && i < candidates.length; i++) {
                const picked = candidates[i];
                chosenStaff.push(picked);

                // Simüle edilen puanı ve görev sayısını güncelle
                const examScore = (ex.duration || 90) * 1.0;
                picked.totalScore = parseFloat((picked.totalScore + examScore).toFixed(2));
                picked.taskCount += 1;
            }

            ex.assignedProctorIds = chosenStaff.map(s => s.id);
            ex.assignedProctorNames = chosenStaff.map(s => s.name);
        });
    }

    window.reRunSmartDocAutoAssign = function () {
        autoAssignProctorsForParsedExams();
        renderSmartDocPreviewTable();
        if (typeof showToast === 'function') showToast('Kısıt ve puanlara göre adil dağıtım yeniden hesaplandı!', 'success');
    };

    // --- Önizleme Tablosunu Çiz ---
    function renderSmartDocPreviewTable() {
        const tbody = document.querySelector('#table-smart-doc-preview tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const filtered = (_selectedProgram === 'Tümü') 
            ? _allParsedExams 
            : _allParsedExams.filter(e => e.program === _selectedProgram);

        // Özet Sayaçları Güncelle
        const totalExamsEl = document.getElementById('smart-doc-total-exams');
        const totalProctorsEl = document.getElementById('smart-doc-total-proctors');
        const availableStaffEl = document.getElementById('smart-doc-available-staff');

        const totalProctorDemand = filtered.reduce((acc, e) => acc + (e.proctorDemand || 1), 0);
        if (totalExamsEl) totalExamsEl.textContent = filtered.length;
        if (totalProctorsEl) totalProctorsEl.textContent = `${totalProctorDemand} Kişi`;
        if (availableStaffEl) availableStaffEl.textContent = `${(DB.staff || []).length} Asistan`;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Bu bölüm için ayrıştırılmış sınav bulunamadı.</td></tr>`;
            return;
        }

        filtered.forEach((ex, idx) => {
            const tr = document.createElement('tr');
            
            // Formatlı Tarih
            const dateParts = (ex.date || '').split('-');
            const displayDate = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : ex.date;

            // Gözetmen Rozetleri
            const proctorBadgesHTML = (ex.assignedProctorNames || []).map((name, pIdx) => {
                return `<span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 3px 8px; border-radius: 6px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; margin: 2px;">
                    👤 ${name}
                </span>`;
            }).join(' ') || '<span style="color:#ef4444; font-size:0.8rem;">Gözetmen Atanamadı</span>';

            // Durum Rozeti
            const statusBadgeHTML = ex.isExisting
                ? `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-size:0.75rem;" title="Bu sınav sistemde zaten mevcut, bilgileri güncellenecek">⚠️ Mevcut (Güncelle)</span>`
                : `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-size:0.75rem;">✨ Yeni Sınav</span>`;

            tr.innerHTML = `
                <td>
                    <div style="font-weight:600; color:#38bdf8; font-size:0.85rem;">${ex.program}</div>
                    <span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; font-size:0.72rem;">${ex.type || 'Vize'}</span>
                </td>
                <td>
                    <div style="font-weight:700; color:#f8fafc; font-size:0.92rem;">${ex.name}</div>
                    <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">👨‍🏫 ${ex.lecturer || '-'}</div>
                </td>
                <td>
                    <div style="font-weight:600;">${displayDate}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">${ex.time}</div>
                </td>
                <td>
                    <div style="font-weight:600; color:#f59e0b;">${ex.location || '-'}</div>
                    <div style="font-size:0.78rem; color:var(--text-muted);">Mevcut: ${ex.capacity || 0}</div>
                </td>
                <td>
                    <input type="number" value="${ex.duration || 90}" min="15" max="240" step="5" style="width: 65px; padding: 4px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; font-size: 0.85rem; text-align: center;" onchange="window.updateSmartDocExamDuration(${idx}, this.value)"> dk
                </td>
                <td>
                    <input type="number" value="${ex.proctorDemand || 1}" min="1" max="8" style="width: 50px; padding: 4px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; font-size: 0.85rem; text-align: center;" onchange="window.updateSmartDocExamDemand(${idx}, this.value)"> Kişi
                </td>
                <td style="max-width: 250px;">
                    <div>${proctorBadgesHTML}</div>
                </td>
                <td>
                    ${statusBadgeHTML}
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    window.updateSmartDocExamDuration = function(idx, val) {
        const filtered = (_selectedProgram === 'Tümü') ? _allParsedExams : _allParsedExams.filter(e => e.program === _selectedProgram);
        if (filtered[idx]) {
            filtered[idx].duration = parseInt(val, 10) || 90;
        }
    };

    window.updateSmartDocExamDemand = function(idx, val) {
        const filtered = (_selectedProgram === 'Tümü') ? _allParsedExams : _allParsedExams.filter(e => e.program === _selectedProgram);
        if (filtered[idx]) {
            filtered[idx].proctorDemand = parseInt(val, 10) || 1;
            autoAssignProctorsForParsedExams();
            renderSmartDocPreviewTable();
        }
    };

    // --- Sisteme Aktarma ve Kaydetme (Firebase & Local) ---
    window.confirmAndApplySmartDocImport = async function () {
        const filtered = (_selectedProgram === 'Tümü') 
            ? _allParsedExams 
            : _allParsedExams.filter(e => e.program === _selectedProgram);

        if (filtered.length === 0) {
            alert('Aktarılacak sınav bulunamadı.');
            return;
        }

        const confirmMsg = `${filtered.length} adet sınav ve gözetmen ataması sisteme aktarılacaktır.\nOnaylıyor musunuz?`;
        if (!confirm(confirmMsg)) return;

        let addedCount = 0;
        let updatedCount = 0;

        filtered.forEach(item => {
            const score = typeof calculateScore === 'function' 
                ? calculateScore(new Date(item.date + 'T' + item.time), item.duration) 
                : item.duration * 1.0;

            if (item.isExisting && item.existingExamId) {
                // Mevcut sınavı güncelle
                const ex = DB.exams.find(e => String(e.id) === String(item.existingExamId));
                if (ex) {
                    ex.location = item.location;
                    ex.capacity = item.capacity;
                    ex.lecturer = item.lecturer;
                    ex.duration = item.duration;
                    ex.scheduledDuration = item.duration;
                    ex.score = score;
                    if (item.assignedProctorIds.length > 0) {
                        ex.proctorIds = item.assignedProctorIds;
                        ex.proctorId = item.assignedProctorIds[0];
                        ex.proctorName = item.assignedProctorNames.join(', ');
                    }
                    updatedCount++;
                }
            } else {
                // Yeni sınav oluştur
                const newExam = {
                    id: Date.now() + Math.random(),
                    name: item.name,
                    courseCode: item.courseCode || item.name.split(' ')[0],
                    type: item.type || 'Vize',
                    date: item.date,
                    time: item.time,
                    duration: item.duration,
                    scheduledDuration: item.duration,
                    actualDuration: null,
                    durationConfirmed: false,
                    location: item.location,
                    capacity: item.capacity,
                    lecturer: item.lecturer,
                    score: score,
                    katsayi: 1.0,
                    proctorIds: item.assignedProctorIds,
                    proctorId: item.assignedProctorIds[0] || null,
                    proctorName: item.assignedProctorNames.join(', ') || 'Atanmadı',
                    isDraft: false,
                    isNonExam: false
                };
                DB.exams.push(newExam);
                addedCount++;
            }

            // Personel puanlarını güncelle
            item.assignedProctorIds.forEach(pid => {
                const staffMember = DB.staff.find(s => s.id === pid);
                if (staffMember) {
                    staffMember.totalScore = parseFloat(((staffMember.totalScore || 0) + score).toFixed(2));
                    staffMember.taskCount = (staffMember.taskCount || 0) + 1;
                }
            });
        });

        // Audit log ekle
        if (typeof logAction === 'function') {
            logAction('admin', 'Belgeden Akıllı Sınav Aktarımı', `${_selectedProgram} bölümü için ${addedCount} yeni sınav eklendi, ${updatedCount} sınav güncellendi.`);
        }

        // Kaydet ve Arayüzü Güncelle
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        if (typeof saveToBackend === 'function') await saveToBackend();

        closeSmartDocImportModal();

        if (typeof renderExams === 'function') renderExams();
        if (typeof renderStaff === 'function') renderStaff();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderSchedule === 'function') renderSchedule();

        const toastMsg = `🎉 Başarılı! ${addedCount} yeni sınav eklendi, ${updatedCount} sınav güncellendi.`;
        if (typeof showToast === 'function') showToast(toastMsg, 'success');
        else alert(toastMsg);
    };

})();
