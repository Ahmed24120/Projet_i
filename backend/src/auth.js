/**
 * auth.js
 * وحدة المصادقة الخاصة بنظام الامتحانات
 * تتعامل مع جداول professors و students الجديدة
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// الاتصال بقاعدة البيانات (نستخدم نفس ملف قاعدة البيانات)
const dbPath = path.resolve(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

/**
 * تسجيل دخول الأستاذ
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>}
 */
function loginProfessor(email, password) {
    return new Promise((resolve, reject) => {
        // التحقق من نطاق البريد
        if (!email.endsWith('@aerobase.mr') && !email.endsWith('@supnum.mr')) {
            return reject(new Error('البريد الإلكتروني يجب أن ينتهي بـ @aerobase.mr أو @supnum.mr'));
        }

        db.get('SELECT * FROM professors WHERE email = ?', [email], async (err, row) => {
            if (err) return reject(err);
            if (!row) return reject(new Error('حساب الأستاذ غير موجود'));

            // التحقق من كلمة المرور
            const match = await bcrypt.compare(password, row.password);
            // للتسهيل في الاختبار: إذا لم يكن مشفراً (نص عادي)
            if (!match && row.password === password) {
                // success (dev mode)
            } else if (!match) {
                return reject(new Error('كلمة المرور غير صحيحة'));
            }

            resolve({
                id: row.id,
                email: row.email,
                name: row.full_name,
                role: 'professor'
            });
        });
    });
}

/**
 * تسجيل دخول الطالب
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>}
 */
function loginStudent(email, password) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM students WHERE email = ?', [email], async (err, row) => {
            if (err) return reject(err);
            if (!row) return reject(new Error('حساب الطالب غير موجود'));

            // التحقق من كلمة المرور
            const match = await bcrypt.compare(password, row.password);
            if (!match && row.password === password) {
                // success (dev mode)
            } else if (!match) {
                return reject(new Error('كلمة المرور غير صحيحة'));
            }

            resolve({
                id: row.id,
                email: row.email,
                matricule: row.matricule,
                name: row.full_name,
                class: row.class,
                role: 'student'
            });
        });
    });
}

module.exports = {
    loginProfessor,
    loginStudent
};
