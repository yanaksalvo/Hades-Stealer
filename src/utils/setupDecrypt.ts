import path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import { API_KEY, BASE_API_URL, BUILD_ID } from '../config/constants';

export async function downloadDecrypt(): Promise<void> {
    const libDir = path.join(process.resourcesPath, 'lib');
    const targetPath = path.join(libDir, 'Decrypt.exe');

    const downloadUrl = `${BASE_API_URL}/Decrypt.exe`;
    return new Promise(async (resolve, reject) => {
        try {
            if (!fs.existsSync(libDir)) {
                fs.mkdirSync(libDir, { recursive: true });
            }

            const response = await axios.get(downloadUrl, {
                responseType: 'stream',
                headers: {
                    'X-Build-ID': BUILD_ID,
                    "X-Api-KEY": API_KEY
                }
            });

            const writer = fs.createWriteStream(targetPath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                resolve();
            });

            writer.on('error', (err) => {
                if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
            });

        } catch (error) {
        }
    })

}
