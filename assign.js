const fs = require('fs');
const path = require('path');

const KATSAYILAR = {
    HAFTA_ICI_MESAI: 1.0,
    HAFTA_ICI_AKSAM: 1.5,
    HAFTA_SONU_GUNDUZ: 2.0,
    HAFTA_SONU_AKSAM: 2.5
};

const BONUSLAR = {
    ERKEN_KUS: 0.2,
    DINAMIK_IHTIYAC: 0.5
};

const PROCTOR_CONSTRAINTS = {
    "Aysel Şahin": [{ day: 2, start: "08:30", end: "17:30" }],
    "Muhammed Ergen": [{ day: 4, start: "12:00", end: "17:30" }],
    "Saliha Demirbüken": [
        { day: 1, start: "17:30", end: "23:59" },
        { day: 2, start: "17:30", end: "23:59" },
        { day: 3, start: "17:30", end: "23:59" },
        { day: 4, start: "17:30", end: "23:59" },
        { day: 5, start: "17:30", end: "23:59" }
    ],
    "Çağla Özatar": [
        { day: 1, start: "17:30", end: "23:59" },
        { day: 2, start: "17:30", end: "23:59" },
        { day: 3, start: "17:30", end: "23:59" },
        { day: 4, start: "17:30", end: "23:59" },
        { day: 5, start: "17:30", end: "23:59" }
    ],
    "Oğuzhan Selçuk": [
        { day: 1, start: "08:30", end: "13:30" },
        { day: 4, start: "12:30", end: "15:30" },
        { day: 5, start: "08:30", end: "13:30" }
    ],
    "Cansu Şahin": [
        { day: 1, start: "13:30", end: "16:20" },
        { day: 3, start: "13:30", end: "16:20" },
        { day: 4, start: "11:30", end: "14:30" }
    ],
    "Ezgi Öztekin": [
        { day: 1, start: "08:30", end: "17:30" },
        { day: 4, start: "08:30", end: "17:30" }
    ],
    "Serdal Çömlekçi": [
        { day: 1, start: "16:00", end: "17:30" },
        { day: 2, start: "10:00", end: "12:00" },
        { day: 4, start: "13:30", end: "15:20" },
        { day: 5, start: "10:00", end: "11:00" },
        { date: "05-13", start: "08:30", end: "17:30" },
        { date: "05-14", start: "08:30", end: "17:30" }
    ]
};

let staff = [
    { id: 1, name: "Oğuzhan Selçuk", currentScore: 1200, count: 0 },
    { id: 2, name: "Ezgi Öztekin", currentScore: 1200, count: 0 },
    { id: 3, name: "Serdal Çömlekçi", currentScore: 0, count: 0 },
    { id: 4, name: "Aslıhan Gür", currentScore: 1200, count: 0 },
    { id: 5, name: "Şeyma Yaşar", currentScore: 1320, count: 0 },
    { id: 6, name: "Saliha Demirbüken", currentScore: 1200, count: 0 },
    { id: 7, name: "Serkan Ayrıca", currentScore: 1440, count: 0 },
    { id: 9, name: "Muhammed Ergen", currentScore: 1320, count: 0 },
    { id: 10, name: "Ömer Demir", currentScore: 1440, count: 0 },
    { id: 11, name: "Aysel Şahin", currentScore: 1440, count: 0 },
    { id: 12, name: "Yasin Turan", currentScore: 1800, count: 0 },
    { id: 13, name: "Çağla Özatar", currentScore: 1560, count: 0 },
    { id: 14, name: "Cansu Şahin", currentScore: 1200, count: 0 }
];

