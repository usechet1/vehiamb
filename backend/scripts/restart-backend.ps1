# Reinicia VehiAmbBackend de una sola vez: para la tarea, mata el proceso
# node que quede colgado del puerto/backend (sin tocar otros procesos node
# de la maquina), la vuelve a arrancar y confirma que responde.
#
# Existe porque el reinicio manual tiene dos trampas encontradas en
# produccion: "schtasks /run" sobre una tarea que ya esta corriendo NO la
# reinicia, y "schtasks /end" no siempre mata el node.exe hijo -- el
# sintoma en ambos casos es identico y enganoso: el codigo en disco ya
# esta actualizado (git pull hecho) pero el proceso en memoria sigue
# corriendo el viejo, sin ningun error visible.
#
# Uso, desde C:\vehiamb\backend:
#   powershell -ExecutionPolicy Bypass -File .\scripts\restart-backend.ps1

$tarea = "VehiAmbBackend"
$puerto = 3001

Write-Output "1) Deteniendo la tarea programada..."
schtasks /end /tn $tarea 2>$null | Out-Null

Write-Output "2) Buscando procesos node del backend..."
# Coincide por linea de comandos (server.js), no por nombre de proceso --
# node.exe se llama igual para CUALQUIER script node que corra en la
# maquina (otras herramientas CLI, etc.), asi que nunca hay que matarlo
# solo por el nombre.
$procesos = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like "*server.js*" }

if ($procesos) {
    foreach ($proceso in $procesos) {
        Write-Output "   Deteniendo PID $($proceso.ProcessId) ($($proceso.CommandLine))"
        Stop-Process -Id $proceso.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
} else {
    Write-Output "   Ninguno corriendo."
}

$sigueOcupado = Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue
if ($sigueOcupado) {
    Write-Output "   AVISO: el puerto $puerto sigue ocupado por el PID $($sigueOcupado.OwningProcess). Deteniendolo tambien..."
    Stop-Process -Id $sigueOcupado.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Output "3) Arrancando la tarea programada..."
schtasks /run /tn $tarea | Out-Null

Write-Output "4) Esperando a que responda..."
$listo = $false
for ($intento = 1; $intento -le 10; $intento++) {
    Start-Sleep -Seconds 2
    try {
        $salud = Invoke-RestMethod "http://localhost:$puerto/api/health" -TimeoutSec 3
        if ($salud.status -eq "ok") { $listo = $true; break }
    } catch {}
}

if ($listo) {
    Write-Output "`nOK: backend arriba y respondiendo (http://localhost:$puerto)."
} else {
    Write-Output "`nNO RESPONDIO tras 20 segundos. Revisa el log:"
    Write-Output "  Get-Content C:\vehiamb\backend\logs\backend.log -Tail 40"
}
