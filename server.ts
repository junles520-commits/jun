
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from the Angular app build output
// Assuming the output is in dist/browser (standard for Angular 17+)
// Or just dist/ (depending on angular.json)
// Let's check angular.json later, but usually it's dist/browser or dist/app
const distPath = path.join(__dirname, 'dist'); 
// Try to find where index.html is
// Usually dist/index.html or dist/browser/index.html

app.use(express.static(distPath));

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
app.get('*', (req, res) => {
    // Check if file exists in dist/browser/index.html or dist/index.html
    // For simplicity, let's assume standard build
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