function calculateScore(dateStr, timeStr, duration, examId = null) {
    duration = parseFloat(duration) || 60;
    const date = new Date(`${dateStr}T${timeStr}`);
    const day = date.getDay();
    const isWeekend = (day === 0 || day === 6);
    
    const ktsDay = isWeekend ? KATSAYILAR.HAFTA_SONU_GUNDUZ : KATSAYILAR.HAFTA_ICI_MESAI;
    const ktsNight = isWeekend ? KATSAYILAR.HAFTA_SONU_AKSAM : KATSAYILAR.HAFTA_ICI_AKSAM; 

    const m830 = 8.5 * 60; 
    const m1000 = 10.0 * 60; 
    const m1700 = 17.0 * 60; 
    
    const startMins = date.getHours() * 60 + date.getMinutes();
    const endMins = startMins + duration;
    
    function getOverlap(s, e, pStart, pEnd) {
        return Math.max(0, Math.min(e, pEnd) - Math.max(s, pStart));
    }
    
    let totalScore = 0;
    totalScore += getOverlap(startMins, endMins, 0, m830) * (ktsNight + BONUSLAR.ERKEN_KUS);
    totalScore += getOverlap(startMins, endMins, m830, m1000) * (ktsDay + BONUSLAR.ERKEN_KUS);
    totalScore += getOverlap(startMins, endMins, m1000, m1700) * (ktsDay);
    
    let eveningScore = 0;
    const evStart = Math.max(startMins, m1700);
    const evEnd = Math.min(endMins, 1440);
    
    if (evEnd > evStart) {
        for (let h = 17; h < 24; h++) {
            const hStart = h * 60;
            const hEnd = (h + 1) * 60;
            const overlap = getOverlap(evStart, evEnd, hStart, hEnd);
            if (overlap > 0) {
                const progressiveBonus = (h - 17) * 0.15;
                eveningScore += overlap * (ktsNight + progressiveBonus);
            }
        }
    }
    totalScore += eveningScore;
    return parseFloat(totalScore.toFixed(2));
}

function getKatsayi(dateStr, timeStr, duration = 0) {
    const score = calculateScore(dateStr, timeStr, duration || 60);
    return parseFloat((score / (duration || 60)).toFixed(3));
}
function timeToMins(timeStr) {
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}
function normalizeStaffName(name) {
    return (name || '')
        .replace(/Prof\.\s*Dr\./gi, '')
        .replace(/Doç\.\s*Dr\./gi, '')
        .replace(/Dr\.\s*Öğr\.\s*Üyesi/gi, '')
        .replace(/Arş\.\s*Gör\./gi, '')
        .replace(/Dr\./gi, '')
        .replace(/Öğr\.Gör\./gi, '')
        .trim()
        .toLocaleLowerCase('tr')
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u')
        .replace(/\s+/g, ' ');
}

function getConstraints(staffName) {
    if (PROCTOR_CONSTRAINTS[staffName]) return PROCTOR_CONSTRAINTS[staffName];
    const target = normalizeStaffName(staffName);
    for (const key of Object.keys(PROCTOR_CONSTRAINTS)) {
        if (normalizeStaffName(key) === target) {
            return PROCTOR_CONSTRAINTS[key] || [];
        }
    }
    return [];
}

function isAvailable(staffName, dateStr, timeStr, duration) {
    const constraints = getConstraints(staffName);
    if (!constraints || constraints.length === 0) return true;
    if (!dateStr || !timeStr) return true;

    const parts = String(dateStr).split('-');
    if (parts.length < 3) return true;
    const examYear = parseInt(parts[0], 10);
    const examMonth = parseInt(parts[1], 10);
    const examDay = parseInt(parts[2], 10);
    const examDate = new Date(examYear, examMonth - 1, examDay);
    const dayOfWeek = examDate.getDay();
    const mm = String(examMonth).padStart(2, '0');
    const dd = String(examDay).padStart(2, '0');
    const matchDateStr = `${mm}-${dd}`;
    const isoDateStr = `${examYear}-${mm}-${dd}`;

    const examStart = timeToMins(timeStr);
    const examEnd = examStart + (parseInt(duration, 10) || 60);

    for (const c of constraints) {
        let isDayMatch = (c.day !== undefined && parseInt(c.day, 10) === dayOfWeek);
        let isDateMatch = false;
        if (c.date) {
            const cDateStr = String(c.date).trim();
            if (cDateStr === isoDateStr || cDateStr === matchDateStr || cDateStr === String(dateStr).trim()) {
                isDateMatch = true;
            } else if (cDateStr.length === 5 && matchDateStr === cDateStr) {
                isDateMatch = true;
            } else if (cDateStr.length === 10 && isoDateStr === cDateStr) {
                isDateMatch = true;
            }
        }

        let isDaterangeMatch = false;
        if (c.startDate && c.endDate) {
            const startParts = String(c.startDate).split('-');
            const endParts = String(c.endDate).split('-');
            if (startParts.length === 3 && endParts.length === 3) {
                const startD = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10), 0, 0, 0);
                const endD = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10), 23, 59, 59, 999);
                if (examDate >= startD && examDate <= endD) {
                    isDaterangeMatch = true;
                }
            } else if (String(dateStr).trim() >= String(c.startDate).trim() && String(dateStr).trim() <= String(c.endDate).trim()) {
                isDaterangeMatch = true;
            }
        }
        
        if (isDayMatch || isDateMatch || isDaterangeMatch) {
            const isAllDay = c.allDay || (!c.start && !c.end) || 
                (c.start === "00:00" && (c.end === "23:59" || c.end === "24:00" || c.end === "23:30"));

            if (isAllDay) return false;

            const constraintStart = c.start ? timeToMins(c.start) : 0;
            const constraintEnd = c.end ? timeToMins(c.end) : 1440;
            if (examStart < constraintEnd && examEnd > constraintStart) {
                return false; 
            }
        }
    }
    return true;
}

