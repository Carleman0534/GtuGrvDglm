/**
 * 🛡️ VERİ KORUMA KATMANI
 * logic.js ve app.js'den SONRA yüklenmelidir (index.html'de en sondaki script).
 *
 * Çözülen sorun: Her kullanıcı tüm veritabanını PUT ile baştan yazıyordu. Sunucudan veri
 * okuyamayan bir tarayıcı (yeni cihaz, zaman aşımı, eski önbellek) koddaki varsayılan veriyle
 * ya da eski yerel kopyayla açılıp bunu Firebase'in üzerine yazabiliyordu.
 *
 * Bu katman şunları garanti eder:
 *  1. Bu oturumda sunucudan veri başarıyla okunmadıysa Firebase'e HİÇ yazılmaz.
 *  2. Kayıttan hemen önce sunucudaki güncel veri okunur; sadece BU kullanıcının yaptığı
 *     değişiklikler (son okunan veriye göre fark) onun üzerine uygulanır (3 yönlü birleştirme).
 *  3. Yazma ETag kilidiyle yapılır: arada başkası kaydettiyse yazma reddedilir ve yeniden birleştirilir.
 *  4. Sınav/personel sayısında ani büyük düşüş varsa kayıt durdurulur (admin onayı istenir).
 *  5. Her kayıtta _rev sayacı bir artırılır; Firebase kuralı bu sayacı zorunlu tutarak
 *     eski sürümlerin ve dışarıdan gelen isteklerin yazmasını engeller.
 */
