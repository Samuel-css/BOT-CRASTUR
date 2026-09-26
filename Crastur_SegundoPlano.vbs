' ====================================================================
'          CRASTUR - INICIADOR SILENCIOSO EN SEGUNDO PLANO
' ====================================================================
' Este archivo ejecuta Crastur sin abrir la ventana negra de CMD.
' Ideal para mostradores y cajas: evita que alguien cierre por error
' la ventana de la consola y apague el bot de WhatsApp o el sistema.
' ====================================================================

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c Crastur.bat", 0, False
Set WshShell = Nothing
