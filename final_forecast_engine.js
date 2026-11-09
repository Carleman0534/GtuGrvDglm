/**
 * GTÜ Matematik Bölümü Gözetmenlik Takip ve Atama Sistemi
 * FİNAL DÖNEMİ SONUNA KADAR TAHMİNİ GÖREV VE SÜRE HESAPLAMA MOTORU
 * 
 * Temel İlkeler ve Kurallar:
 * 1. YALNIZCA SINAV GÖZETMENLİKLERİ:
 *    - Final dönemi sonuna kadar yapılan tüm tahmini görev ve süre hesaplamalarında yalnızca sınav gözetmenlikleri dikkate alınır.
 *    - Sınav dışı görevler (tanıtım, festival, etkinlik vb.) ve bu görevlerin puanları sınav gözetmenliği tahmin havuzuna kesinlikle katılmaz.
 * 2. KÜMÜLATİF DÖNEMLİK ADALET:
 *    - Bir gözetmenin geçmişte yaptığı sınavlar (tamamlanan sınav adedi ve dakikası) hesaba katılır.
 *    - Kalan mazeret sınavları dağıtılırken sadece kalan sınavlara değil, gözetmenin tüm dönem boyunca aldığı toplam sınav yüküne göre dengeleme yapılır.
 *    - Böylece dönem başında çok görev almış gözetmenlere haksız yere mazeret yüklenmesi engellenir.
 * 3. PUAN VE KATEGORİ AYRIMI:
 *    - Sınav Gözetmenliği Puanı (Taban + Sınavlar) ayrı gösterilir ve projeksiyonlarda kullanılır.
 *    - Sınav Dışı Görev Puanı sistemdeki genel puanda korunur ancak sınav gözetmenlik dağıtımını bozmaz.
 *    - Genel Görev Puanı: Sınav Gözetmenlikleri + Sınav Dışı Görevler toplamıdır.
 */

