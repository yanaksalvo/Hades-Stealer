import { AfterPackContext } from 'electron-builder';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export default async function (context: AfterPackContext): Promise<void> {
    const { appOutDir } = context;

    const asarPath: string = path.join(
        appOutDir,
        process.platform === 'darwin' ? 'Contents/Resources' : 'resources',
        'app.asar'
    );

    if (fs.existsSync(asarPath)) {

        const key: Buffer = Buffer.from('f7e2d4b6c8a0f1e3d5c7b9a1f2e4d6c8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d2', 'hex');
        const iv: Buffer = Buffer.from('b1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', 'hex');

        if (key.length !== 32 || iv.length !== 16) {
            return;
        }

        const originalData: Buffer = fs.readFileSync(asarPath);

        const cipher: crypto.Cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const encryptedData: Buffer = Buffer.concat([
            cipher.update(originalData),
            cipher.final()
        ]);

        fs.writeFileSync(asarPath, encryptedData);

    } else {
    }
}