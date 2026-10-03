' ====================================================================
'          CRASTUR - INICIADOR SILENCIOSO EN SEGUNDO PLANO
' ====================================================================
' Este archivo ejecuta Crastur sin abrir la ventana negra de CMD.
' Ideal para mostradores y cajas: evita que alguien cierre por error
' la ventana de la consola y apague el bot de WhatsApp o el sistema.
'
' Los mensajes y errores del arranque se guardan en data/launcher.log
' para poder diagnosticar aunque la consola permanezca oculta.
' ====================================================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

' Crear la carpeta data si no existe para poder escribir el log
dataDir = fso.GetParentFolderName(WScript.ScriptFullName) & "\data"
If Not fso.FolderExists(dataDir) Then
    fso.CreateFolder(dataDir)
End If

logFile = dataDir & "\launcher.log"
batFile = fso.GetParentFolderName(WScript.ScriptFullName) & "\Crastur.bat"
' [ROBUSTEZ] Se citan AMBAS rutas (el .bat y el log) y se usa ruta absoluta, para que
' funcione aunque la carpeta del proyecto o el usuario contengan espacios.
WshShell.Run "cmd /c """"" & batFile & """" & " >> """ & logFile & """ 2>&1""", 0, False
Set WshShell = Nothing
Set fso = Nothing
