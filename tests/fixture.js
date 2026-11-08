/**
 * Sentetik ve deterministik test verisi.
 * Gerçek verinin yapısını taklit eder (gerçek kişi adı içermez):
 *   - 2025-2026 Bahar: 27 vize dersi (salon başına ayrı satır), 24 final, 11 mazeret, 14 D sınavı
 *   - 2025-2026 Yaz:   7 vize, 7 final, 8 mazeret (oran hesabından hariç tutulmalı)
 *   - 2026-2027 Güz:   7 Ek Sınav (Ekim), 26 vize dersi (tek satırda çok gözetmen), sınav dışı görevler
 * Saat: 8 Kasım 2026 12:00 (yerel)
 */
'use strict';

const NOW = new Date(2026, 10, 8, 12, 0, 0);

const BASES = [1440, 600, 1440, 1200, 1320, 1200, 1560, 1200, 1440, 600, 1200, 1800];

function pad(n) { return String(n).padStart(2, '0'); }
function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function buildFixture() {
    const staff = BASES.map((b, i) => ({
        id: i + 1,
        name: `Arş. Gör. Test${String.fromCharCode(65 + i)} Kişi`,
        baseScore: b,
        role: 'assistant'
    }));
    // Gözetmenlik almayan öğretim üyeleri (aktif havuza GİRMEMELİ)
    staff.push({ id: 20, name: 'Prof. Dr. Hoca Bir', baseScore: 0 });
    staff.push({ id: 21, name: 'Doç. Dr. Hoca İki', baseScore: 0 });

    const exams = [];
    let nextId = 1000;
    let rot = 0;
    const take = (n) => {
        const ids = [];
        for (let k = 0; k < n; k++) { ids.push((rot % 12) + 1); rot++; }
        return ids;
    };
    const add = (o) => { exams.push(Object.assign({ id: nextId++, location: 'D-101' }, o)); };

    // ---------------- 2025-2026 BAHAR ----------------
    const baharVizeSlots = {};
    for (let c = 0; c < 27; c++) {
        const course = `MATH ${101 + c}`;
        const slots = 1 + (c % 3);
        baharVizeSlots[course] = slots;
        const date = addDays('2026-04-06', c);
        const time = c % 2 ? '13:30' : '09:30';
        // Bahar kayıt biçimi: her salon (gözetmen) ayrı satır
        take(slots).forEach(pid => add({
            date, time, duration: 90 + (c % 3) * 15, type: 'Vize',
            name: `${course} - Ders ${c}`, proctorIds: [pid], proctorId: pid
        }));
    }
    for (let c = 0; c < 24; c++) {
        const course = `MATH ${101 + c}`;
        const v = baharVizeSlots[course];
        const slots = (c % 4 === 0 && v > 1) ? v - 1 : v;
        const ids = take(slots);
        add({
            date: addDays('2026-06-08', c % 12), time: c % 2 ? '13:30' : '09:30', duration: 110,
            type: 'Final', name: `${course} - Ders ${c}`, proctorIds: ids, proctorId: ids[0]
        });
    }
    for (let k = 0; k < 11; k++) {
        const ids = take(1);
        add({ date: addDays('2026-05-21', k * 3), time: '10:00', duration: 110, type: 'Mazeret',
            name: `MATH ${101 + k} Mazeret`, proctorIds: ids, proctorId: ids[0] });
    }
    for (let k = 0; k < 14; k++) {
        const ids = take(1);
        add({ date: addDays('2026-06-29', k % 5), time: k % 2 ? '14:00' : '10:00', duration: 120, type: 'D SINAVI',
            name: `MATH ${101 + k} - Ders ${k}`, proctorIds: ids, proctorId: ids[0] });
    }
    // Sınav sayılmayan "Diğer" kayıtlar (projeksiyona girmemeli)
    add({ date: '2026-05-12', time: '09:00', duration: 450, type: 'Diğer', name: 'Bilim Festivali Hazırlık', proctorIds: [1], proctorId: 1 });

    // ---------------- 2025-2026 YAZ ----------------
    for (let c = 0; c < 7; c++) {
        let ids = take(2);
        add({ date: addDays('2026-08-05', c * 3), time: '10:00', duration: 110, type: 'Vize', name: `MATH ${301 + c} - Yaz`, proctorIds: ids, proctorId: ids[0] });
        ids = take(2);
        add({ date: addDays('2026-08-28', c * 2), time: '10:00', duration: 120, type: 'Final', name: `MATH ${301 + c} - Yaz`, proctorIds: ids, proctorId: ids[0] });
    }
    for (let k = 0; k < 8; k++) {
        const ids = take(1);
        add({ date: addDays('2026-08-26', k * 3), time: '10:00', duration: 100, type: 'Mazeret', name: `MATH ${301 + (k % 4)} Mazeret`, proctorIds: ids, proctorId: ids[0] });
    }

    // ---------------- 2026-2027 GÜZ (devam eden dönem) ----------------
    for (let k = 0; k < 7; k++) {
        const ids = take(1);
        add({ date: addDays('2026-10-12', k % 4), time: '10:00', duration: 90, type: 'Ek Sınav', name: `MATH ${401 + k} Ek`, proctorIds: ids, proctorId: ids[0] });
    }
    const guzNames = [];
    for (let c = 0; c < 26; c++) {
        let name = `MATH ${201 + c} - Güz Ders ${c}`;
        if (c === 24) name = 'MAT 542  \tReel Analiz ';          // düzensiz boşluk
        if (c === 25) name = 'TUR 101 Turkish I';
        guzNames.push(name);
        const n = 1 + (c % 5);
        const date = addDays('2026-10-20', Math.floor(c * 1.4));
        const time = c % 2 ? '15:00' : '09:30';
        const ids = take(n);
        add({ date, time, duration: c % 3 === 0 ? 120 : 90, type: 'Vize', name, proctorIds: ids, proctorId: ids[0] });
        if (c === 3) {
            // Aynı oturumun ikinci salonu (oturum gözetmen sayısı toplanmalı)
            const extra = take(1);
            add({ date, time, duration: 120, type: 'Vize', name, proctorIds: extra, proctorId: extra[0], location: 'D-102' });
        }
    }
    // Sınav dışı görevler (20.06.2026 sonrası → ayrı kategori, tahmini etkilememeli)
    add({ date: '2026-11-20', time: '10:00', duration: 240, type: 'Diğer', name: 'Bölüm Tanıtımı', isNonExam: true, proctorIds: [2], proctorId: 2 });
    add({ date: '2026-10-25', time: '10:00', duration: 180, type: 'Diğer', name: 'Lise Ziyareti', isNonExam: true, proctorIds: [5, 7], proctorId: 5 });

    return {
        staff,
        exams,
        constraints: {},
        requests: [], auditLogs: [], notifications: [], examTypes: ['Vize', 'Final', 'Mazeret'],
        announcements: [], courseCatalog: [], lecturers: []
    };
}

module.exports = { NOW, buildFixture, addDays };
