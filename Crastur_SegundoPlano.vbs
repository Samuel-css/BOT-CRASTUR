' ====================================================================
'          CRASTUR - INICIADOR SILENCIOSO EN SEGUNDO PLANO
' ====================================================================
' Este archivo ejecuta Crastur sin abrir la ventana negra de CMD.
' Ideal para mostradores y cajas: evita que alguien cierre por error
' la ventana de la consola y apague el bot de WhatsApp o el sistema.
'
' [ARRANQUE SEGURO] Antes de abrir en silencio se comprueba:
'   1. Que Node.js sea 20.19+ / 22.12+ (requisito de WhatsApp y del panel).
'   2. Que existan las dependencias y el panel compilado.
' Si falta algo, se abre Crastur.bat DE FORMA VISIBLE para que el usuario
' vea el error o el instalador. Antes se abria oculto y un "pause" dejaba
' el sistema colgado sin mostrar nada.
'
' Los mensajes y errores del arranque se guardan en data/launcher.log
' para poder diagnosticar aunque la consola permanezca oculta.
' ====================================================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = base

' Crear la carpeta data si no existe para poder escribir el log
dataDir = base & "\data"
If Not fso.FolderExists(dataDir) Then
    fso.CreateFolder(dataDir)
End If

logFile = dataDir & "\launcher.log"
batFile = base & "\Crastur.bat"

' --- 1. Comprobar Node.js 20.19+ / 22.12+ ----------------------------
nodeOk = False
On Error Resume Next
nodeExit = WshShell.Run( _
    "cmd /c node -e ""var v=process.versions.node.split('.').map(Number); process.exit((v[0]>22 || (v[0]===22 && v[1]>=12) || (v[0]===20 && v[1]>=19)) ? 0 : 1)"" >nul 2>nul", _
    0, True)
If Err.Number = 0 Then nodeOk = (nodeExit = 0)
Err.Clear
On Error GoTo 0

' --- 2. Comprobar dependencias y panel compilado --------------------
depsOk = fso.FileExists(base & "\node_modules\express") _
     And fso.FileExists(base & "\node_modules\tsx") _
     And fso.FileExists(base & "\node_modules\sql.js") _
     And fso.FolderExists(base & "\node_modules\@whiskeysockets\baileys") _
     And fso.FileExists(base & "\client\dist\index.html")

If Not nodeOk Or Not depsOk Then
    ' [REPARACION VISIBLE] Falta Node o componentes: abrir la consola para
    ' que el usuario vea el mensaje y pueda abrir el instalador.
    WshShell.Run "cmd /c """ & batFile & """", 1, False
Else
    ' [MODO SILENCIOSO] Todo esta listo: arrancar oculto y registrar la salida.
    ' [ROBUSTEZ] Se citan AMBAS rutas (el .bat y el log) y se usa ruta absoluta,
    ' para que funcione aunque la carpeta del proyecto o el usuario tengan espacios.
    WshShell.Run "cmd /c """"" & batFile & """" & " >> """ & logFile & """ 2>&1""", 0, False
End If

Set WshShell = Nothing
Set fso = Nothing
