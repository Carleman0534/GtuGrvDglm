/**
 * Personel Şifre Doğrulama ve Güvenlik Testleri
 *
 * Özel şifre belirlendiğinde eski ve varsayılan şifrelerin (örn: muhammed123)
 * kesinlikle devre dışı bırakıldığını ve sadece güncel şifrenin çalıştığını doğrular.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createPasswordTestContext() {
    const sandbox = {
        window: {},
        document: {
            getElementById: () => null,
            addEventListener: () => {}
        },
        console
    };
    sandbox.window = sandbox;

    const appCode = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    // Sadece getDefaultStaffPassword ve isStaffPasswordMatch bölümlerini güvenle yükle
    vm.createContext(sandbox);
    
    const lines = appCode.split('\n');
    const snippet = lines.slice(60, 101).join('\n');
    vm.runInContext(snippet, sandbox);

    return sandbox;
}

test('getDefaultStaffPassword: Türkçe karakterler ve unvanlar doğru temizlenir', () => {
    const ctx = createPasswordTestContext();
    const getDefault = ctx.getDefaultStaffPassword;

    assert.equal(getDefault('Muhammed Ergen'), 'muhammed123');
    assert.equal(getDefault('Yasin Turan'), 'yasin123');
    assert.equal(getDefault('Çağla Cansın Çetinkaya'), 'cagla123');
    assert.equal(getDefault('Ömer Faruk'), 'omer123');
    assert.equal(getDefault('Şeyma Şen'), 'seyma123');
    assert.equal(getDefault('Arş. Gör. Dr. Pelin Ayşe GÖKGÖZ'), 'pelin123');
});

test('isStaffPasswordMatch: Özel şifre belirleyen personelde (Muhammed Ergen) eski ve varsayılan şifre KESİNLİKLE reddedilir', () => {
    const ctx = createPasswordTestContext();
    const match = ctx.isStaffPasswordMatch;

    const staffWithCustom = {
        id: 9,
        name: 'Muhammed Ergen',
        staffPassword: '31415'
    };

    // Güncel özel şifre ile giriş başarılı olmalı
    assert.equal(match(staffWithCustom, '31415'), true, 'Güncel özel şifre kabul edilmeli');
    assert.equal(match(staffWithCustom, ' 31415 '), true, 'Boşluklu girilen şifre trim edilip kabul edilmeli');

    // Eski/varsayılan şifreler KESİNLİKLE reddedilmeli
    assert.equal(match(staffWithCustom, 'muhammed123'), false, 'Varsayılan muhammed123 şifresi KESİNLİKLE kabul edilmemeli');
    assert.equal(match(staffWithCustom, 'MUHAMMED123'), false, 'Büyük harfli varsayılan şifre reddedilmeli');
    assert.equal(match(staffWithCustom, 'wrongpassword'), false, 'Yanlış şifre reddedilmeli');
    assert.equal(match(staffWithCustom, ''), false, 'Boş şifre reddedilmeli');
});

test('isStaffPasswordMatch: Özel şifre belirlememiş personelde varsayılan ve geçiş dönemi şifreleri çalışır', () => {
    const ctx = createPasswordTestContext();
    const match = ctx.isStaffPasswordMatch;

    // Şifre değiştirmemiş normal personel
    const defaultStaff = {
        id: 15,
        name: 'Ezgi Öztekin'
    };

    assert.equal(match(defaultStaff, 'ezgi123'), true, 'Varsayılan ezgi123 kabul edilmeli');
    assert.equal(match(defaultStaff, 'EZGI123'), true, 'Büyük harf duyarsız kabul edilmeli');
    assert.equal(match(defaultStaff, 'wrong'), false, 'Yanlış şifre reddedilmeli');

    // Geçiş dönemi eski şifresi olan personel (ID 12)
    const transitionStaff = {
        id: 12,
        name: 'Yasin Turan'
    };
    assert.equal(match(transitionStaff, 'yasin123'), true, 'Varsayılan yasin123 kabul edilmeli');
    assert.equal(match(transitionStaff, '147258369'), true, 'Geçiş dönemi eski şifresi kabul edilmeli');
    assert.equal(match(transitionStaff, 'wrong'), false, 'Yanlış şifre reddedilmeli');
});

test('isStaffPasswordMatch: Özel şifre sıfırlandığında (varsayılana dönüş) tekrar standart şifre geçerli olur', () => {
    const ctx = createPasswordTestContext();
    const match = ctx.isStaffPasswordMatch;

    const staff = {
        id: 9,
        name: 'Muhammed Ergen',
        staffPassword: '31415'
    };

    assert.equal(match(staff, '31415'), true);
    assert.equal(match(staff, 'muhammed123'), false);

    // Kullanıcı varsayılana döndü
    delete staff.staffPassword;
    delete staff.passwordHash;

    assert.equal(match(staff, 'muhammed123'), true, 'Sıfırlandıktan sonra muhammed123 kabul edilmeli');
    assert.equal(match(staff, '31415'), false, 'Eski özel şifre artık çalışmamalı');
});
