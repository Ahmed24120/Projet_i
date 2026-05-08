const http = require('http');

function request(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    const ts = Date.now();

    // 1. Create Prof A
    console.log("Creating Prof A...");
    const profA = await request('/auth/register', 'POST', {
        prenom: "Prof", nom: "A", email: `profA_${ts}@test.com`, password: "pass", role: "professor", secretCode: "PSN147"
    });
    const tokenA = profA.body.token;

    // 2. Create Prof B
    console.log("Creating Prof B...");
    const profB = await request('/auth/register', 'POST', {
        prenom: "Prof", nom: "B", email: `profB_${ts}@test.com`, password: "pass", role: "professor", secretCode: "PSN147"
    });
    const tokenB = profB.body.token;

    // 3. Prof A Creates Exam
    console.log("Prof A Creating Exam...");
    const exam = await request('/exams', 'POST', {
        titre: `Exam A ${ts}`, description: "Test"
    }, tokenA);
    console.log("Exam Created:", exam.body);

    if (exam.status !== 200) {
        console.error("Failed to create exam", exam.body);
        return;
    }

    // 4. Prof B Lists Exams
    console.log("Prof B Listing Exams...");
    const listB = await request('/exams', 'GET', null, tokenB);
    const foundB = listB.body.find(e => e.titre === `Exam A ${ts}`);

    if (foundB) {
        console.error("❌ FAILURE: Prof B can see Prof A's exam!");
    } else {
        console.log("✅ SUCCESS: Prof B cannot see Prof A's exam.");
    }

    // 5. Prof A Lists Exams
    console.log("Prof A Listing Exams...");
    const listA = await request('/exams', 'GET', null, tokenA);
    const foundA = listA.body.find(e => e.titre === `Exam A ${ts}`);

    if (foundA) {
        console.log("✅ SUCCESS: Prof A can see their own exam.");
    } else {
        console.error("❌ FAILURE: Prof A cannot see their own exam!");
    }

})();
