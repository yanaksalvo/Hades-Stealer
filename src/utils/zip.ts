import fs from 'fs';
import AdmZip from 'adm-zip';

export async function zipFolderX ( source: string, out: string ): Promise<void> {
    return new Promise( ( resolve, reject ) => {
        try {
            const zip = new AdmZip();
            const folderExists = fs.existsSync( source );

            if ( !folderExists ) {
                reject( new Error( `Source folder does not exist: ${ source }` ) );
                return;
            }

            zip.addLocalFolder( source );

            zip.writeZip( out, ( err ) => {
                if ( err ) {
                    reject( err );
                } else {
                    resolve();
                }
            } );
        } catch ( error ) {
            reject( error );
        }
    } );
}

export function createZipFromFolder ( folderPath: string, outputPath: string ): void {
    const zip = new AdmZip();
    zip.addLocalFolder( folderPath );
    zip.writeZip( outputPath );
}