(function(window) {
    'use strict';

    const FinalForecastEngine = {
        HISTORICAL_PARAMS: {
            DEFAULT_MAZERET_FINAL_RATIO: 0.458, // Bahar 2026 ampirik verisi: 11 mazeret / 24 final
            DEFAULT_MAZERET_VIZE_RATIO: 0.211,  // Bahar 2026 verisi: 11 mazeret / 52 vize
            DEFAULT_MAZERET_DURATION: 110,      // Ortalama mazeret süresi: 110 dakika
            PROCTORS_PER_MAZERET: 1.0           // Mazeret sınavı başına ortalama gözetmen ihtiyacı
        },

        currentSortCol: 'totalEstimatedDuration',
        currentSortDir: 'desc',
        currentSearchFilter: '',

        /**
         * Sınav dışı görev kontrolü (Festival, tanıtım, mezuniyet, etkinlik vb.)
         * Bu görevler sınav gözetmenliği projeksiyonlarından tamamen ayrıştırılır.
         */
        isNonExamTask: function(exam) {
            if (!exam) return false;
            if (typeof shouldCountAsNonExam === 'function') {
                return shouldCountAsNonExam(exam);
            }
            return !!exam.isNonExam;
        },

        /**
         * Tarihten akademik dönemi tespit eder
         */
        getAcademicTerm: function(dateStr) {
            if (!dateStr) return { key: 'unknown', name: 'Bilinmeyen Dönem', season: 'Bilinmiyor', year: 2026 };
            const parts = String(dateStr).split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);

            if (month >= 3 && month <= 7) {
                return { key: `${year - 1}-${year}-bahar`, name: `${year - 1}-${year} Bahar`, season: 'Bahar', year };
            } else if (month >= 8 && month <= 9) {
                return { key: `${year - 1}-${year}-yaz`, name: `${year - 1}-${year} Yaz (Yaz Okulu)`, season: 'Yaz', year };
            } else {
                const termStartYear = month >= 10 ? year : year - 1;
                return { key: `${termStartYear}-${termStartYear + 1}-guz`, name: `${termStartYear}-${termStartYear + 1} Güz`, season: 'Güz', year: termStartYear };
            }
        },

        /** Yerel saate göre YYYY-AA-GG (toISOString UTC kullandığı için 00:00-03:00 arası bir önceki güne düşüyordu) */
        localDateStr: function(d) {
            const dt = d || new Date();
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        },

        /**
         * Sınav türünü TEK bir kategoriye ayırır (öncelik: mazeret > final > vize).
         * "Final Mazeret" gibi adlar hem final hem mazeret sayılmaz.
         */
        classifyExam: function(ex) {
            const s = (String(ex.type || '') + ' ' + String(ex.name || '')).toLocaleLowerCase('tr-TR');
            if (s.includes('mazeret')) return 'mazeret';
            if (s.includes('final')) return 'final';
            if (s.includes('vize') || s.includes('ara sınav') || s.includes('midterm')) return 'vize';
            // Final sonrası değerlendirme sınavları (D sınavı, bütünleme vb.)
            if (/(^|\s)d\s*sınav/.test(s) || s.includes('bütünleme') || s.includes('butunleme')) return 'dsinav';
            return 'other';
        },

        /** Sınavın gözetmen kimlikleri (proctorIds + proctorId, tekrarsız) */
        proctorIdsOf: function(ex) {
            const ids = [];
            if (Array.isArray(ex.proctorIds)) ex.proctorIds.forEach(p => ids.push(String(p)));
            if (ex.proctorId !== undefined && ex.proctorId !== null && ex.proctorId !== '') ids.push(String(ex.proctorId));
            return [...new Set(ids)];
        },

        /**
         * Ders anahtarı (ör. "MATH 211 - Analysis III" → "MATH 211").
         * Aynı dersin birden fazla salon/oturum satırı tek ders sayılır.
         */
        courseKey: function(ex) {
            const n = String(ex.name || '').toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
            const m = n.match(/([A-ZÇĞİÖŞÜ]{2,5})\s?(\d{3})/);
            return m ? `${m[1]} ${m[2]}` : n.trim();
        },

        /**
         * 1. GEÇMİŞ DÖNEM VERİLERİNİN ANALİZ EDİLMESİ
         * Geçmiş dönemlerin sınav ve mazeret sayılarını inceler.
         * Sınav dışı görevler analize katılmaz.
         */
        analyzeHistoricalTerms: function(examsList, currentTermKey) {
            const rawExams = examsList || (typeof DB !== 'undefined' ? DB.exams : []) || [];
            // SADECE GERÇEK SINAVLARI DİKKATE AL (Sınav dışı görevleri tamamen filtrele)
            const exams = rawExams.filter(e => !this.isNonExamTask(e));
            const termsMap = {};

            exams.forEach(ex => {
                if (!ex.date) return;
                const term = this.getAcademicTerm(ex.date);
                if (!termsMap[term.key]) {
                    termsMap[term.key] = {
                        name: term.name,
                        season: term.season,
                        totalExams: 0,
                        vizeCount: 0,
                        finalCount: 0,
                        mazeretCount: 0,
                        mazeretTotalDuration: 0,
                        mazeretTotalScore: 0,
                        mazeretExams: [],
                        finalExams: [],
                        finalCourses: new Set(),
                        vizeCourses: new Set(),
                        // Gözetmen ataması (slot) bazlı istatistikler
                        mazeretSlots: 0,
                        finalSlotsByCourse: {},
                        vizeSessionSlots: {},   // ders → { "tarih|saat": gözetmen sayısı }
                        finalSlots: 0, finalDurSlot: 0, finalScoreSlot: 0,
                        dCount: 0, dSlots: 0, dDurSlot: 0, dScoreSlot: 0
                    };
                }

                const tData = termsMap[term.key];
                tData.totalExams++;
                const dur = parseInt(ex.duration, 10) || 60;
                const score = parseFloat(ex.score) || 0;
                const cls = this.classifyExam(ex);
                const slots = Math.max(1, this.proctorIdsOf(ex).length);
                const course = this.courseKey(ex);

                // Mazeret: her satır (oturum) ayrı gözetmen ihtiyacıdır → satır sayılır.
                // Final / vize: ders bazında sayılır (çok salonlu sınav ve 2. vize oranı şişirmesin).
                if (cls === 'mazeret') {
                    tData.mazeretCount++;
                    tData.mazeretSlots += slots;
                    tData.mazeretTotalDuration += dur;
                    tData.mazeretTotalScore += score;
                    tData.mazeretExams.push(ex);
                } else if (cls === 'final') {
                    tData.finalCourses.add(course);
                    tData.finalExams.push(ex);
                    tData.finalSlotsByCourse[course] = (tData.finalSlotsByCourse[course] || 0) + slots;
                    tData.finalSlots += slots;
                    tData.finalDurSlot += dur * slots;
                    tData.finalScoreSlot += score * slots;
                } else if (cls === 'vize') {
                    tData.vizeCourses.add(course);
                    const sk = `${ex.date}|${ex.time || ''}`;
                    if (!tData.vizeSessionSlots[course]) tData.vizeSessionSlots[course] = {};
                    tData.vizeSessionSlots[course][sk] = (tData.vizeSessionSlots[course][sk] || 0) + slots;
                } else if (cls === 'dsinav') {
                    tData.dCount++;
                    tData.dSlots += slots;
                    tData.dDurSlot += dur * slots;
                    tData.dScoreSlot += score * slots;
                }
            });

            Object.keys(termsMap).forEach(key => {
                const t = termsMap[key];
                t.finalCount = t.finalCourses.size;
                t.vizeCount = t.vizeCourses.size;
            });

            // Tamamlanmış dönemlerin oran ve ortalama hesapları.
            // - Mevcut (devam eden) dönem "geçmiş" sayılmaz.
            // - Yaz okulu, final/mazeret yapısı farklı olduğundan oran hesabına katılmaz
            //   (ör. 7 final / 8 mazeret oranı şişiriyordu); yalnızca normal dönem yoksa yedek olarak kullanılır.
            const pastTerms = [];
            Object.keys(termsMap).forEach(key => {
                const t = termsMap[key];
                t.key = key;
                t.avgMazeretDuration = t.mazeretCount > 0 ? parseFloat((t.mazeretTotalDuration / t.mazeretCount).toFixed(1)) : this.HISTORICAL_PARAMS.DEFAULT_MAZERET_DURATION;
                t.mazeretToFinalRatio = t.finalCount > 0 ? parseFloat((t.mazeretCount / t.finalCount).toFixed(3)) : null;
                t.mazeretToVizeRatio = t.vizeCount > 0 ? parseFloat((t.mazeretCount / t.vizeCount).toFixed(3)) : null;
                if (key === currentTermKey) return;
                if (t.finalCount > 0 || t.mazeretCount > 0) pastTerms.push(t);
            });

            const regularTerms = pastTerms.filter(t => t.season !== 'Yaz' && t.finalCount > 0);
            const ratioTerms = regularTerms.length > 0 ? regularTerms : pastTerms.filter(t => t.finalCount > 0);
            const sumOf = (arr, f) => arr.reduce((s, t) => s + t[f], 0);

            const totalHistFinals = sumOf(ratioTerms, 'finalCount');
            const totalHistMazerets = sumOf(ratioTerms, 'mazeretCount');
            const totalHistMazeretDuration = sumOf(ratioTerms, 'mazeretTotalDuration');
            const totalHistMazeretScore = sumOf(ratioTerms, 'mazeretTotalScore');

            const overallRatio = totalHistFinals > 0 ? parseFloat((totalHistMazerets / totalHistFinals).toFixed(3)) : this.HISTORICAL_PARAMS.DEFAULT_MAZERET_FINAL_RATIO;
            const overallAvgDuration = totalHistMazerets > 0 ? parseFloat((totalHistMazeretDuration / totalHistMazerets).toFixed(1)) : this.HISTORICAL_PARAMS.DEFAULT_MAZERET_DURATION;
            // Mazeret başına ortalama puan (puan yoksa süre ile yaklaşık değer)
            const overallAvgScore = (totalHistMazerets > 0 && totalHistMazeretScore > 0)
                ? parseFloat((totalHistMazeretScore / totalHistMazerets).toFixed(2))
                : overallAvgDuration;

            // Vize yapılan ders başına final yapılan ders oranı (finaller henüz girilmemişken
            // final sayısını vize derslerinden tahmin etmek için). Ör. Bahar: 24 final / 27 vize dersi.
            const fvTerms = ratioTerms.filter(t => t.finalCount > 0 && t.vizeCount > 0);
            const fvVize = sumOf(fvTerms, 'vizeCount');
            const finalPerVizeCourse = fvVize > 0
                ? Math.min(1.5, parseFloat((sumOf(fvTerms, 'finalCount') / fvVize).toFixed(3)))
                : 1.0;

            // Final gözetmen ihtiyacı ≈ aynı dersin vize oturumundaki gözetmen sayısı × katsayı
            // (Bahar: vizede 43, finalde 39 gözetmen → ≈ 0.91)
            let fSlotSum = 0, vMaxSum = 0;
            ratioTerms.forEach(t => {
                Object.keys(t.finalSlotsByCourse).forEach(c => {
                    const sess = t.vizeSessionSlots[c];
                    if (!sess) return;
                    fSlotSum += t.finalSlotsByCourse[c];
                    vMaxSum += Math.max(...Object.values(sess));
                });
            });
            const finalSlotFactor = vMaxSum > 0 ? Math.min(1.5, Math.max(0.5, parseFloat((fSlotSum / vMaxSum).toFixed(3)))) : 1.0;

            const histFinalSlots = sumOf(ratioTerms, 'finalSlots');
            const finalAvgDuration = histFinalSlots > 0 ? parseFloat((sumOf(ratioTerms, 'finalDurSlot') / histFinalSlots).toFixed(1)) : 110;
            // Puan/dakika oranı (katsayılı puanı süreden yaklaşık hesaplamak için)
            const finalScorePerMin = sumOf(ratioTerms, 'finalDurSlot') > 0 && sumOf(ratioTerms, 'finalScoreSlot') > 0
                ? parseFloat((sumOf(ratioTerms, 'finalScoreSlot') / sumOf(ratioTerms, 'finalDurSlot')).toFixed(3))
                : 1.0;

            const totalMazeretSlots = sumOf(ratioTerms, 'mazeretSlots');
            const mazeretSlotsPerExam = totalHistMazerets > 0 ? parseFloat((totalMazeretSlots / totalHistMazerets).toFixed(2)) : this.HISTORICAL_PARAMS.PROCTORS_PER_MAZERET;

            // Final sonrası D sınavı / bütünleme: final yapılan ders başına oran
            const histD = sumOf(ratioTerms, 'dCount');
            const histDSlots = sumOf(ratioTerms, 'dSlots');
            const dPerFinal = totalHistFinals > 0 ? parseFloat((histD / totalHistFinals).toFixed(3)) : 0;
            const dSlotsPerExam = histD > 0 ? parseFloat((histDSlots / histD).toFixed(2)) : 1;
            const dAvgDuration = histDSlots > 0 ? parseFloat((sumOf(ratioTerms, 'dDurSlot') / histDSlots).toFixed(1)) : 110;
            const dAvgScore = histDSlots > 0 && sumOf(ratioTerms, 'dScoreSlot') > 0
                ? parseFloat((sumOf(ratioTerms, 'dScoreSlot') / histDSlots).toFixed(2))
                : dAvgDuration;

            // Veri yeterliliği notu (gerçek hesaplanan değerlerden üretilir)
            let sufficiencyNote = "";
            const isSufficient = ratioTerms.length >= 2;
            const termDetail = ratioTerms.map(t => `${t.name}: ${t.finalCount} final / ${t.mazeretCount} mazeret`).join('; ');
            const excludedYaz = pastTerms.filter(t => t.season === 'Yaz' && !ratioTerms.includes(t)).map(t => t.name);
            const yazNote = excludedYaz.length ? ` Yaz okulu dönemleri (${excludedYaz.join(', ')}) farklı sınav yapısı nedeniyle orana dahil edilmemiştir.` : '';

            if (ratioTerms.length > 0) {
                sufficiencyNote = `${ratioTerms.length} tamamlanmış dönem analiz edildi (${termDetail}). Kullanılan mazeret oranı: %${(overallRatio * 100).toFixed(1)}, ortalama mazeret süresi ${overallAvgDuration} dk.${yazNote}${isSufficient ? '' : ' Veri hacmi sınırlı olduğundan değerler tahmini niteliktedir.'}`;
            } else {
                sufficiencyNote = `Sistemde tamamlanmış geçmiş dönem final/mazeret kaydı bulunmamaktadır. Kurumsal varsayılan oran (%${(this.HISTORICAL_PARAMS.DEFAULT_MAZERET_FINAL_RATIO * 100).toFixed(1)} mazeret oranı, ${this.HISTORICAL_PARAMS.DEFAULT_MAZERET_DURATION} dk süre) kullanılmaktadır.`;
            }

            return {
                termsMap,
                pastTerms,
                overallRatio,
                overallAvgDuration,
                overallAvgScore,
                finalPerVizeCourse,
                finalSlotFactor,
                finalAvgDuration,
                finalScorePerMin,
                mazeretSlotsPerExam,
                dPerFinal,
                dSlotsPerExam,
                dAvgDuration,
                dAvgScore,
                dataSufficiency: {
                    isSufficient,
                    sufficiencyNote,
                    pastTermsCount: ratioTerms.length,
                    totalHistFinals,
                    totalHistMazerets
                }
            };
        },

        /**
         * 2. GÖZETMEN BAZINDA KALAN GÖREV VE SÜRE HESAPLAMASI
         * Yalnızca sınav gözetmenliklerini ve sınav sürelerini esas alır.
         * Sınav dışı görevler ve puanları sınav tahminlerini etkilemez.
         */
        calculateForecastData: function() {
            const db = typeof DB !== 'undefined' ? DB : (window.DB || {});
            const staffList = (db.staff || []);
            const examsList = (db.exams || []);

            // Sınav gözetmenlikleri ile sınav dışı görevleri havuz bazında ayır
            const examDutiesOnly = examsList.filter(e => !this.isNonExamTask(e));
            const nonExamDutiesOnly = examsList.filter(e => this.isNonExamTask(e));

            // Aktif asistan gözetmen havuzu
            const activePool = typeof getActiveProctorStaff === 'function' ? getActiveProctorStaff(staffList) : staffList;

            // Tarih ve dönem tespiti
            const now = new Date();
            const currentTerm = this.getAcademicTerm(this.localDateStr(now));
            const history = this.analyzeHistoricalTerms(examDutiesOnly, currentTerm.key);

            // Mevcut dönemdeki sınav gözetmenlikleri
            const currentTermExams = examDutiesOnly.filter(e => {
                if (!e.date) return false;
                const t = this.getAcademicTerm(e.date);
                return t.key === currentTerm.key;
            });

            // Bugünden itibaren kalan (gelecek) mevcut sınavlar
            const remainingExams = currentTermExams.filter(e => {
                if (!e.date) return false;
                const examDateTime = typeof getSafeDate === 'function' 
                    ? getSafeDate(e.date, e.time) 
                    : new Date(e.date + 'T' + (e.time || '00:00'));
                return examDateTime >= now;
            });

            // Mevcut dönemdeki finaller, vizeler (ders bazında) ve girilmiş mazeretler (oturum bazında)
            const currentFinalCourses = new Set(currentTermExams.filter(e => this.classifyExam(e) === 'final').map(e => this.courseKey(e)));
            const currentVizeCourses = new Set(currentTermExams.filter(e => this.classifyExam(e) === 'vize').map(e => this.courseKey(e)));
            const enteredMazeretExams = currentTermExams.filter(e => this.classifyExam(e) === 'mazeret');
            const enteredDExams = currentTermExams.filter(e => this.classifyExam(e) === 'dsinav');

            // Projeksiyon: dönem sonunda beklenen final sayısı.
            // Finaller kademeli girildiği için girilen final sayısı tek başına kullanılmaz
            // (ilk final girildiğinde tahmin 0'a çöküyordu); vize derslerinden beklenen
            // final sayısı ile girilenlerden büyük olanı alınır.
            const finalsFromVize = Math.round(currentVizeCourses.size * (history.finalPerVizeCourse || 1));
            let projectedTotalFinals = Math.max(currentFinalCourses.size, finalsFromVize);
            if (projectedTotalFinals === 0) projectedTotalFinals = 24; // hiç veri yoksa kurumsal varsayılan

            const projectedMazeretCount = Math.max(
                enteredMazeretExams.length,
                Math.round(projectedTotalFinals * history.overallRatio)
            );

            // Henüz sisteme girilmemiş (kalan) tahmini mazeret sınavı havuzu
            const remainingMazeretToDistribute = Math.max(0, projectedMazeretCount - enteredMazeretExams.length);
            const mazeretAvgDuration = history.overallAvgDuration || this.HISTORICAL_PARAMS.DEFAULT_MAZERET_DURATION;
            const mazeretAvgScore = history.overallAvgScore || mazeretAvgDuration;
            const remainingMazeretSlots = Math.round(remainingMazeretToDistribute * (history.mazeretSlotsPerExam || 1));

            // --- HENÜZ AÇIKLANMAMIŞ FİNALLER (gözetmen ataması bazında) ---
            // Finali henüz girilmemiş her vize dersi için: final gözetmen ihtiyacı ≈
            // dersin en kalabalık vize oturumundaki gözetmen sayısı × geçmiş katsayı.
            const remainingFinalCourses = Math.max(0, projectedTotalFinals - currentFinalCourses.size);
            const pendingCourses = [...currentVizeCourses].filter(c => !currentFinalCourses.has(c));
            let remainingFinalSlots = 0;
            let finalSlotDuration = history.finalAvgDuration || 110;
            if (remainingFinalCourses > 0 && pendingCourses.length > 0) {
                const info = pendingCourses.map(c => {
                    const rows = currentTermExams.filter(e => this.classifyExam(e) === 'vize' && this.courseKey(e) === c);
                    const sess = {};
                    rows.forEach(e => {
                        const k = `${e.date}|${e.time || ''}`;
                        sess[k] = (sess[k] || 0) + Math.max(1, this.proctorIdsOf(e).length);
                    });
                    const maxSlots = Math.max(1, ...Object.values(sess));
                    const dur = rows.reduce((s, e) => s + (parseInt(e.duration, 10) || 60), 0) / (rows.length || 1);
                    return { maxSlots, dur };
                });
                // Her bekleyen dersin finalinin yapılma olasılığı (ör. 23 final / 26 ders)
                const share = Math.min(1, remainingFinalCourses / pendingCourses.length);
                const factor = history.finalSlotFactor || 1;
                const slotSum = info.reduce((s, x) => s + x.maxSlots * factor, 0);
                remainingFinalSlots = Math.round(share * slotSum);
                const w = info.reduce((s, x) => s + x.maxSlots, 0);
                if (w > 0) finalSlotDuration = info.reduce((s, x) => s + x.maxSlots * x.dur, 0) / w;
            } else if (remainingFinalCourses > 0) {
                // Vize verisi yoksa: ders başına geçmiş final gözetmen sayısı
                const hs = (history.pastTerms || []).reduce((a, t) => a + (t.finalSlots || 0), 0);
                const hc = (history.pastTerms || []).reduce((a, t) => a + (t.finalCount || 0), 0);
                remainingFinalSlots = Math.round(remainingFinalCourses * (hc > 0 ? hs / hc : 1.5));
            }
            finalSlotDuration = parseFloat(finalSlotDuration.toFixed(1));
            const finalSlotScore = parseFloat((finalSlotDuration * (history.finalScorePerMin || 1)).toFixed(2));

            // --- FİNAL SONRASI D SINAVI / BÜTÜNLEME (diğer muhtemel gözetmenlikler) ---
            const projectedDCount = Math.max(enteredDExams.length, Math.round(projectedTotalFinals * (history.dPerFinal || 0)));
            const remainingDToDistribute = Math.max(0, projectedDCount - enteredDExams.length);
            const remainingDSlots = Math.round(remainingDToDistribute * (history.dSlotsPerExam || 1));
            const dAvgDuration = history.dAvgDuration || 110;
            const dAvgScore = history.dAvgScore || dAvgDuration;

            // Her gözetmen için hem geçmiş sınavları hem de kalan sınavları ve puan ayrımını hesapla
            const proctorForecasts = activePool.map(staff => {
                // Sınav gözetmenliği görevleri (YALNIZCA mevcut dönem; önceki dönemler
                // taban puan + toplam sınav puanı üzerinden zaten dengelemeye yansır)
                const myAllExamDuties = currentTermExams.filter(e => {
                    if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, staff.id);
                    const pIds = e.proctorIds || (e.proctorId ? [e.proctorId] : []);
                    return pIds.map(String).includes(String(staff.id));
                });

                // Sınav dışı görevler (ayrı toplanır, sınav tahminine asla katılmaz)
                const myNonExamTasks = nonExamDutiesOnly.filter(e => {
                    if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, staff.id);
                    const pIds = e.proctorIds || (e.proctorId ? [e.proctorId] : []);
                    return pIds.map(String).includes(String(staff.id));
                });

                // Geçmiş sınavlar vs Kalan mevcut sınavlar
                const myPastExams = myAllExamDuties.filter(e => {
                    const dt = typeof getSafeDate === 'function' ? getSafeDate(e.date, e.time) : new Date(e.date + 'T' + (e.time || '00:00'));
                    return dt < now;
                });

                const myRemainingExams = myAllExamDuties.filter(e => {
                    const dt = typeof getSafeDate === 'function' ? getSafeDate(e.date, e.time) : new Date(e.date + 'T' + (e.time || '00:00'));
                    return dt >= now;
                });

                const pastExamCount = myPastExams.length;
                // Tamamlanan sınavlarda gözetmenin KENDİ girdiği süre/puan kullanılır (farklı derslikte farklı sürmüş olabilir)
                const ownDur = (e) => (typeof window.getProctorExamDuration === 'function') ? window.getProctorExamDuration(e, staff.id) : (parseInt(e.duration, 10) || 60);
                const ownScore = (e) => (typeof window.getProctorExamScore === 'function') ? window.getProctorExamScore(e, staff.id) : (parseFloat(e.score) || 0);
                const pastExamDuration = myPastExams.reduce((sum, e) => sum + ownDur(e), 0);
                const pastExamScore = myPastExams.reduce((sum, e) => sum + ownScore(e), 0);

                const remainingConfirmedCount = myRemainingExams.length;
                const remainingConfirmedDuration = myRemainingExams.reduce((sum, e) => sum + (parseInt(e.duration, 10) || 60), 0);
                const remainingConfirmedScore = myRemainingExams.reduce((sum, e) => sum + (parseFloat(e.score) || 0), 0);

                // Kesinleşmiş dönemlik toplam sınavlar
                const totalConfirmedExamCount = pastExamCount + remainingConfirmedCount;
                const totalConfirmedExamDuration = pastExamDuration + remainingConfirmedDuration;

                // Sınav Gözetmenliği Puanı (Taban puan + sınav gözetmenlikleri)
                const examTotalScore = parseFloat((staff.totalScore !== undefined ? staff.totalScore : (staff.baseScore || 0) + pastExamScore + remainingConfirmedScore).toFixed(2));

                // Sınav Dışı Görev Puanı (Festival, etkinlik, tanıtım vb.)
                const nonExamScore = parseFloat((staff.nonExamScore !== undefined ? staff.nonExamScore : myNonExamTasks.reduce((sum, e) => sum + (parseFloat(e.score) || 0), 0)).toFixed(2));
                const nonExamTaskCount = staff.nonExamTaskCount !== undefined ? staff.nonExamTaskCount : myNonExamTasks.length;
                const nonExamDuration = myNonExamTasks.reduce((sum, e) => sum + (parseInt(e.duration, 10) || 60), 0);

                // Genel Görev Puanı (Sınav + Sınav Dışı)
                const generalTotalScore = parseFloat((examTotalScore + nonExamScore).toFixed(2));

                // Kalan sınavlardan girilmiş mazeretler
                const myEnteredMazerets = myRemainingExams.filter(e => {
                    const t = String(e.type || '').toLowerCase();
                    const n = String(e.name || '').toLowerCase();
                    return t.includes('mazeret') || n.includes('mazeret');
                });
                const enteredMazeretCount = myEnteredMazerets.length;
                const enteredMazeretDuration = myEnteredMazerets.reduce((sum, e) => sum + (parseInt(e.duration, 10) || 60), 0);

                // Müsaitlik puanı
                const availScore = typeof calculateAvailabilityScore === 'function' 
                    ? calculateAvailabilityScore(staff.id) 
                    : 100;

                return {
                    id: staff.id,
                    name: staff.name,
                    role: staff.role || 'Arş. Gör.',
                    baseScore: staff.baseScore || 0,
                    examTotalScore,
                    nonExamScore,
                    nonExamTaskCount,
                    nonExamDuration,
                    generalTotalScore,
                    availabilityScore: availScore,

                    // Geçmiş sınav gözetmenlikleri
                    pastExamCount,
                    pastExamDuration,
                    pastExamScore,

                    // Kesinleşmiş kalan mevcut sınavlar
                    remainingConfirmedCount,
                    remainingConfirmedDuration,
                    remainingConfirmedScore,
                    confirmedExams: myRemainingExams.map(e => ({
                        id: e.id,
                        name: e.name,
                        date: e.date,
                        time: e.time,
                        duration: parseInt(e.duration, 10) || 60,
                        score: e.score || 0,
                        location: e.location || '-',
                        isMazeret: String(e.type || '').toLowerCase().includes('mazeret') || String(e.name || '').toLowerCase().includes('mazeret')
                    })),

                    // Girilmiş mazeretler
                    enteredMazeretCount,
                    enteredMazeretDuration,

                    // Kesinleşmiş dönemlik toplam sınavlar
                    totalConfirmedExamCount,
                    totalConfirmedExamDuration,

                    // Henüz açıklanmamış muhtemel görevler (kategori bazında)
                    estFinalCount: 0,
                    estFinalDuration: 0,
                    estimatedMazeretCount: 0,
                    estimatedMazeretDuration: 0,
                    estOtherCount: 0,
                    estOtherDuration: 0,
                    estimatedCount: 0,
                    estimatedDuration: 0,

                    // Final dönemi sonuna kadar kalan tahmini toplamlar
                    totalEstimatedCount: remainingConfirmedCount,
                    totalEstimatedDuration: remainingConfirmedDuration,

                    // Tüm dönem tahmini toplam sınav gözetmenliği
                    semesterProjectedCount: totalConfirmedExamCount,
                    semesterProjectedDuration: totalConfirmedExamDuration,

                    // Adil Dağıtım Simülasyon sayaçları:
                    // TÜM DÖNEM SINAV YÜKÜNE göre başlar, SINAV DIŞI PUANLAR DAHİL EDİLMEZ!
                    simCount: totalConfirmedExamCount,
                    simDuration: totalConfirmedExamDuration,
                    simScore: examTotalScore
                };
            });

            // --- ADİL DAĞITIM SİMÜLASYONU: Henüz açıklanmamış tüm gözetmenlik ihtiyacını paylaştır ---
            // Sıra takvimi izler: önce finaller, sonra mazeretler, en son D sınavı / bütünleme.
            // Adalet Simülatörü ile AYNI ölçüt kullanılır (iki modül çelişmesin):
            // Kural 1: Sınav gözetmenliği puanı (taban + sınavlar, sınav dışı hariç) en düşük olana öncelik
            // Kural 2: Bu dönemki sınav sayısı en az olana öncelik
            // Kural 3: Bu dönemki sınav süresi en düşük olana öncelik
            // Kural 4: Müsaitlik esnekliği yüksek olana öncelik
            const slotQueue = [
                { cat: 'final', n: remainingFinalSlots, dur: finalSlotDuration, score: finalSlotScore },
                { cat: 'mazeret', n: remainingMazeretSlots, dur: mazeretAvgDuration, score: mazeretAvgScore },
                { cat: 'other', n: remainingDSlots, dur: dAvgDuration, score: dAvgScore }
            ];
            const pickCandidate = () => {
                proctorForecasts.sort((a, b) => {
                    if (Math.abs(a.simScore - b.simScore) > 0.01) return a.simScore - b.simScore;
                    if (a.simCount !== b.simCount) return a.simCount - b.simCount;
                    if (a.simDuration !== b.simDuration) return a.simDuration - b.simDuration;
                    return b.availabilityScore - a.availabilityScore;
                });
                return proctorForecasts[0];
            };
            slotQueue.forEach(q => {
                for (let i = 0; i < q.n; i++) {
                    const c = pickCandidate();
                    if (!c) break;
                    if (q.cat === 'final') { c.estFinalCount++; c.estFinalDuration += q.dur; }
                    else if (q.cat === 'mazeret') { c.estimatedMazeretCount++; c.estimatedMazeretDuration += q.dur; }
                    else { c.estOtherCount++; c.estOtherDuration += q.dur; }
                    c.simCount++;
                    c.simDuration += q.dur;
                    c.simScore += q.score;
                }
            });

            // Toplamları güncelle
            proctorForecasts.forEach(p => {
                p.estFinalDuration = Math.round(p.estFinalDuration);
                p.estimatedMazeretDuration = Math.round(p.estimatedMazeretDuration);
                p.estOtherDuration = Math.round(p.estOtherDuration);
                p.estimatedCount = p.estFinalCount + p.estimatedMazeretCount + p.estOtherCount;
                p.estimatedDuration = p.estFinalDuration + p.estimatedMazeretDuration + p.estOtherDuration;
                p.totalEstimatedCount = p.remainingConfirmedCount + p.estimatedCount;
                p.totalEstimatedDuration = Math.round(p.remainingConfirmedDuration + p.estimatedDuration);
                p.semesterProjectedCount = p.totalConfirmedExamCount + p.estimatedCount;
                p.semesterProjectedDuration = Math.round(p.totalConfirmedExamDuration + p.estimatedDuration);
                p.projectedExamScore = parseFloat(p.simScore.toFixed(2));
            });
            const avgProjectedScore = proctorForecasts.reduce((sum, p) => sum + p.projectedExamScore, 0) / (proctorForecasts.length || 1);

            // İstatistikler ve ortalamalar
            const avgSemesterDuration = proctorForecasts.reduce((sum, p) => sum + p.semesterProjectedDuration, 0) / (proctorForecasts.length || 1);
            const avgRemainingDuration = proctorForecasts.reduce((sum, p) => sum + p.totalEstimatedDuration, 0) / (proctorForecasts.length || 1);
            const avgRemainingCount = proctorForecasts.reduce((sum, p) => sum + p.totalEstimatedCount, 0) / (proctorForecasts.length || 1);

            // Sıralama (Kalan süreye göre azalan)
            proctorForecasts.sort((a, b) => b.totalEstimatedDuration - a.totalEstimatedDuration);

            proctorForecasts.forEach((p, index) => {
                p.rank = index + 1;
                p.totalProctors = proctorForecasts.length;

                // Yük durumu, dağıtımda kullanılan ölçütle aynı: tahmini sınav gözetmenliği puanı
                const diffScore = p.projectedExamScore - avgProjectedScore;
                if (diffScore > 90) {
                    p.statusTag = 'Ort. Üzeri Yük';
                    p.statusColor = '#fb923c'; // Turuncu
                    p.relativeStanding = `Bölüm ortalamasının üzerinde (+${Math.round(diffScore)} P., Dönemlik ${p.semesterProjectedCount} sınav, ${p.rank}. sırada)`;
                } else if (diffScore < -90) {
                    p.statusTag = 'Ort. Altı Yük';
                    p.statusColor = '#38bdf8'; // Mavi
                    p.relativeStanding = `Bölüm ortalamasının altında (${Math.round(diffScore)} P., Dönemlik ${p.semesterProjectedCount} sınav, ${p.rank}. sırada)`;
                } else {
                    p.statusTag = 'Dengeli Dağılım';
                    p.statusColor = '#34d399'; // Yeşil
                    p.relativeStanding = `Bölüm ortalaması ile dengeli (Dönemlik ${p.semesterProjectedCount} sınav, ${p.rank}. sırada)`;
                }
            });

            return {
                currentTerm,
                history,
                forecastSummary: {
                    remainingExamsCount: remainingExams.length,
                    projectedTotalFinals,
                    projectedMazeretCount,
                    enteredMazeretCount: enteredMazeretExams.length,
                    remainingMazeretToDistribute,
                    remainingMazeretSlots,
                    mazeretAvgDuration: Math.round(mazeretAvgDuration),
                    enteredFinalCount: currentFinalCourses.size,
                    remainingFinalCourses,
                    remainingFinalSlots,
                    finalSlotDuration: Math.round(finalSlotDuration),
                    projectedDCount,
                    remainingDToDistribute,
                    remainingDSlots,
                    dAvgDuration: Math.round(dAvgDuration),
                    totalUnannouncedSlots: remainingFinalSlots + remainingMazeretSlots + remainingDSlots,
                    avgTotalDuration: Math.round(avgRemainingDuration),
                    avgTotalCount: parseFloat(avgRemainingCount.toFixed(1)),
                    avgSemesterDuration: Math.round(avgSemesterDuration),
                    avgProjectedScore: Math.round(avgProjectedScore),
                    activeProctorCount: proctorForecasts.length
                },
                proctorForecasts
            };
        },

        /**
         * 3. PROFİL SEKMESİNE BİLGİLENDİRME ALANI EKLENMESİ
         * Gözetmenin kendi profilinde kişisel tahmini durumunu gösterir.
         * Güvenlik: Yalnızca kullanıcının kendi profilinde veya yönetici modunda gösterilir.
         */
        renderProfileForecastSection: function(staffId) {
            const container = document.getElementById('profile-final-forecast-card');
            if (!container) return;

            const myStaffId = localStorage.getItem('myStaffId');
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

            // Güvenlik ve Gizlilik Kontrolü:
            if (!isAdmin && String(myStaffId) !== String(staffId)) {
                container.classList.add('hidden');
                container.innerHTML = '';
                return;
            }

            const data = this.calculateForecastData();
            const staffForecast = data.proctorForecasts.find(p => String(p.id) === String(staffId));

            if (!staffForecast) {
                container.classList.add('hidden');
                return;
            }

            container.classList.remove('hidden');

            const p = staffForecast;
            const s = data.forecastSummary;
            const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
            const hrs = (m) => (m / 60).toFixed(1);
            const approx = (n) => (n > 0 ? '≈' : '') + n;
            const durCell = (m, tone) => `<span class="ffc-num ffc-${tone}">${m} dk</span> <span class="ffc-muted">(${hrs(m)} sa)</span>`;

            // Tema uyumlu durum rozeti
            const badgeTone = p.statusTag === 'Ort. Üzeri Yük' ? 'amber' : (p.statusTag === 'Ort. Altı Yük' ? 'blue' : 'green');

            const sectionRow = (label, tone) => `<tr class="ffc-sec"><td colspan="3" class="ffc-${tone}">${label}</td></tr>`;
            const row = (icon, label, hint, count, minutes, tone, isApprox) => `
                <tr>
                    <td class="ffc-label"><span class="ffc-ico">${icon}</span>${label}${hint ? `<div class="ffc-hint">${hint}</div>` : ''}</td>
                    <td class="ffc-c"><span class="ffc-num ffc-${tone}">${isApprox ? approx(count) : count}</span></td>
                    <td class="ffc-r">${durCell(minutes, tone)}</td>
                </tr>`;

            const showD = s.remainingDSlots > 0 || p.estOtherCount > 0;

            const confirmedExamsHtml = p.confirmedExams.length === 0
                ? '<div class="ffc-muted" style="font-size: 0.8rem;">Takvimde size atanmış kalan sınav görevi bulunmuyor.</div>'
                : `<div class="ffc-exam-list">
                    ${p.confirmedExams.map(ex => `
                        <div class="ffc-exam-item">
                            <div>
                                <span class="ffc-strong ${ex.isMazeret ? 'ffc-amber' : 'ffc-blue'}">${ex.isMazeret ? '📋 [Mazeret]' : '📚'} ${esc(ex.name)}</span>
                                <span class="ffc-muted" style="font-size: 0.72rem;">(${esc(ex.date)} ${esc(ex.time)})</span>
                            </div>
                            <span class="ffc-num ffc-green">${ex.duration} dk</span>
                        </div>`).join('')}
                   </div>`;

            const openKey = (k) => { try { return localStorage.getItem('forecast_details_' + k) === '1' ? ' open' : ''; } catch (e) { return ''; } };
            const onToggle = (k) => `ontoggle="try{localStorage.setItem('forecast_details_${k}', this.open ? '1' : '0')}catch(e){}"`;
            const details = (k, title, body) => `
                <details class="forecast-details" ${onToggle(k)}${openKey(k)}>
                    <summary><span>${title}</span><span class="forecast-details-caret">▾</span></summary>
                    <div class="forecast-details-body">${body}</div>
                </details>`;

            container.classList.add('ffc-scope');
            container.innerHTML = `
                <div class="forecast-card-head">
                    <div class="ffc-head-title">
                        <span style="font-size: 1.4rem;">🔮</span>
                        <h3>Final Dönemi Sonuna Kadar Tahmini Görev Durumum</h3>
                    </div>
                    <div class="ffc-head-meta">
                        <span class="ffc-badge ffc-badge-${badgeTone}">${esc(p.statusTag)}</span>
                        <span class="ffc-muted">${approx(p.totalEstimatedCount)} görev</span>
                    </div>
                </div>

                <p class="ffc-intro">
                    Takviminizdeki kesin görevlere ek olarak, henüz açıklanmamış <strong>final</strong>, <strong>mazeret</strong>${showD ? ' ve <strong>D sınavı / bütünleme</strong>' : ''} gözetmenliklerinden size düşmesi muhtemel görev sayısı ve süresi.
                </p>

                <div class="ffc-tiles">
                    <div class="ffc-tile ffc-tile-blue">
                        <div class="ffc-tile-label ffc-blue">✓ Açıklanmış (Kesin)</div>
                        <div class="ffc-tile-value">${p.remainingConfirmedCount} <small>görev</small></div>
                        <div class="ffc-muted">${p.remainingConfirmedDuration} dk (${hrs(p.remainingConfirmedDuration)} saat)</div>
                    </div>
                    <div class="ffc-tile ffc-tile-amber">
                        <div class="ffc-tile-label ffc-amber">⚡ Muhtemel (Açıklanmamış)</div>
                        <div class="ffc-tile-value">${approx(p.estimatedCount)} <small>görev</small></div>
                        <div class="ffc-muted">${approx(p.estimatedDuration)} dk (${hrs(p.estimatedDuration)} saat)</div>
                    </div>
                    <div class="ffc-tile ffc-tile-green">
                        <div class="ffc-tile-label ffc-green">🎯 Final Dönemi Sonuna Kadar</div>
                        <div class="ffc-tile-value ffc-green">${approx(p.totalEstimatedCount)} <small>görev</small></div>
                        <div class="ffc-muted">${approx(p.totalEstimatedDuration)} dk (${hrs(p.totalEstimatedDuration)} saat)</div>
                    </div>
                </div>

                <div class="ffc-table-wrap">
                    <table class="ffc-table">
                        <thead>
                            <tr><th style="text-align: left;">Görev Türü</th><th style="text-align: center; width: 80px;">Sayı</th><th style="text-align: right; width: 160px;">Süre</th></tr>
                        </thead>
                        <tbody>
                            ${sectionRow('Açıklanmış görevler (takvimde)', 'blue')}
                            ${row('✓', 'Kalan kesin sınav görevleriniz', '', p.remainingConfirmedCount, p.remainingConfirmedDuration, 'blue', false)}
                            ${sectionRow('Henüz açıklanmamış muhtemel görevler', 'amber')}
                            ${row('📚', 'Muhtemel final sınavı görevi', `Bölümde ≈${s.remainingFinalCourses} final, ≈${s.remainingFinalSlots} gözetmen ihtiyacı`, p.estFinalCount, p.estFinalDuration, 'amber', true)}
                            ${row('📋', 'Muhtemel mazeret sınavı görevi', `Bölümde ≈${s.remainingMazeretToDistribute} mazeret sınavı`, p.estimatedMazeretCount, p.estimatedMazeretDuration, 'amber', true)}
                            ${showD ? row('🧾', 'Muhtemel D sınavı / bütünleme görevi', `Bölümde ≈${s.remainingDToDistribute} sınav (finallerden sonra)`, p.estOtherCount, p.estOtherDuration, 'amber', true) : ''}
                            <tr class="ffc-subtotal">
                                <td class="ffc-label">Σ Muhtemel görevler toplamı</td>
                                <td class="ffc-c"><span class="ffc-num ffc-amber">${approx(p.estimatedCount)}</span></td>
                                <td class="ffc-r">${durCell(p.estimatedDuration, 'amber')}</td>
                            </tr>
                            <tr class="ffc-total">
                                <td class="ffc-label">🎯 Final dönemi sonuna kadar toplam <span class="ffc-muted">(kesin + muhtemel)</span></td>
                                <td class="ffc-c"><span class="ffc-num ffc-green">${approx(p.totalEstimatedCount)}</span></td>
                                <td class="ffc-r">${durCell(p.totalEstimatedDuration, 'green')}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="ffc-footline">
                    <div>
                        <strong>📅 Tüm dönem:</strong>
                        ${p.pastExamCount} tamamlanan + ${p.remainingConfirmedCount} kesin + ${approx(p.estimatedCount)} muhtemel =
                        <strong class="ffc-green">${approx(p.semesterProjectedCount)} sınav (${hrs(p.semesterProjectedDuration)} saat)</strong>
                        <span class="ffc-muted">• Bölüm ort.: ${hrs(s.avgSemesterDuration)} saat</span>
                    </div>
                    ${isAdmin ? `<button type="button" class="btn-primary" onclick="openFairnessSimulatorModal()" style="font-size: 0.72rem; padding: 4px 10px; border-radius: 6px; background: linear-gradient(135deg, #0284c7, #06b6d4); color: white; border: none; font-weight: 700; cursor: pointer;" title="Gözetmenler arası puan makasını kapatacak önerileri gör">⚖️ Dengeleme Simülatörü</button>` : ''}
                </div>

                ${details('scores', '🏆 Puan Durumum', `
                    <div class="ffc-tiles">
                        <div class="ffc-tile ffc-tile-blue">
                            <div class="ffc-tile-label ffc-blue">🎓 Sınav Gözetmenliği Puanı</div>
                            <div class="ffc-tile-value">${p.examTotalScore.toFixed(1)} <small>P.</small></div>
                            <div class="ffc-muted">Taban: ${p.baseScore} P. • Sınavlar: ${(p.examTotalScore - p.baseScore).toFixed(1)} P.</div>
                        </div>
                        <div class="ffc-tile ffc-tile-amber">
                            <div class="ffc-tile-label ffc-amber">🎪 Sınav Dışı Görev Puanı</div>
                            <div class="ffc-tile-value">+${p.nonExamScore.toFixed(1)} <small>P.</small></div>
                            <div class="ffc-muted">${p.nonExamTaskCount} görev (${p.nonExamDuration} dk) • Tahmini etkilemez</div>
                        </div>
                        <div class="ffc-tile ffc-tile-violet">
                            <div class="ffc-tile-label ffc-violet">🏆 Genel Görev Puanı</div>
                            <div class="ffc-tile-value">${p.generalTotalScore.toFixed(1)} <small>P.</small></div>
                            <div class="ffc-muted">Sınav gözetmenlikleri + sınav dışı</div>
                        </div>
                    </div>
                    <div class="ffc-muted" style="font-size: 0.78rem;"><strong>📊 Karşılaştırmalı durum:</strong> ${esc(p.relativeStanding)}</div>
                `)}

                ${details('exams', `📅 Kalan Kesin Sınavlarım (${p.remainingConfirmedCount})`, confirmedExamsHtml)}

                ${details('method', '🔍 Tahmin Nasıl Hesaplandı?', `
                    <div class="ffc-method">
                        • <strong>Muhtemel finaller:</strong> Bu dönem vizesi yapılan ve finali henüz açıklanmamış derslerin final gözetmen ihtiyacı, o dersin vize oturumundaki gözetmen sayısından tahmin edildi (geçmiş dönem katsayısı ×${data.history.finalSlotFactor}). Bölümde ≈${s.remainingFinalCourses} final için ≈${s.remainingFinalSlots} gözetmen görevi, görev başına ≈${s.finalSlotDuration} dk.<br>
                        • <strong>Muhtemel mazeretler:</strong> Beklenen ${s.projectedTotalFinals} final × %${(data.history.overallRatio * 100).toFixed(1)} mazeret oranı = ${s.projectedMazeretCount} mazeret; ${s.enteredMazeretCount} tanesi açıklandı, ≈${s.remainingMazeretToDistribute} tanesi bekleniyor (≈${s.mazeretAvgDuration} dk).<br>
                        ${showD ? `• <strong>D sınavı / bütünleme:</strong> Geçmişte final yapılan ders başına ${data.history.dPerFinal} oranında yapıldı; bu dönem ≈${s.remainingDToDistribute} sınav bekleniyor (≈${s.dAvgDuration} dk).<br>` : ''}
                        • <strong>Paylaştırma:</strong> Toplam ≈${s.totalUnannouncedSlots} muhtemel gözetmen görevi, ${s.activeProctorCount} aktif gözetmen arasında sınav gözetmenliği puanı (taban + sınavlar) en düşük olandan başlanarak adil dağıtıldı; sınav dışı görevler hesaba katılmaz.<br>
                        • <strong>Veri:</strong> ${data.history.dataSufficiency.sufficiencyNote}<br>
                        <em>* Sayılar tahminidir; yeni sınavlar takvime girildikçe muhtemel görevler kesin görevlerle otomatik yer değiştirir.</em>
                    </div>
                `)}
            `;

            // Kart yeniden çizildiğinde küçült/büyüt düğmesini yeniden bağla
            if (typeof window.applyProfileCollapsiblePanels === 'function') {
                try { window.applyProfileCollapsiblePanels(); } catch (e) {}
            }
        },

        /**
         * 5. YÖNETİCİ GÖRÜNÜMÜ & MODAL
         * Yönetici panelinde tüm gözetmenlerin tahmini görev ve sürelerini karşılaştıran interaktif tablo.
         */
        openForecastModal: function() {
            const modal = document.getElementById('modal-final-forecast');
            if (!modal) return;
            if (sessionStorage.getItem('isAdmin') !== 'true') {
                alert("⚠️ Tüm gözetmenlerin tahmini görev analizi yalnızca Yönetici (Admin) girişiyle görüntülenebilir.");
                return;
            }
            
            this.currentSearchFilter = '';
            this.renderAdminView();
            modal.classList.remove('hidden');
        },

        renderAdminView: function() {
            const data = this.calculateForecastData();
            
            // KPI Kartları Güncelle
            const kpiExamsEl = document.getElementById('forecast-admin-kpi-exams');
            const kpiMazeretEl = document.getElementById('forecast-admin-kpi-mazeret');
            const kpiAvgDurEl = document.getElementById('forecast-admin-kpi-avg-dur');
            const kpiAvgTasksEl = document.getElementById('forecast-admin-kpi-avg-tasks');

            if (kpiExamsEl) kpiExamsEl.textContent = data.forecastSummary.remainingExamsCount;
            if (kpiMazeretEl) {
                const fs = data.forecastSummary;
                kpiMazeretEl.textContent = `≈${fs.totalUnannouncedSlots} görev`;
                kpiMazeretEl.title = `${fs.remainingFinalCourses} final (${fs.remainingFinalSlots} görev) · ${fs.remainingMazeretToDistribute} mazeret · ${fs.remainingDToDistribute} D sınavı`;
                const sub = kpiMazeretEl.nextElementSibling;
                if (sub) sub.textContent = `${fs.remainingFinalCourses} final · ${fs.remainingMazeretToDistribute} mazeret · ${fs.remainingDToDistribute} D sınavı`;
            }
            if (kpiAvgDurEl) kpiAvgDurEl.textContent = `${data.forecastSummary.avgTotalDuration} dk (${(data.forecastSummary.avgTotalDuration/60).toFixed(1)}s)`;
            if (kpiAvgTasksEl) kpiAvgTasksEl.textContent = `${data.forecastSummary.avgTotalCount} Görev`;

            // Bilgi Banner'ı
            const infoBanner = document.getElementById('forecast-admin-info-banner');
            if (infoBanner) {
                infoBanner.innerHTML = `
                    <div style="display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                        <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 280px;">
                            <span style="font-size: 1.3rem;">ℹ️</span>
                            <div>
                                <strong>Veri Bütünlüğü ve Hesaplama Ayrımı:</strong> Tahmini görev analizlerinde yalnızca <strong>sınav gözetmenlikleri</strong> esas alınmıştır; sınav dışı görevler dahil edilmemiştir. ${data.history.dataSufficiency.sufficiencyNote}
                            </div>
                        </div>
                        <button type="button" onclick="document.getElementById('modal-final-forecast').classList.add('hidden'); openFairnessSimulatorModal();" style="background: linear-gradient(135deg, #0284c7, #06b6d4); color: white; border: none; border-radius: 6px; padding: 7px 14px; font-size: 0.8rem; font-weight: 700; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(2,132,199,0.35);">
                            ⚖️ Akıllı Dengeleme Simülatörünü Aç ➔
                        </button>
                    </div>
                `;
            }

            // Tabloyu render et
            this.renderTableBody(data.proctorForecasts);
        },

        renderTableBody: function(proctorsList) {
            const tbody = document.querySelector('#table-final-forecast tbody');
            if (!tbody) return;

            const searchFilter = (this.currentSearchFilter || '').toLowerCase().trim();
            let filtered = proctorsList.filter(p => p.name.toLowerCase().includes(searchFilter));

            // Sıralama
            const col = this.currentSortCol;
            const dir = this.currentSortDir === 'asc' ? 1 : -1;

            filtered.sort((a, b) => {
                let valA = a[col];
                let valB = b[col];

                if (typeof valA === 'string') {
                    return dir * valA.localeCompare(valB, 'tr');
                }
                return dir * ((valA || 0) - (valB || 0));
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align:center; padding: 25px; color: var(--text-muted);">
                            Arama kriterine uygun gözetmen bulunamadı.
                        </td>
                    </tr>
                `;
                return;
            }

            const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

            tbody.innerHTML = filtered.map((p, idx) => {
                const safeName = esc(p.name);
                const jsName = esc(JSON.stringify(String(p.name || '')));
                const confHours = (p.remainingConfirmedDuration / 60).toFixed(1);
                const estHours = (p.estimatedDuration / 60).toFixed(1);
                const breakdown = [
                    p.estFinalCount ? `F ${p.estFinalCount}` : '',
                    p.estimatedMazeretCount ? `M ${p.estimatedMazeretCount}` : '',
                    p.estOtherCount ? `D ${p.estOtherCount}` : ''
                ].filter(Boolean).join(' · ') || '—';
                const totHours = (p.totalEstimatedDuration / 60).toFixed(1);
                const semHours = (p.semesterProjectedDuration / 60).toFixed(1);

                return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s ease;">
                        <td style="padding: 10px 14px;">
                            <span style="font-weight: 700; color: #94a3b8; font-size: 0.75rem; margin-right: 6px;">#${idx + 1}</span>
                            <span class="clickable-name" onclick="if(typeof showStaffSchedule==='function') showStaffSchedule(${jsName})" style="font-weight: 600; color: #f8fafc; font-size: 0.9rem;">
                                ${safeName}
                            </span>
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">
                                <span style="color: #38bdf8;">Sınav P: ${p.examTotalScore.toFixed(1)}</span> &bull; 
                                <span style="color: #fbbf24;">Sınav Dışı: ${p.nonExamScore.toFixed(1)} (${p.nonExamTaskCount})</span> &bull; 
                                <span style="color: #c084fc; font-weight: 700;">Genel: ${p.generalTotalScore.toFixed(1)}</span>
                            </div>
                        </td>
                        <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #38bdf8;">
                            ${p.remainingConfirmedCount}
                        </td>
                        <td style="padding: 10px 14px; text-align: center; color: #e2e8f0;">
                            ${p.remainingConfirmedDuration} dk <small style="color: #94a3b8;">(${confHours}s)</small>
                        </td>
                        <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #fbbf24;" title="F: final, M: mazeret, D: D sınavı / bütünleme">
                            +${p.estimatedCount}
                            <div style="font-size: 0.68rem; font-weight: 600; color: #94a3b8;">${breakdown}</div>
                        </td>
                        <td style="padding: 10px 14px; text-align: center; color: #fef08a;">
                            +${p.estimatedDuration} dk <small style="color: #94a3b8;">(${estHours}s)</small>
                        </td>
                        <td style="padding: 10px 14px; text-align: center; font-weight: 800; font-size: 0.95rem; color: #10b981;">
                            ${p.totalEstimatedCount}
                        </td>
                        <td style="padding: 10px 14px; text-align: center; font-weight: 800; font-size: 0.95rem; color: #10b981;">
                            ${p.totalEstimatedDuration} dk <small style="color: #a7f3d0; font-weight: normal;">(${totHours}s)</small>
                        </td>
                        <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #c084fc;">
                            ${p.semesterProjectedCount} Sınav <small style="color: #94a3b8;">(${p.semesterProjectedDuration} dk / ${semHours}s)</small>
                        </td>
                        <td style="padding: 10px 14px; text-align: center;">
                            <span style="font-size: 0.72rem; padding: 3px 8px; border-radius: 12px; font-weight: 700; background: rgba(255,255,255,0.05); color: ${p.statusColor}; border: 1px solid ${p.statusColor}44;">
                                ${p.statusTag}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        },

        sortTable: function(column) {
            if (this.currentSortCol === column) {
                this.currentSortDir = this.currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                this.currentSortCol = column;
                this.currentSortDir = (column === 'name') ? 'asc' : 'desc';
            }
            this.renderAdminView();
        },

        filterTable: function(searchTerm) {
            this.currentSearchFilter = searchTerm || '';
            const data = this.calculateForecastData();
            this.renderTableBody(data.proctorForecasts);
        },

        exportToExcel: function() {
            const data = this.calculateForecastData();
            const exportRows = data.proctorForecasts.map((p, idx) => ({
                "Sıra": idx + 1,
                "Gözetmen Adı": p.name,
                "Sınav Gözetmenliği Puanı": p.examTotalScore,
                "Sınav Dışı Görev Puanı": p.nonExamScore,
                "Sınav Dışı Görev Sayısı": p.nonExamTaskCount,
                "Genel Görev Puanı": p.generalTotalScore,
                "Geçmiş Tamamlanan Sınav Sayısı": p.pastExamCount,
                "Geçmiş Tamamlanan Sınav Süresi (dk)": p.pastExamDuration,
                "Kalan Mevcut Görev Sayısı": p.remainingConfirmedCount,
                "Kalan Mevcut Görev Süresi (dk)": p.remainingConfirmedDuration,
                "Kalan Mevcut Görev Süresi (Saat)": parseFloat((p.remainingConfirmedDuration / 60).toFixed(2)),
                "Muhtemel Final Görev Sayısı": p.estFinalCount,
                "Muhtemel Final Süresi (dk)": p.estFinalDuration,
                "Muhtemel Mazeret Görev Sayısı": p.estimatedMazeretCount,
                "Muhtemel Mazeret Süresi (dk)": p.estimatedMazeretDuration,
                "Muhtemel D Sınavı/Bütünleme Görev Sayısı": p.estOtherCount,
                "Muhtemel D Sınavı/Bütünleme Süresi (dk)": p.estOtherDuration,
                "Muhtemel (Açıklanmamış) Toplam Görev": p.estimatedCount,
                "Muhtemel (Açıklanmamış) Toplam Süre (dk)": p.estimatedDuration,
                "Muhtemel (Açıklanmamış) Toplam Süre (Saat)": parseFloat((p.estimatedDuration / 60).toFixed(2)),
                "Final Dönemi Kalan Tahmini Toplam Görev": p.totalEstimatedCount,
                "Final Dönemi Kalan Tahmini Toplam Süre (dk)": p.totalEstimatedDuration,
                "Final Dönemi Kalan Tahmini Toplam Süre (Saat)": parseFloat((p.totalEstimatedDuration / 60).toFixed(2)),
                "Tüm Dönem Toplam Sınav Görevi": p.semesterProjectedCount,
                "Tüm Dönem Toplam Sınav Süresi (dk)": p.semesterProjectedDuration,
                "Tüm Dönem Toplam Sınav Süresi (Saat)": parseFloat((p.semesterProjectedDuration / 60).toFixed(2)),
                "Dağılım Durumu": p.statusTag
            }));

            if (typeof XLSX !== 'undefined') {
                const ws = XLSX.utils.json_to_sheet(exportRows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Final ve Mazeret Tahmini");
                XLSX.writeFile(wb, `GTU_Final_Donemi_Tahmini_Gorev_Analizi_${this.localDateStr()}.xlsx`);
            } else {
                alert("Excel kütüphanesi yüklenemedi.");
            }
        }
    };

    // Global nesne ve fonksiyon atamaları
    window.FinalForecastEngine = FinalForecastEngine;
    window.renderProfileFinalForecast = function(staffId) {
        FinalForecastEngine.renderProfileForecastSection(staffId);
    };
    window.openFinalForecastModal = function() {
        FinalForecastEngine.openForecastModal();
    };
    window.sortFinalForecastTable = function(col) {
        FinalForecastEngine.sortTable(col);
    };
    window.filterFinalForecastTable = function(val) {
        FinalForecastEngine.filterTable(val);
    };
    window.exportFinalForecastToExcel = function() {
        FinalForecastEngine.exportToExcel();
    };

})(window);
