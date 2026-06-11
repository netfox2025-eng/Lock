const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());

// Multi-Source Proxy Failover
async function getProxy() {
    const providers = [
        'https://proxylist.geonode.com/api/proxy-list?limit=1&page=1&sort_by=lastChecked&sort_type=desc',
        'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all'
    ];

    for (const url of providers) {
        try {
            const res = await axios.get(url, { timeout: 5000 });
            if (url.includes('geonode')) {
                const p = res.data.data[0];
                return `${p.protocols[0]}://${p.ip}:${p.port}`;
            } else {
                const ips = res.data.split('\r\n');
                return `http://${ips[0]}`;
            }
        } catch (e) { continue; }
    }
    return null;
}

async function start() {
    const proxy = await getProxy();
    const browser = await puppeteer.launch({
        args: [
            proxy ? `--proxy-server=${proxy}` : '--no-sandbox',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'referer': 'https://www.google.com/' });
    
    try {
        console.log("Navigating to target...");
        await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for page to fully "humanize"
        await new Promise(r => setTimeout(r, 15000));
        
        // Dynamic Selectors for Shorteners
        const selectors = ['button#submit-button', '.get-link', 'a#btn-main', 'button[type="submit"]', '.btn-primary'];
        
        for (const sel of selectors) {
            if (await page.$(sel)) {
                console.log(`Target found: ${sel}. Clicking...`);
                await page.click(sel);
                await new Promise(r => setTimeout(r, 5000));
                break;
            }
        }
        console.log("Action completed.");
    } catch (e) {
        console.error("Critical Error:", e.message);
    } finally {
        await browser.close();
    }
}

start();

