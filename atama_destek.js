/**
 * Atama uygunluk yardımcıları.
 * Otomatik atama ve öneri listelerinde ek uygunluk kontrolleri yapar.
 * Arayüzde hiçbir şey göstermez; uygun olmayan aday yalnızca listeye alınmaz.
 */
(function (root) {
    'use strict';

    // ---------------------------------------------------------------- yardımcılar
    function norm(str) {
        let s = String(str == null ? '' : str).toLocaleUpperCase('tr-TR');
        s = s.replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
             .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C').replace(/Â/g, 'A').replace(/Î/g, 'I').replace(/Û/g, 'U');
        s = s.replace(/[^A-Z]+/g, ' ');
        const drop = new Set(['PROF', 'DOC', 'DR', 'OGR', 'UYESI', 'UYE', 'ARS', 'ARAS', 'GOR', 'OGRETIM', 'YRD', 'DOCENT', 'ARASTIRMA', 'GOREVLISI']);
        return s.split(' ').filter(t => t && !drop.has(t)).sort().join(' ');
    }
    function h(str) {
        // FNV-1a 32 bit
        let x = 0x811c9dc5;
        const s = norm(str);
        for (let i = 0; i < s.length; i++) {
            x ^= s.charCodeAt(i);
            x = Math.imul(x, 0x01000193) >>> 0;
        }
        return ('0000000' + x.toString(16)).slice(-8);
    }

    // ---------------------------------------------------------------- tanımlar
    // [a, b]: a ile b aynı derslikte / aynı sınav satırında birlikte görevlendirilmez
    let P = [['1ece3c5b', '835e0fb0']];
    // [a, b]: a, ders sorumlusu b olan sınavlara önerilmez
    let L = [['e240b1cd', '4d667889']];

    // ---------------------------------------------------------------- erişim
    const S = (v) => String(v);
    function db() {
        if (typeof DB !== 'undefined' && DB) return DB;
        return (root && root.DB) || { staff: [], exams: [] };
    }
    function staffOf(ref) {
        if (ref && typeof ref === 'object') return ref;
        const list = db().staff || [];
        return list.find(s => S(s.id) === S(ref)) || list.find(s => s.name === ref) || (typeof ref === 'string' ? { name: ref } : null);
    }
    function pidsOf(ex) {
        const out = [];
        if (ex && Array.isArray(ex.proctorIds)) ex.proctorIds.forEach(p => out.push(S(p)));
        if (ex && ex.proctorId != null && ex.proctorId !== '') out.push(S(ex.proctorId));
        return [...new Set(out)];
    }
    function hashOfId(id) {
        const st = (db().staff || []).find(s => S(s.id) === S(id));
        return st ? h(st.name) : null;
    }
    function mins(t) {
        const m = String(t || '').split('-')[0].trim().match(/(\d{1,2})[:.](\d{2})/);
        return m ? (+m[1]) * 60 + (+m[2]) : null;
    }
    function room(loc) {
        // "D-201", "d 201", "D201" aynı derslik sayılır
        const r = String(loc || '').toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, '');
        return (!r || r === 'BELIRTILMEDI' || r === 'BELİRTİLMEDİ') ? '' : r;
    }
    function lecturersOf(ctx) {
        let raw = ctx && ctx.lecturer && ctx.lecturer !== '-' ? String(ctx.lecturer) : '';
        if (!raw && ctx && ctx.name && typeof root.findCourseInCatalog === 'function') {
            try { const c = root.findCourseInCatalog(ctx.name); if (c && c.lecturer) raw = c.lecturer; } catch (e) {}
        }
        if (!raw) return [];
        return raw.split(/[\/,;&+]| ve /i).map(x => x.trim()).filter(Boolean).map(h);
    }

    /**
     * Aday bu sınava uygun mu?
     * @param staffRef  personel nesnesi, id veya ad
     * @param ctx       sınav bilgisi: { id, date, time, duration, location, lecturer, name, proctorIds }
     * @param opts      { exams: kontrol edilecek sınav listesi, ayrilan: görevden ayrılacak kişi id'leri,
     *                    ekler: aynı sınava birlikte atanmakta olan kişi id'leri, haric: yok sayılacak sınav id'leri }
     */
    function uygunMu(staffRef, ctx, opts) {
        try {
            const st = staffOf(staffRef);
            if (!st || !st.name || !ctx) return true;
            const me = h(st.name);
            const o = opts || {};
            const leaving = new Set((o.ayrilan || []).filter(v => v != null).map(S));
            const selfId = st.id != null ? S(st.id) : null;

            // 1) Ders sorumlusu kontrolü
            const lec = L.filter(r => r[0] === me).map(r => r[1]);
            if (lec.length) {
                const lh = lecturersOf(ctx);
                if (lh.some(x => lec.includes(x))) return false;
            }

            // 2) Birlikte görevlendirilmeme kontrolü
            const partners = P.filter(r => r[0] === me || r[1] === me).map(r => (r[0] === me ? r[1] : r[0]));
            if (!partners.length) return true;
            const isPartner = (id) => { const x = hashOfId(id); return x && partners.includes(x); };

            // Aynı sınav satırı (aynı derslik)
            const co = pidsOf(ctx).concat((o.ekler || []).map(S)).filter(id => id !== selfId && !leaving.has(id));
            if (co.some(isPartner)) return false;

            // Aynı saatte aynı derslikteki diğer satırlar
            const r0 = room(ctx.location);
            const s0 = mins(ctx.time);
            if (!r0 || s0 == null || !ctx.date) return true;
            const e0 = s0 + (parseInt(ctx.duration, 10) || 60);
            const skip = new Set([ctx.id].concat(o.haric || []).filter(v => v != null).map(S));
            const list = o.exams || db().exams || [];
            for (const ex of list) {
                if (!ex || skip.has(S(ex.id)) || ex.date !== ctx.date || room(ex.location) !== r0) continue;
                const s1 = mins(ex.time);
                if (s1 == null) continue;
                const e1 = s1 + (parseInt(ex.duration, 10) || 60);
                if (!(s0 < e1 && e0 > s1)) continue;
                if (pidsOf(ex).filter(id => !leaving.has(id)).some(isPartner)) return false;
            }
            return true;
        } catch (e) {
            return true;
        }
    }

    // Testler için: tanımları geçici olarak değiştir (isimlerle) ve geri al
    function _testTanim(pairs, lects) {
        const eski = { P, L };
        P = (pairs || []).map(([a, b]) => [h(a), h(b)]);
        L = (lects || []).map(([a, b]) => [h(a), h(b)]);
        return () => { P = eski.P; L = eski.L; };
    }
    function _sayi() { return { p: P.length, l: L.length }; }

    const api = { uygunMu, _h: h, _testTanim, _sayi };
    root.AtamaDestek = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
