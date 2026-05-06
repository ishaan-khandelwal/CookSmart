const fs = require('fs');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const landingDir = path.join(rootDir, 'landing-page');
const distDir = path.join(rootDir, 'dist');
const appDir = path.join(distDir, 'app');
const port = Number(process.env.PORT || 3000);

const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
};

function sendFile(response, filePath) {
    fs.readFile(filePath, (error, data) => {
        if (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500);
            response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
            return;
        }

        response.writeHead(200, {
            'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
        });
        response.end(data);
    });
}

function safeJoin(baseDir, requestedPath) {
    const filePath = path.normalize(path.join(baseDir, requestedPath));
    return filePath.startsWith(baseDir) ? filePath : null;
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/app' || pathname.startsWith('/app/')) {
        sendFile(response, path.join(appDir, 'index.html'));
        return;
    }

    if (pathname.startsWith('/_expo/')) {
        const filePath = safeJoin(distDir, pathname.slice(1));
        sendFile(response, filePath || '');
        return;
    }

    if (pathname.startsWith('/assets/node_modules/') || pathname.startsWith('/assets/assets/')) {
        const filePath = safeJoin(distDir, pathname.slice(1));
        sendFile(response, filePath || '');
        return;
    }

    const landingPath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = safeJoin(landingDir, landingPath);
    sendFile(response, filePath || '');
});

server.listen(port, () => {
    console.log(`CookSmart preview running at http://localhost:${port}`);
});
