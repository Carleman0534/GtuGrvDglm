/**
 * 📱 MOBİL TABLO → KART GÖRÜNÜMÜ (mobil_tablo.js)
 *
 * Geniş tablolar telefonda yana kaydırmak zorunda kalınıyordu. Bu dosya, aşağıdaki
 * tabloların her hücresine sütun başlığını (data-mk-etiket) ve hücre türünü (data-mk-tur)
 * yazar. mobil.css bu bilgiyle 768px ve altındaki ekranlarda her satırı bir kart olarak çizer.
 * Masaüstü görünümü değişmez (stiller yalnızca mobil medya sorgusunda).
 *
 * Tablolar sık sık yeniden çizildiği için değişiklikler izlenir ve etiketler yeniden yazılır.
 * Yeni bir tabloyu karta çevirmek için TABLOLAR listesine eklemek yeterlidir.
 */
(function () {
    'use strict';

    // tablo id → kartın başlığı olacak sütunun sırası (0'dan başlar)
    const TABLOLAR = {
        'table-schedule': { baslik: 2 },          // Ders / Sınav
        'table-staff': { baslik: 0 },             // İsim Soyisim
        'table-ranking': { baslik: 1 },           // İsim Soyisim
        'table-ranking-non-exam': { baslik: 1 },  // İsim Soyisim
        'table-staff-stats': { baslik: 0 },       // Gözetmen
        'table-audit': { baslik: 2 }              // İşlem
    };

    const temizle = (s) => (s || '').replace(/[▲▼↑↓⇅⬆⬇]/g, '').replace(/\s+/g, ' ').trim();

    function etiketle(tablo, ayar) {
        // Sütun etiketleri (colspan'li başlıkları da sütun sayısına yayar)
        const etiketler = [];
        const baslikSatiri = tablo.querySelector('thead tr:last-child');
        if (!baslikSatiri) return;
        [...baslikSatiri.children].forEach(th => {
            for (let i = 0; i < (th.colSpan || 1); i++) etiketler.push(temizle(th.textContent));
        });

        tablo.classList.add('mk-kart');
        tablo.querySelectorAll('tbody tr').forEach(tr => {
            let sutun = 0;
            let grup = false;
            [...tr.children].forEach(td => {
                if ((td.colSpan || 1) > 1) {
                    // "1. YIL" gibi ara başlık satırları
                    grup = true;
                    td.dataset.mkTur = 'grup';
                } else {
                    const etiket = etiketler[sutun] || '';
                    const kucuk = etiket.toLocaleLowerCase('tr-TR');
                    td.dataset.mkEtiket = etiket;
                    td.dataset.mkTur = sutun === ayar.baslik ? 'baslik'
                        : (kucuk.includes('işlem') && sutun === etiketler.length - 1) ? 'islem'
                        : etiket ? 'alan' : 'bos';
                }
                sutun += td.colSpan || 1;
            });
            tr.classList.toggle('mk-grup', grup);
        });
    }

    function hepsiniEtiketle() {
        for (const id in TABLOLAR) {
            const t = document.getElementById(id);
            if (t) etiketle(t, TABLOLAR[id]);
        }
    }

    // Tablolar innerHTML ile yeniden çizildiğinde etiketleri tekrar yaz (kare başına en fazla bir kez)
    let bekliyor = false;
    function planla() {
        if (bekliyor) return;
        bekliyor = true;
        requestAnimationFrame(() => { bekliyor = false; hepsiniEtiketle(); });
    }

    function baslat() {
        hepsiniEtiketle();
        new MutationObserver(planla).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
    else baslat();
})();
