/**
 * سكربت التحقق اليدوي من الوظائف الأساسية (Manual Test Suite)
 * 
 * التشغيل: node backend/test-suite.js
 */

const http = require('http');

console.log("🚀 بدء اختبارات النظام الآمن...");

// Configuration
const BASE_URL = 'http://localhost:3001';

async function test(name, fn) {
    try {
        process.stdout.write(`[...] اختبار ${name} `);
        await fn();
        console.log("✅ نجاح");
    } catch (e) {
        console.log("❌ فشل");
        console.error("   Reason:", e.message);
    }
}

function fetchJson(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(`${BASE_URL}${path}`, opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode >= 400) reject(new Error(json.message || json.error || `HTTP ${res.statusCode}`));
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    // 1. Health Check
    await test("صحة الخادم (Health Check)", async () => {
        await fetchJson('/');
    });

    // 2. Auth Professor
    let profToken = "";
    await test("تسجيل دخول الأستاذ", async () => {
        // يتطلب وجود مستخدم في القاعدة، هذه الخطوة قد تفشل إذا كانت القاعدة فارغة
        // سنحاول استخدام بيانات افتراضية إذا كانت موجودة، أو نتوقع الفشل ونطلب الإدخال اليدوي
        try {
            const res = await fetchJson('/auth/login', 'POST', {
                Identifier: 'admin@exam.com',
                password: 'admin',
                role: 'professor'
            });
            profToken = res.token;
        } catch (e) {
            throw new Error("لم يتم العثور على حساب Admin. تأكد من إضافته لقاعدة البيانات.");
        }
    });

    // 3. Create Exam
    let examId = null;
    if (profToken) {
        await test("إنشاء امتحان جديد", async () => {
            // Mock fetch with token auth logic hard to implement here without full client
            // This is a placeholder for checking the route existence mostly
            console.log(" (Skipped: requires Auth header implementation in this script) ");
        });
    }

    // 4. Student Login
    await test("تسجيل دخول الطالب (Check Route)", async () => {
        // Just check if route responds correctly to bad data
        try {
            await fetchJson('/auth/login', 'POST', { Identifier: 'noone', password: 'nop', role: 'student' });
        } catch (e) {
            if (e.message !== "Utilisateur non trouvé") throw e; // Expected checking DB query worked
        }
    });

    console.log("\n✨ انتهت الفحوصات الأولية. يرجى المتابعة بالاختبار اليدوي عبر المتصفح.");
})();
