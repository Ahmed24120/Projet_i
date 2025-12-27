/**
 * network.js
 * وحدة للتحقق من الشبكة المحلية وكشف التغييرات المشبوهة
 */

// نطاق الشبكة المحلية المسموح به (مثال: 192.168.1.0/24)
const LOCAL_SUBNET_PREFIX = '192.168.1.';

/**
 * التحقق مما إذا كان عنوان IP ينتمي للشبكة المحلية
 * @param {string} ip - عنوان IP للطالب
 * @returns {boolean}
 */
function isLocalNetwork(ip) {
    if (!ip) return false;

    // تنظيف العنوان في حالة IPv6 mapped IPv4 (e.g., ::ffff:192.168.1.50)
    const cleanIp = ip.replace('::ffff:', '');

    // للبيئة المحلية (localhost)
    if (cleanIp === '127.0.0.1' || cleanIp === '::1') {
        return true;
    }

    // التحقق من البادئة
    return cleanIp.startsWith(LOCAL_SUBNET_PREFIX);
}

/**
 * كشف تغيير الشبكة (الغش المحتمل)
 * @param {string} oldIp - IP القديم المسجل
 * @param {string} newIp - IP الجديد الحالي
 * @returns {boolean} - true إذا تغيرت الشبكة بشكل مشبوه
 */
function hasNetworkChanged(oldIp, newIp) {
    if (!oldIp || !newIp) return false;
    const cleanOld = oldIp.replace('::ffff:', '');
    const cleanNew = newIp.replace('::ffff:', '');
    return cleanOld !== cleanNew;
}

module.exports = {
    isLocalNetwork,
    hasNetworkChanged
};
