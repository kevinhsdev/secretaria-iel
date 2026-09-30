# 5.6.0 - Ajudante do "Importar boletim" do historico escolar (chamado por lib/boletim.js).
# So usa o que ja vem no Windows 10/11 e no Office da escola: nada de internet, nada instalado.
#   -Modo ocr     : le imagem (foto, papel escaneado) ou PDF com o reconhecimento de texto do Windows
#                   (Windows.Media.Ocr) e grava as palavras com a posicao de cada uma.
#   -Modo word    : abre .doc/.rtf/.odt no Word e salva como .docx.
#   -Modo excel   : abre .xls/.ods no Excel e salva como .xlsx.
# Sem acentos de proposito: o PowerShell 5.1 le .ps1 sem BOM como ANSI.
param(
  [Parameter(Mandatory = $true)][ValidateSet('ocr', 'word', 'excel')][string]$Modo,
  [Parameter(Mandatory = $true)][string]$Entrada,
  [Parameter(Mandatory = $true)][string]$Saida
)
$ErrorActionPreference = 'Stop'
# O Windows (StorageFile) so aceita caminho completo com contrabarra
$Entrada = [IO.Path]::GetFullPath($Entrada); $Saida = [IO.Path]::GetFullPath($Saida)

function Gravar-Json($obj) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  [IO.File]::WriteAllText($Saida, $json, (New-Object Text.UTF8Encoding $false))
}

# Anota qual processo do Office este script abriu: se ele travar (janela de aviso escondida), o servidor fecha so ele,
# nunca um Word ou Excel que a pessoa esteja usando.
function Anotar-Processo($nome, $antes) {
  $novo = Get-Process $nome -ErrorAction SilentlyContinue | Where-Object { $antes -notcontains $_.Id } | Select-Object -First 1
  if ($novo) { [IO.File]::WriteAllText($Saida + '.pid', [string]$novo.Id) }
}

if ($Modo -eq 'word') {
  $antes = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $w = New-Object -ComObject Word.Application
  Anotar-Processo 'WINWORD' $antes
  try {
    $w.Visible = $false; $w.DisplayAlerts = 0
    # ConfirmConversions=nao, ReadOnly=sim, AddToRecentFiles=nao
    $d = $w.Documents.Open($Entrada, $false, $true, $false)
    $d.SaveAs2($Saida, 16)   # 16 = .docx
    $d.Close($false)
  } finally { $w.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w) }
  exit 0
}

if ($Modo -eq 'excel') {
  $antes = @(Get-Process EXCEL -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $x = New-Object -ComObject Excel.Application
  Anotar-Processo 'EXCEL' $antes
  try {
    $x.Visible = $false; $x.DisplayAlerts = $false
    $l = $x.Workbooks.Open($Entrada, 0, $true)
    $l.SaveAs($Saida, 51)   # 51 = .xlsx
    $l.Close($false)
  } finally { $x.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($x) }
  exit 0
}

# ---- Reconhecimento de texto (OCR) ----
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$metodos = [System.WindowsRuntimeSystemExtensions].GetMethods()
$comResultado = $metodos | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$semResultado = $metodos | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
function Esperar($op, [Type]$tipo) {
  $t = $comResultado.MakeGenericMethod($tipo).Invoke($null, @($op))
  [void]$t.Wait(-1); $t.Result
}
function EsperarAcao($op) { $t = $semResultado.Invoke($null, @($op)); [void]$t.Wait(-1) }

$idioma = New-Object Windows.Globalization.Language 'pt-BR'
$motor = $null
if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($idioma)) { $motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($idioma) }
if (-not $motor) { $motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $motor) { throw 'SEM_OCR' }
$limite = [int][Windows.Media.Ocr.OcrEngine]::MaxImageDimension

# Le um fluxo de imagem, ajusta o tamanho (texto pequeno reconhece melhor ampliado; o motor tem um limite)
# e respeita a rotacao que o celular grava na foto (EXIF).
function Ler-Imagem($fluxo) {
  $dec = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($fluxo)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $w = [double]$dec.OrientedPixelWidth; $h = [double]$dec.OrientedPixelHeight
  $maior = [Math]::Max($w, $h)
  $alvo = [Math]::Min([double]($limite - 16), 4200.0)
  $escala = 1.0
  if ($maior -gt $alvo -or $maior -lt 1600) { $escala = $alvo / $maior }
  $tr = New-Object Windows.Graphics.Imaging.BitmapTransform
  $tr.ScaledWidth = [uint32][Math]::Floor($dec.PixelWidth * $escala)
  $tr.ScaledHeight = [uint32][Math]::Floor($dec.PixelHeight * $escala)
  $tr.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant
  $bmp = Esperar ($dec.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $tr,
      [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $r = Esperar ($motor.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
  $palavras = New-Object System.Collections.ArrayList
  $n = 0
  foreach ($linha in $r.Lines) {
    foreach ($p in $linha.Words) {
      $b = $p.BoundingRect
      [void]$palavras.Add(@{ t = $p.Text; x = [Math]::Round($b.X, 1); y = [Math]::Round($b.Y, 1); w = [Math]::Round($b.Width, 1); h = [Math]::Round($b.Height, 1); l = $n })
    }
    $n++
  }
  $ang = 0.0
  if ($r.TextAngle -ne $null) { $ang = [double]$r.TextAngle }
  @{ largura = $bmp.PixelWidth; altura = $bmp.PixelHeight; angulo = $ang; palavras = @($palavras) }
}

$arq = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Entrada)) ([Windows.Storage.StorageFile])
$paginas = New-Object System.Collections.ArrayList
$cabecalho = [IO.File]::ReadAllBytes($Entrada)[0..3]
$ehPdf = ($cabecalho[0] -eq 0x25 -and $cabecalho[1] -eq 0x50 -and $cabecalho[2] -eq 0x44 -and $cabecalho[3] -eq 0x46)
$total = 1
if ($ehPdf) {
  $pdf = Esperar ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($arq)) ([Windows.Data.Pdf.PdfDocument])
  $total = [int]$pdf.PageCount
  $ate = [Math]::Min($total, 6)   # boletim tem 1 ou 2 folhas; mais que isso nao e boletim
  for ($i = 0; $i -lt $ate; $i++) {
    $pg = $pdf.GetPage([uint32]$i)
    $op = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    $larg = [double]$pg.Size.Width; $alt = [double]$pg.Size.Height
    $esc = [Math]::Min(4000.0 / [Math]::Max($larg, $alt), 6.0)
    $op.DestinationWidth = [uint32]($larg * $esc); $op.DestinationHeight = [uint32]($alt * $esc)
    $fl = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    EsperarAcao ($pg.RenderToStreamAsync($fl, $op))
    [void]$paginas.Add((Ler-Imagem $fl))
    $fl.Dispose(); $pg.Dispose()
  }
} else {
  $fl = Esperar ($arq.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  [void]$paginas.Add((Ler-Imagem $fl))
  $fl.Dispose()
}
Gravar-Json @{ idioma = $motor.RecognizerLanguage.LanguageTag; paginas_total = $total; paginas = @($paginas) }