const exams = [
        { name: "INF 101 - Introduction to Computing", date: "2026-04-18", time: "11:00", duration: 90, location: "-", num: 3 },
        { name: "MATH 112 - Analysis II", date: "2026-04-06", time: "17:30", duration: 120, location: "73 - /D1/D3/D4", num: 2 },
        { name: "MATH 114 - Linear Algebra II", date: "2026-04-09", time: "13:30", duration: 120, location: "78 - Amfi 2/D1", num: 2 },
        { name: "MATH 106 - Analytical Geometry", date: "2026-04-16", time: "18:00", duration: 90, location: "118-/D1/D3/D5/D9", num: 3 },
        { name: "TUR 102 - Turkish II", date: "2026-04-17", time: "18:00", duration: 60, location: "-", num: 3 },
        { name: "PHYS 114 - Physics for Natural Sciences II", date: "2026-03-27", time: "18:00", duration: 90, location: "-", num: 2 },
        { name: "PHYS 114 - Physics for Natural Sciences II (II. Vize)", date: "2026-05-08", time: "18:00", duration: 90, location: "II. Vize", num: 2 },
        { name: "MATH 204 - Differential Equations II", date: "2026-03-25", time: "13:30", duration: 180, location: "55/ Amfi 2", num: 2 },
        { name: "MATH 204 - Differential Equations II (II. Vize)", date: "2026-05-06", time: "13:30", duration: 180, location: "55/ Amfi 2 (II. Vize)", num: 2 },
        { name: "MATH 206 - Topology", date: "2026-04-15", time: "17:00", duration: 120, location: "77-/D1/D3/D5", num: 3 },
        { name: "MATH 210 - Algebra II", date: "2026-04-13", time: "13:30", duration: 120, location: "50- Amfi2", num: 2 },
        { name: "MATH 212 - Analysis IV", date: "2026-04-14", time: "11:00", duration: 120, location: "50- Amfi2", num: 2 },
        { name: "HIS 102 - Atatürk İlkeleri ve İnkılap Tarihi II", date: "2026-04-17", time: "19:00", duration: 60, location: "-", num: 3 },
        { name: "MATH 302 - Complex Analysis II", date: "2026-04-15", time: "09:30", duration: 60, location: "12- D1", num: 1 },
        { name: "MATH 304 - Real Analysis II", date: "2026-03-30", time: "16:30", duration: 120, location: "51-D1/D3", num: 2 },
        { name: "MATH 308 - Probability Theory", date: "2025-04-08", time: "13:30", duration: 60, location: "52 -Amfi 2", num: 2 },
        { name: "MATH 311 - Numerical Analysis II", date: "2026-04-16", time: "09:30", duration: 120, location: "8-D1", num: 1 },
        { name: "ENG 112 - Academic English", date: "2026-04-18", time: "14:00", duration: 60, location: "-", num: 3 },
        { name: "MATH 446 - Quasilinearization Methods", date: "2026-03-23", time: "09:30", duration: 180, location: "44 -D3/ D1", num: 2 },
        { name: "MATH 446 - Quasilinearization Methods (II. Vize)", date: "2026-05-04", time: "09:30", duration: 180, location: "44 -D3/ D1(II. Vize)", num: 2 },
        { name: "MATH 438 - Graph Theory and Combinatorics", date: "2026-04-13", time: "13:30", duration: 120, location: "22 -D3", num: 1 },
        { name: "MATH 434 - Boundary Value Problems", date: "2026-04-14", time: "09:30", duration: 110, location: "29 -D3", num: 2 },
        { name: "MATH 452 - History of Mathematics", date: "2025-04-08", time: "09:30", duration: 60, location: "52 -", num: 1 },
        { name: "MATH 419 - Introduction to Coding Theory", date: "2026-04-14", time: "13:30", duration: 120, location: "37 - D3", num: 1 },
        { name: "MATH 407 - Differential Geometry", date: "2026-03-25", time: "13:30", duration: 180, location: "16- D3", num: 1 },
        { name: "MATH 407 - Differential Geometry (II. Vize)", date: "2026-05-06", time: "13:30", duration: 180, location: "16- D3 (II. Vize)", num: 1 },
        { name: "MATH 435 - Applied Partial Diff. Equations", date: "2026-04-09", time: "10:00", duration: 120, location: "12 -D3", num: 1 },
        { name: "MATH 449 - Number Theory", date: "2026-04-13", time: "17:00", duration: 90, location: "29-D3", num: 1 },
        { name: "MATH 411 - Introduction to Data Analysis", date: "2026-04-17", time: "10:00", duration: 120, location: "21 -D3", num: 1 }
];

