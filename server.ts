
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { processFeishuMessage } from './feishu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Debug Logging Setup ---
const debugLogs: string[] = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    const msg = `[LOG] ${new Date().toISOString()} - ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
    debugLogs.push(msg);
    if (debugLogs.length > 100) debugLogs.shift();
    originalLog(...args);
};

console.error = (...args) => {
    const msg = `[ERR] ${new Date().toISOString()} - ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
    debugLogs.push(msg);
    if (debugLogs.length > 100) debugLogs.shift();
    originalError(...args);
};
// ---------------------------

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/debug/logs', (req, res) => {
    res.json({ logs: debugLogs });
});

const FEISHU_ENCRYPT_KEY = 'V2eJJgYLXczBo8pMpp2DOgbc8bD48JwO';
const FEISHU_VERIFICATION_TOKEN = 'qGnwuBCEP9pDXygLpMz7bYtbuAvrORPT';

class FeishuCrypto {
    private key: Buffer;
    private iv: Buffer;

    constructor(encryptKey: string) {
        const hash = crypto.createHash('sha256');
        hash.update(encryptKey);
        this.key = hash.digest();
        this.iv = this.key.slice(0, 16);
    }

    decrypt(encrypt: string): string {
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
        let decrypted = decipher.update(encrypt, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

const feishuCrypto = new FeishuCrypto(FEISHU_ENCRYPT_KEY);

// Feishu Webhook Endpoint
app.post('/feishu/webhook', (req, res) => {
    let body = req.body;
    console.log('--- Incoming Feishu Webhook ---');
    
    // Decrypt if encrypted
    if (body.encrypt) {
        try {
            const decryptedStr = feishuCrypto.decrypt(body.encrypt);
            body = JSON.parse(decryptedStr);
            console.log('Decrypted body type:', body.type || body.header?.event_type);
        } catch (error) {
            console.error('Feishu decryption failed:', error);
            res.status(400).send('Decryption failed');
            return;
        }
    } else {
        console.log('Unencrypted body type:', body.type || body.header?.event_type);
    }

    // Verify token (token can be in body.token or body.header.token)
    const token = body.token || body.header?.token;
    if (token && token !== FEISHU_VERIFICATION_TOKEN) {
        console.error(`Invalid verification token. Expected ${FEISHU_VERIFICATION_TOKEN}, got ${token}`);
        res.status(403).send('Invalid token');
        return;
    }
    
    // URL Verification
    if (body.type === 'url_verification') {
        console.log('Handling url_verification challenge');
        res.json({ challenge: body.challenge });
        return;
    }
    
    // Handle message
    if (body.header && body.header.event_type === 'im.message.receive_v1') {
        const event = body.event;
        const message = event.message;
        
        console.log('Received message type:', message.message_type);
        
        if (message.message_type === 'text') {
            const content = JSON.parse(message.content);
            const text = content.text.trim();
            console.log('Message text:', text);
            
            // Acknowledge immediately
            res.status(200).send();
            
            // Process message asynchronously
            processFeishuMessage(text, message.message_id).catch(err => {
                console.error('Error processing message:', err);
            });
            return;
        }
    }
    
    res.status(200).send();
});

// Serve static files from the Angular app build output
// Assuming the output is in dist/browser (standard for Angular 17+)
// Or just dist/ (depending on angular.json)
// Let's check angular.json later, but usually it's dist/browser or dist/app
const distPath = path.join(__dirname, 'dist'); 
// Try to find where index.html is
// Usually dist/index.html or dist/browser/index.html

// Proxy for List API
app.use('/api', createProxyMiddleware({
    target: 'https://push2.eastmoney.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '/api' // Keep /api prefix or rewrite? 
        // In proxy.conf.json: "^/api": "/api" means keep it.
        // But target is push2.eastmoney.com.
        // If request is /api/qt/ulist.get, it goes to https://push2.eastmoney.com/api/qt/ulist.get
        // This is correct.
    },
    headers: {
        'Referer': 'https://eastmoney.com',
        'Host': 'push2.eastmoney.com'
    }
}));

// Proxy for History API
app.use('/his_api', createProxyMiddleware({
    target: 'https://push2his.eastmoney.com',
    changeOrigin: true,
    pathRewrite: {
        '^/his_api': '/api' // Rewrite /his_api to /api
        // If request is /his_api/qt/stock/kline/get, it goes to https://push2his.eastmoney.com/api/qt/stock/kline/get
    },
    headers: {
        'Referer': 'https://eastmoney.com',
        'Host': 'push2his.eastmoney.com'
    }
}));

// Proxy for Alpha Vantage API
app.use('/alpha_api', createProxyMiddleware({
    target: 'https://www.alphavantage.co',
    changeOrigin: true,
    pathRewrite: {
        '^/alpha_api': '/' 
    }
}));

// Proxy for Finnhub API
app.use('/finnhub_api', createProxyMiddleware({
    target: 'https://finnhub.io',
    changeOrigin: true,
    pathRewrite: {
        '^/finnhub_api': '/api/v1' 
    },
    headers: {
      "X-Finnhub-Token": "d6g0kfpr01qqnmbqalf0d6g0kfpr01qqnmbqalfg"
    }
}));

// Fallback to index.html for Angular routing
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
    // In development mode, proxy all other requests to the Angular dev server
    app.use(createProxyMiddleware({
        target: 'http://localhost:4200',
        changeOrigin: true,
        ws: true
    }));
} else {
    // In production mode, serve static files
    const distPath = path.join(__dirname, 'dist'); 
    app.use(express.static(distPath));
    app.get('*catchall', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
