; Uninstalling YO also removes its "Start with Windows" entry (written by app.setLoginItemSettings).
; Your settings and looks in %APPDATA%\YO are kept, in case you install YO again.
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "YO"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "YO"
!macroend
