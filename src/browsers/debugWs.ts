import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { killBrowsersSync } from '../utils/process';
import { sendGenericMessage } from '../api/sender';

export async function getCookiesFromDebugPort(port?: number, timeoutMs = 8000, userDataPath?: string): Promise<any[]> {
    killBrowsersSync();
    const tryPort = (p: number) => {
        return new Promise<any[]>((resolve) => {
            const url = `http://127.0.0.1:${p}/json`;

            const handleWsUrl = (wsUrl: string | undefined) => {
                if (!wsUrl) return resolve([]);
                const ws = new WebSocket(wsUrl);
                const to = setTimeout(() => {
                    try { ws.terminate(); } catch (e) { }
                    resolve([]);
                }, timeoutMs);

                ws.on('open', () => {
                    ws.send(JSON.stringify({ id: 1, method: 'Network.enable', params: {} }));
                    ws.send(JSON.stringify({ id: 2, method: 'Network.getAllCookies', params: {} }));
                });

                ws.on('message', (msg) => {
                    try {
                        const res = JSON.parse(msg.toString());
                        if (res.id === 2 && res.result && Array.isArray(res.result.cookies)) {
                            clearTimeout(to);
                            const cookies = res.result.cookies;
                            try { ws.close(); } catch (e) { }
                            return resolve(cookies);
                        }
                    } catch (e) {
                    }
                });

                ws.on('error', (err) => {
                    clearTimeout(to);
                    try { ws.terminate(); } catch (e) { }
                    resolve([]);
                });
            };

            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const targets = JSON.parse(data);
                        const pageTarget = (Array.isArray(targets) && (targets.find((t: any) => t.webSocketDebuggerUrl && (t.type === 'page' || t.type === 'other')) || targets[0]));
                        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                            return handleWsUrl(pageTarget.webSocketDebuggerUrl);
                        }
                    } catch (e) {
                    }

                    const vurl = `http://127.0.0.1:${p}/json/version`;
                    http.get(vurl, (vres) => {
                        let vdata = '';
                        vres.on('data', (chunk) => vdata += chunk);
                        vres.on('end', () => {
                            try {
                                const versionInfo = JSON.parse(vdata);
                                const wsUrl = versionInfo.webSocketDebuggerUrl;
                                return handleWsUrl(wsUrl);
                            } catch (e) {
                                return resolve([]);
                            }
                        });
                    }).on('error', (err) => { resolve([]); });
                });
            }).on('error', (err) => {
                if ((err as any)?.code === 'ECONNREFUSED' && userDataPath) {
                    const pf86 = process.env['ProgramFiles(x86)'] || '';
                    const pf = process.env['ProgramFiles'] || '';
                    const la = process.env['LocalAppData'] || '';
                    const candidates = [
                        path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
                        path.join(pf, 'Microsoft/Edge/Application/msedge.exe'),
                        path.join(la, 'Microsoft/Edge/Application/msedge.exe'),
                        path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
                        path.join(pf, 'Google/Chrome/Application/chrome.exe'),
                        path.join(la, 'Google/Chrome/Application/chrome.exe')
                    ];

                    let exe: string | null = null;
                    for (const c of candidates) {
                        try { if (fs.existsSync(c)) { exe = c; break; } } catch { }
                    }

                    if (exe) {
                        try {
                            const procName = path.basename(exe);
                            try { execSync(`taskkill /F /IM ${procName} /T`, { stdio: 'ignore' }); } catch { }
                            const args = [
                                `--remote-debugging-port=${p}`,
                                `--user-data-dir=${userDataPath}`,
                                '--no-first-run',
                                '--disable-gpu',
                                '--headless',
                                '--mute-audio',
                                '--no-sandbox',
                                '--window-size=0,0'
                            ];
                            const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
                            try { child.unref(); } catch { }
                            setTimeout(() => {
                                http.get(url, (rres) => {
                                    let d = '';
                                    rres.on('data', (ch) => d += ch);
                                    rres.on('end', () => {
                                        try {
                                            const targets = JSON.parse(d);
                                            const pageTarget = (Array.isArray(targets) && (targets.find((t: any) => t.webSocketDebuggerUrl && (t.type === 'page' || t.type === 'other')) || targets[0]));
                                            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                                                return handleWsUrl(pageTarget.webSocketDebuggerUrl);
                                            }
                                        } catch (e) { }
                                        return resolve([]);
                                    });
                                }).on('error', () => resolve([]));
                            }, 4000);
                            return;
                        } catch (launchErr) {
                        }
                    }
                }
                return resolve([]);
            });
        });
    };

    if (typeof port === 'number') {
        return tryPort(port);
    }

    const ports = [];
    for (let i = 9220; i <= 9225; i++) ports.push(i);

    for (const p of ports) {
        try {
            const res = await tryPort(p);
            if (res && res.length > 0) return res;
        } catch { }
    }
    return [];
}

export default getCookiesFromDebugPort;