(function () {
    'use strict';

    if (typeof API_URL === 'undefined') {
        console.error('🛡️ Veri koruma: API_URL bulunamadı, katman devre dışı.');
        return;
    }

    const REV_URL = API_URL.replace(/\.json$/, '/_rev.json');
    const FULL_SYNC_EVERY_MS = 2 * 60 * 1000;   // Tam veri kontrolü: 2 dakikada bir
    const REV_CHECK_EVERY_MS = 10 * 1000;       // Hafif sürüm kontrolü: 10 saniyede bir
    const SHRINK_RATIO = 0.7;                   // %30'dan fazla düşüş şüphelidir
    const SHRINK_MIN_COUNT = 10;

    let _base = null;            // Sunucudan en son okunan / yazılan ham veri
    let _serverLoaded = false;   // Bu oturumda sunucudan veri okundu mu?
    let _loadPromise = null;
    let _dirty = false;          // Henüz sunucuya ulaşmamış yerel değişiklik var mı?
    let _saveChain = Promise.resolve();
    let _blockedWarned = false;

    // ---------- Yardımcılar ----------
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const isPlainObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
    const hasIds = (arr) => Array.isArray(arr) && arr.every(e => isPlainObj(e) && e.id !== undefined && e.id !== null);
    const isAdmin = () => sessionStorage.getItem('isAdmin') === 'true';

    function toast(msg, type) {
        if (typeof window.showToast === 'function') window.showToast(msg, type);
        else console.log(msg);
    }

    function setStatus(state, text) {
        if (typeof _setCloudStatus === 'function') _setCloudStatus(state, text);
    }

    function refreshUI() {
        ['renderExams', 'renderStaff', 'renderSchedule', 'renderDashboard',
         'renderSwapRequests', 'updateRequestBadge', 'updateMarketplaceBadge'].forEach(fn => {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (e) { console.warn(fn, e); }
        });
    }

    function cacheLocally() {
        try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) {}
    }

    async function fetchRemote() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(API_URL + '?t=' + Date.now(), {
                headers: { 'X-Firebase-ETag': 'true' },
                cache: 'no-store',
                signal: controller.signal
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const text = await res.text();
            return { etag: res.headers.get('ETag'), text, data: JSON.parse(text) };
        } finally {
            clearTimeout(timer);
        }
    }

    function isValidRemote(data) {
        return isPlainObj(data) && Array.isArray(data.staff) && data.staff.length > 0;
    }

    // ---------- 3 yönlü birleştirme ----------
    // base: son okunan sunucu verisi, local: bu kullanıcının verisi, remote: şu anki sunucu verisi.
    // Kural: bir alan yerelde değişmediyse sunucudaki hali alınır; değiştiyse yerel hali alınır.

    function mergeObject(b, l, r) {
        b = b || {}; l = l || {}; r = r || {};
        const out = {};
        new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]).forEach(k => {
            const v = same(l[k], b[k]) ? r[k] : l[k];
            if (v !== undefined) out[k] = clone(v);
        });
        return out;
    }

    function mergeArray(b, l, r) {
        b = b || []; l = l || []; r = r || [];
        if (same(l, b)) return clone(r);
        if (same(r, b)) return clone(l);
        // Kimliksiz diziler öğe öğe eşleştirilemez: yerel değişiklik kazanır
        if (!hasIds(b) || !hasIds(l) || !hasIds(r)) return clone(l);

        const key = e => String(e.id);
        const bMap = new Map(b.map(e => [key(e), e]));
        const lMap = new Map(l.map(e => [key(e), e]));
        const out = [];
        const seen = new Set();

        r.forEach(re => {
            const k = key(re);
            seen.add(k);
            const be = bMap.get(k), le = lMap.get(k);
            if (be && !le) return;                                  // yerelde silindi
            if (le && be && !same(le, be)) out.push(mergeObject(be, le, re)); // ikisinde de var, yerelde değişti
            else if (le && !be) out.push(clone(le));                // ikisinde de yeni eklendi
            else out.push(clone(re));                               // yerelde değişmedi
        });
        l.forEach(le => {
            const k = key(le);
            if (!seen.has(k) && !bMap.has(k)) out.push(clone(le));  // yerelde yeni eklendi
        });
        return out;
    }

    function mergeDB(b, l, r) {
        b = b || {}; l = l || {}; r = r || {};
        const out = {};
        new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]).forEach(k => {
            let v;
            if (same(l[k], b[k])) v = r[k];
            else if (same(r[k], b[k])) v = l[k];
            else if (Array.isArray(l[k]) && Array.isArray(r[k])) v = mergeArray(b[k], l[k], r[k]);
            else if (isPlainObj(l[k]) && isPlainObj(r[k])) v = mergeObject(b[k], l[k], r[k]);
            else v = l[k];
            if (v !== undefined) out[k] = clone(v);
        });
        return out;
    }

    // ---------- Ani veri kaybı kontrolü ----------
    function shrinkProblem(remote, next) {
        if (!isPlainObj(remote)) return null;
        for (const k of ['exams', 'staff', 'requests']) {
            const before = (remote[k] || []).length;
            const after = (next[k] || []).length;
            if (before >= SHRINK_MIN_COUNT && after < before * SHRINK_RATIO) {
                return { key: k, before, after };
            }
        }
        return null;
    }

    // ---------- Yükleme ----------
    const originalLoad = window.loadFromDataJSON;

    window.loadFromDataJSON = function () {
        _loadPromise = (async () => {
            // Gönderilmemiş değişiklik varsa önce onları kaydet, sonra yeniden yükle
            if (_dirty && _serverLoaded) await window.saveToBackend();

            let remote = null;
            try { remote = await fetchRemote(); }
            catch (e) { console.warn('🛡️ Sunucudan okunamadı:', e.message); }

            const ok = remote && (remote.data === null || isValidRemote(remote.data));
            if (ok) {
                _base = remote.data === null ? null : JSON.parse(remote.text);
                _serverLoaded = true;
                _blockedWarned = false;
            } else {
                _serverLoaded = false;
            }

            // Orijinal yükleyici, az önce okunan veriyi kullansın (ikinci kez indirmesin)
            const realFetch = window.fetch;
            if (ok) {
                window.fetch = function (url, opts) {
                    const isGet = !opts || !opts.method || opts.method.toUpperCase() === 'GET';
                    if (typeof url === 'string' && url.indexOf(API_URL) === 0 && isGet) {
                        return Promise.resolve(new Response(remote.text, {
                            status: 200, headers: { 'Content-Type': 'application/json' }
                        }));
                    }
                    return realFetch.apply(this, arguments);
                };
            }
            try {
                return await originalLoad.apply(this, arguments);
            } finally {
                window.fetch = realFetch;
                if (!_serverLoaded) {
                    setStatus('error', '🔴 Sunucuya ulaşılamadı — değişiklikler KAYDEDİLMİYOR');
                    toast('⚠️ Sunucudan veri alınamadı. Eski veri gösteriliyor olabilir ve değişiklikleriniz kaydedilmeyecek. Lütfen sayfayı yenileyin.', 'error');
                }
            }
        })();
        return _loadPromise;
    };

    // ---------- Kaydetme ----------
    window.saveToBackend = function () {
        _dirty = true;
        _saveChain = _saveChain.then(doSave).catch(e => console.error('🛡️ Kayıt hatası:', e));
        return _saveChain;
    };

    async function doSave() {
        if (!_dirty) return;
        // İlk yükleme sürüyorsa bitmesini bekle (yüklenmiş oturumda bekleme yok: kilitlenmeyi önler)
        if (!_serverLoaded && _loadPromise) { try { await _loadPromise; } catch (e) {} }

        if (!DB || !Array.isArray(DB.staff) || DB.staff.length === 0) {
            console.error('🚨 [Güvenlik] Personel boş — Firebase kayıt iptal.');
            return;
        }
        if (!_serverLoaded) {
            console.error('🚨 [Güvenlik] Bu oturumda sunucudan veri okunamadı — Firebase kayıt engellendi.');
            if (!_blockedWarned) {
                _blockedWarned = true;
                toast('⛔ Sunucu verisi yüklenemediği için değişiklik kaydedilmedi. Sayfayı yenileyip tekrar deneyin.', 'error');
            }
            setStatus('error', '🔴 Kayıt engellendi — sayfayı yenileyin');
            return;
        }
        if (!navigator.onLine) {
            if (typeof _markPendingSync === 'function') _markPendingSync();
            setStatus('offline', '🔴 Çevrimdışı — bağlantı gelince kaydedilecek');
            return;
        }

        _isSyncing = true;
        setStatus('syncing', '🔄 Eşitleniyor...');
        try {
            let done = false;
            for (let attempt = 1; attempt <= 6 && !done; attempt++) {
                _dirty = false;
                const localSnap = clone(DB);

                let remote;
                try { remote = await fetchRemote(); }
                catch (e) {
                    _dirty = true;
                    if (attempt === 6) throw e;
                    setStatus('retrying', `🟡 Yeniden deneniyor... (${attempt}/5)`);
                    await sleep(attempt * 3000);
                    continue;
                }

                if (remote.data !== null && !isValidRemote(remote.data)) {
                    throw new Error('Sunucudaki veri geçersiz biçimde, kayıt yapılmadı.');
                }

                // Yerelde değişiklik yoksa yazmaya gerek yok
                if (same(localSnap, _base)) {
                    if (!same(remote.data, _base)) adoptRemote(remote.data, localSnap);
                    done = true;
                    break;
                }

                const merged = (remote.data === null || same(remote.data, _base))
                    ? clone(localSnap)
                    : mergeDB(_base, localSnap, remote.data);

                const problem = shrinkProblem(remote.data, merged);
                if (problem) {
                    const label = { exams: 'sınav', staff: 'personel', requests: 'talep' }[problem.key];
                    const msg = `⚠️ DİKKAT: Bu kayıt ${label} sayısını ${problem.before} → ${problem.after} düşürecek.\n\n` +
                        `Bu bir veri kaybı olabilir. Gerçekten bu kadar kaydı silmek istiyor musunuz?`;
                    if (!isAdmin() || !window.confirm(msg)) {
                        console.error('🚨 [Güvenlik] Ani veri düşüşü nedeniyle kayıt durduruldu:', problem);
                        setStatus('error', '🔴 Şüpheli kayıt durduruldu');
                        toast(`⛔ Kayıt durduruldu: ${label} sayısı ${problem.before} → ${problem.after} düşecekti. Sunucudaki veri korunuyor.`, 'error');
                        adoptRemote(remote.data, null, true);
                        return;
                    }
                }

                merged._rev = ((remote.data && remote.data._rev) || 0) + 1;
                merged._lastWrite = new Date().toISOString();

                const headers = { 'Content-Type': 'application/json' };
                if (remote.etag) headers['if-match'] = remote.etag;
                const res = await fetch(API_URL, { method: 'PUT', headers, body: JSON.stringify(merged) });

                if (res.status === 412) {
                    // Biz okuduktan sonra başkası kaydetti: yeniden oku ve birleştir
                    console.log('🛡️ Eşzamanlı kayıt algılandı, yeniden birleştiriliyor...');
                    _dirty = true;
                    continue;
                }
                if (!res.ok) {
                    const body = await res.text().catch(() => '');
                    if (res.status === 401 || res.status === 403) {
                        throw new Error('Firebase kuralı kaydı reddetti (' + res.status + '). ' + body);
                    }
                    _dirty = true;
                    if (attempt === 6) throw new Error('HTTP ' + res.status + ' ' + body);
                    await sleep(attempt * 3000);
                    continue;
                }

                _base = clone(merged);
                const othersChanged = !same(merged, Object.assign(clone(localSnap), { _rev: merged._rev, _lastWrite: merged._lastWrite }));
                if (same(DB, localSnap)) {
                    DB = merged;
                } else {
                    // Kayıt sürerken kullanıcı yeni değişiklik yaptı: onları da koru
                    DB = mergeDB(localSnap, DB, merged);
                    _dirty = true;
                }
                cacheLocally();
                if (othersChanged) {
                    refreshUI();
                    toast('🔄 Başka kullanıcıların değişiklikleri sizinkilerle birleştirildi.', 'success');
                }
                if (!_dirty) done = true;
            }
            if (!done && !_dirty) throw new Error('Eşzamanlı kayıt çakışması çözülemedi.');

            if (typeof _clearPendingSync === 'function' && !_dirty) _clearPendingSync();
            setStatus('ok', '✅ Bulutla Eşitlendi');
            console.log(`✅ Firebase kayıt başarılı (rev ${_base && _base._rev}). Sınav: ${(DB.exams || []).length}`);
        } catch (e) {
            _dirty = true;
            if (typeof _markPendingSync === 'function') _markPendingSync();
            setStatus(isAdmin() ? 'error' : 'hidden', isAdmin() ? '🔴 Kayıt başarısız — değişiklik bekliyor' : '');
            console.error('❌ Firebase kayıt başarısız:', e.message);
            if (isAdmin()) toast('⚠️ Firebase\'e kaydedilemedi: ' + e.message, 'error');
        } finally {
            _isSyncing = false;
        }
    }

    // Sunucudaki veriyi ekrana al. discardLocal=false ise yerel normalizasyonlar korunur;
    // oturum hiç yüklenmemişse veya discardLocal=true ise yerel veri tamamen bırakılır.
    function adoptRemote(remoteData, localSnap, discardLocal) {
        if (!isValidRemote(remoteData)) return;
        const local = localSnap || DB;
        const keepLocal = !discardLocal && _serverLoaded && _base;
        let next = keepLocal ? mergeDB(_base, local, remoteData) : clone(remoteData);
        if (!keepLocal) _dirty = false;
        if (!next.lecturers || next.lecturers.length === 0) next.lecturers = DB.lecturers;
        if (!next.courseLecturers || Object.keys(next.courseLecturers).length === 0) next.courseLecturers = DB.courseLecturers;
        if (!next.constraints) next.constraints = {};
        if (!next.requests) next.requests = [];
        _base = clone(remoteData);
        _serverLoaded = true;
        DB = next;
        cacheLocally();
        if (typeof saveAutoSnapshot === 'function') saveAutoSnapshot(DB, 'Periyodik Senkronizasyon');
        refreshUI();
    }

    // ---------- Periyodik senkronizasyon (app.js'deki sürümün yerine) ----------
    window.startPeriodicSync = function () {
        let lastFull = 0;

        async function tick() {
            // Kayıt engellenmiş oturumda (_serverLoaded=false) yerel değişiklik beklese bile
            // sunucu verisini almaya devam et ki oturum kendini toparlayabilsin.
            const busy = () => _isSyncing || (_dirty && _serverLoaded);
            if (!navigator.onLine || document.hidden || busy()) return;
            try {
                const now = Date.now();
                if (now - lastFull < FULL_SYNC_EVERY_MS && _serverLoaded) {
                    // Hafif kontrol: sadece _rev sayacını oku (birkaç bayt)
                    const res = await fetch(REV_URL + '?t=' + now, { cache: 'no-store' });
                    if (!res.ok) return;
                    const rev = await res.json();
                    const known = (_base && _base._rev !== undefined) ? _base._rev : null;
                    if (rev === known) return;
                }
                lastFull = now;
                const remote = await fetchRemote();
                if (busy()) return;
                if (!isValidRemote(remote.data)) return;
                if (_serverLoaded && same(remote.data, _base)) return;

                const wasLoaded = _serverLoaded;
                adoptRemote(remote.data, null);
                if (wasLoaded) toast('🔄 Başka bir kullanıcının değişiklikleri senkronize edildi.', 'success');
                else toast('✅ Sunucu bağlantısı sağlandı, güncel veri yüklendi.', 'success');
                setStatus('ok', '✅ Bulutla Eşitlendi');
            } catch (e) {
                console.warn('⚠️ Periyodik senkronizasyon hatası (önemsiz):', e.message);
            }
        }

        setInterval(tick, REV_CHECK_EVERY_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
        console.log('🛡️ Korumalı periyodik senkronizasyon başlatıldı.');
    };

    // Kaydedilmemiş değişiklik varken sayfadan çıkılırsa uyar
    window.addEventListener('beforeunload', (e) => {
        if (_dirty || _isSyncing) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    console.log('🛡️ Veri koruma katmanı etkin.');
})();
