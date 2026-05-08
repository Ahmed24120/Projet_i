const http = require('http');

const data = JSON.stringify({
    prenom: "Jean",
    nom: "Valjean",
    email: "professor.test@supnum.mr",
    password: "password123",
    confirmPassword: "password123",
    role: "professor",
    secretCode: "PSN147"
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log('BODY:', responseBody);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
