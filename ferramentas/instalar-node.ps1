# Baixa o Node.js portatil (versao LTS) para a pasta "node" do projeto. Nao precisa de administrador.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz 'node'
if (Test-Path (Join-Path $destino 'node.exe')) { Write-Host 'Node ja instalado.'; exit 0 }

Write-Host 'Baixando o Node.js portatil (uma vez so)...'
$lts = (Invoke-RestMethod https://nodejs.org/dist/index.json) | Where-Object { $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
$versao = $lts.version
if ([int]($versao.TrimStart('v').Split('.')[0]) -lt 22) { throw "Versao LTS inesperada: $versao (o app precisa do Node 22 ou mais novo)" }
$zip = Join-Path $env:TEMP "node-$versao.zip"
Invoke-WebRequest "https://nodejs.org/dist/$versao/node-$versao-win-x64.zip" -OutFile $zip -UseBasicParsing
Add-Type -AssemblyName System.IO.Compression.FileSystem
$tmp = Join-Path $env:TEMP "node-extrair-$([guid]::NewGuid())"
[IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
Move-Item (Join-Path $tmp "node-$versao-win-x64") $destino
Remove-Item $zip, $tmp -Recurse -Force
Write-Host "Node $versao instalado em $destino"
