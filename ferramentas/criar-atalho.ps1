# 5.8.3 - Cria o atalho "SEK" na area de trabalho, com o icone do app (a rosa do Luterano), abrindo o "Iniciar Secretaria.bat".
# Uso: clique com o botao direito > "Executar com o PowerShell"  (ou: powershell -ExecutionPolicy Bypass -File ferramentas\criar-atalho.ps1)
# Sem acentos de proposito: o PowerShell 5.1 le .ps1 sem BOM como ANSI.
param([string]$Nome = 'SEK', [string]$Pasta = '')
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$bat = Join-Path $raiz 'Iniciar Secretaria.bat'
$icone = Join-Path $raiz 'app\public\icone.ico'
if (-not (Test-Path $bat)) { throw "Nao achei $bat" }
if (-not (Test-Path $icone)) { throw "Nao achei o icone $icone (rode: node ferramentas\gerar-icone.mjs)" }
# A area de trabalho pode estar no OneDrive: o Windows diz onde ela fica
$area = if ($Pasta) { $Pasta } else { [Environment]::GetFolderPath('Desktop') }
$destino = Join-Path $area ($Nome + '.lnk')
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($destino)
$lnk.TargetPath = $bat
$lnk.WorkingDirectory = $raiz
$lnk.IconLocation = $icone + ',0'
$lnk.Description = 'Abre o sistema da secretaria (' + $Nome + ')'
$lnk.WindowStyle = 1   # janela normal: na 1a vez ela mostra o download do Node, e avisa para nao fechar
$lnk.Save()
Write-Host ('Atalho criado: ' + $destino)