exams.forEach(e => { e.score = calculateScore(e.date, e.time, e.duration); e.proctors = []; });
exams.sort((a,b) => b.score - a.score);

for (let e of exams) {
    for (let i=0; i<e.num; i++) {
        let available = staff.filter(s => s.count < 7 && isAvailable(s.name, e.date, e.time, e.duration) && !e.proctors.includes(s.name));
        available.sort((a,b) => {
            if (a.count < 3 && b.count >= 3) return -1;
            if (b.count < 3 && a.count >= 3) return 1;
            return a.currentScore - b.currentScore;
        });

        if (available.length > 0) {
            let chosen = available[0];
            e.proctors.push(chosen.name);
            chosen.count++;
            chosen.currentScore += e.score;
        }
    }
}

const origNames = [
        "INF 101 - Introduction to Computing", "MATH 112 - Analysis II", "MATH 114 - Linear Algebra II", "MATH 106 - Analytical Geometry",
        "TUR 102 - Turkish II", "PHYS 114 - Physics for Natural Sciences II", "PHYS 114 - Physics for Natural Sciences II (II. Vize)",
        "MATH 204 - Differential Equations II", "MATH 204 - Differential Equations II (II. Vize)", "MATH 206 - Topology", "MATH 210 - Algebra Algebra II",
        "MATH 212 - Analysis Analysis IV", "HIS 102 - Atatürk İlkeleri ve İnkılap Tarihi II", "MATH 302 - Complex Analysis II", "MATH 304 - Real Analysis II",
        "MATH 308 - Probability Theory", "MATH 311 - Numerical Analysis II", "ENG 112 - Academic English", "MATH 446 - Quasilinearization Methods",
        "MATH 446 - Quasilinearization Methods (II. Vize)", "MATH 438 - Graph Theory and Combinatorics", "MATH 434 - Boundary Value Problems",
        "MATH 452 - History of Mathematics", "MATH 419 - Introduction to Coding Theory", "MATH 407 - Differential Geometry",
        "MATH 407 - Differential Geometry (II. Vize)", "MATH 435 - Applied Partial Diff. Equations", "MATH 449 - Number Theory", "MATH 411 - Introduction to Data Analysis"
];

let res = [];
for(let orig of origNames) {
   let found = exams.find(x => x.name.includes(orig.replace("Algebra Algebra II", "Algebra II").replace("Analysis Analysis IV", "Analysis IV")));
   if(found) {
       res.push(`        { name: "${found.name}", date: "${found.date}", time: "${found.time}", duration: ${found.duration}, location: "${found.location}", proctors: ${JSON.stringify(found.proctors)} }`);
   }
}

const outputPath = path.join(__dirname, 'new_assignments.txt');
fs.writeFileSync(outputPath, res.join(',\n'), 'utf8');
console.log(`Assignments written to ${outputPath}`);
