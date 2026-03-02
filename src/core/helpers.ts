import fs from 'fs';
import path from 'path';
import { defaultPasswords, wordlistFilePath } from '../config/constants';
export function sleep ( ms: number ): Promise<void> {
    return new Promise( resolve => setTimeout( resolve, ms ) );
}

export function ensureDirectoryExistence ( filePath: string ): void {
    const dirname = path.dirname( filePath );
    if ( !fs.existsSync( dirname ) ) {
        fs.mkdirSync( dirname, { recursive: true } );
    }
}
export function getPasswordsX (): string[] {
    if ( fs.existsSync( wordlistFilePath ) ) {
        const fileContent = fs.readFileSync( wordlistFilePath, 'utf-8' );
        return fileContent.split( /\r?\n/ ).filter( Boolean );
    } else {
        return defaultPasswords;
    }
}

