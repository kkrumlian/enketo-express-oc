const puppeteer = require('puppeteer');
const config = require('../models/config-model').server;

const { timeout } = config.headless;

const args = ['--no-startup-window'];
const userDataDir = './chromium-cache';

const launchBrowser = puppeteer.launch({
    headless: true,
    devtools: false,
    args,
    userDataDir,
});

async function run(url) {
    if (!url) {
        throw new Error('No url provided');
    }
    const browser = await launchBrowser;
    const page = await browser.newPage();

    // Turns request interceptor on
    await page.setRequestInterception(true);

    // Ignore certain resources
    const ignoreTypes = ['image', 'stylesheet', 'media', 'font'];
    page.on('request', (request) => {
        if (ignoreTypes.includes(request.resourceType())) {
            request.abort();
        } else {
            request.continue();
        }
    });

    let fieldsubmissions;

    try {
        page.on('pageerror', (e) => {
            // Martijn has not been able to actually reach this code.
            e.status = 400;
            throw e;
        });

        page.on('requestfailed', (e) => {
            // Martijn has not been able to actually reach this code.
            e.status = 400;
            throw e;
        });

        await page.goto(url).catch((e) => {
            // Martijn has not been able to actually reach this code.
            e.status = 400;
            throw e;
        });

        const element = await page
            .waitForSelector('#headless-result', { timeout })
            .catch((e) => {
                e.status = /timeout/i.test(e.message) ? 408 : 400;
                throw e;
            });

        const errorEl = await element.$('#error');
        // Load or submission errors caught by Enketo
        if (errorEl) {
            const msg = await errorEl.getProperty('textContent');
            const error = new Error(await msg.jsonValue());
            error.status = 400;
            throw error;
        }

        const fsEl = await element.$('#fieldsubmissions');
        if (fsEl) {
            const fs = await fsEl.getProperty('textContent');
            fieldsubmissions = Number(await fs.jsonValue());
        }
    } catch (e) {
        e.status = e.status || 400;
        await page.close();
        throw e;
    }

    await page.close();

    return fieldsubmissions;
}

module.exports = { run };
