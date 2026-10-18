!include "x64.nsh"
!include "WinVer.nsh"

; YO is built on Electron, which runs only on 64-bit Windows 10 or 11. On Windows 7/8 or a 32-bit
; Windows, the installed YO.exe can't start ("not a valid Win32 application"): say why and stop instead.
!macro customInit
  ${IfNot} ${RunningX64}
  ${OrIfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "YO needs Windows 10 or 11, 64-bit.$\r$\nThis PC runs an older or 32-bit Windows, so YO can't run on it.$\r$\n$\r$\nYO a besoin de Windows 10 ou 11 (64 bits).$\r$\nCe PC a une version plus ancienne ou 32 bits de Windows : YO ne peut pas y fonctionner."
    Quit
  ${EndIf}
!macroend

; Uninstalling YO also removes its "Start with Windows" entry (written by app.setLoginItemSettings).
; Your settings and looks in %APPDATA%\YO are kept, in case you install YO again.
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "YO"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "YO"
!macroend
