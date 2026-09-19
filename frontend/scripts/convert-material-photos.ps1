<#
.SYNOPSIS
  Turns the raw Commons downloads in .image-staging/ into the PNGs the app serves.

.DESCRIPTION
  Three things have to happen to a sourced photograph before it can sit in a
  product grid: it must be cropped to one aspect ratio so cards in a row line up,
  scaled down to something a phone can afford, and written as PNG.

  PNG is not the format anyone would choose for a photograph — WebP would be a
  third of the size — but the filenames are pinned: `image-credits.json` records
  provenance against the saved name, and the homepage references the hero file
  directly. So: PNG, but reduced to a
  256-colour optimal palette with dithering, which brings a 900x675 photograph
  from roughly 1 MB down to roughly a quarter of that with no visible loss at
  the sizes the app actually renders. Pass -Mode truecolor to compare.

  Uses WPF imaging (PresentationCore) rather than System.Drawing because only
  WPF can compute a per-image optimal palette; System.Drawing would quantise to
  a fixed web palette and band the sky in every site photograph.

.PARAMETER Mode
  indexed (default) writes 8-bit palette PNGs. truecolor writes 24-bit PNGs.

.PARAMETER Only
  Comma-separated slot names, to reconvert a few files after re-sourcing them.
#>
[CmdletBinding()]
param(
  [ValidateSet('indexed', 'truecolor')]
  [string]$Mode = 'indexed',
  [string]$Only = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore, WindowsBase

$frontendDir = Split-Path -Parent $PSScriptRoot
$stageDir = Join-Path $frontendDir '.image-staging'
$imagesDir = Join-Path $frontendDir 'public/images'

# Aspect and width per group. Products and categories share 4:3 so a category
# tile and a product card crop the same way; the hero is a 16:9 banner.
$targets = @{
  categories = @{ Width = 800; Height = 600; Out = (Join-Path $imagesDir 'categories') }
  hero       = @{ Width = 1920; Height = 1080; Out = (Join-Path $imagesDir 'hero') }
}

$onlySlots = @()
if ($Only) { $onlySlots = $Only.Split(',') | Where-Object { $_ } }

function Convert-Photo {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [int]$TargetWidth,
    [int]$TargetHeight,
    [string]$Quantisation
  )

  $stream = [System.IO.File]::OpenRead($SourcePath)
  try {
    $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create(
      $stream,
      [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
      [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
    $frame = $decoder.Frames[0]
  }
  finally {
    $stream.Dispose()
  }

  # Centre-crop to the target ratio. Cropping rather than letterboxing keeps
  # every card's image the same shape, which is what makes a grid read as a grid.
  $targetRatio = $TargetWidth / $TargetHeight
  $sourceRatio = $frame.PixelWidth / $frame.PixelHeight
  if ([Math]::Abs($sourceRatio - $targetRatio) -gt 0.001) {
    if ($sourceRatio -gt $targetRatio) {
      $cropWidth = [int][Math]::Round($frame.PixelHeight * $targetRatio)
      $cropHeight = $frame.PixelHeight
    }
    else {
      $cropWidth = $frame.PixelWidth
      $cropHeight = [int][Math]::Round($frame.PixelWidth / $targetRatio)
    }
    $rect = New-Object System.Windows.Int32Rect(
      [int][Math]::Floor(($frame.PixelWidth - $cropWidth) / 2),
      [int][Math]::Floor(($frame.PixelHeight - $cropHeight) / 2),
      $cropWidth, $cropHeight)
    $working = New-Object System.Windows.Media.Imaging.CroppedBitmap($frame, $rect)
  }
  else {
    $working = $frame
  }

  # Scale to the target box. Sources are always larger, so this only downsamples.
  $scale = New-Object System.Windows.Media.ScaleTransform(
    ($TargetWidth / $working.PixelWidth),
    ($TargetHeight / $working.PixelHeight))
  $scale.Freeze()
  $scaled = New-Object System.Windows.Media.Imaging.TransformedBitmap($working, $scale)

  if ($Quantisation -eq 'indexed') {
    $palette = New-Object System.Windows.Media.Imaging.BitmapPalette($scaled, 256)
    $output = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap(
      $scaled, [System.Windows.Media.PixelFormats]::Indexed8, $palette, 0.5)
  }
  else {
    $output = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap(
      $scaled, [System.Windows.Media.PixelFormats]::Bgr24, $null, 0.5)
  }

  $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Interlace = [System.Windows.Media.Imaging.PngInterlaceOption]::Off
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($output))

  $outStream = [System.IO.File]::Create($DestinationPath)
  try { $encoder.Save($outStream) } finally { $outStream.Dispose() }
}

$converted = 0
$failed = @()

foreach ($group in $targets.Keys) {
  $sourceDir = Join-Path $stageDir $group
  if (-not (Test-Path $sourceDir)) { continue }

  $target = $targets[$group]
  if (-not (Test-Path $target.Out)) {
    New-Item -ItemType Directory -Path $target.Out -Force | Out-Null
  }

  foreach ($file in Get-ChildItem -Path $sourceDir -File) {
    $slot = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    if ($onlySlots.Count -gt 0 -and $onlySlots -notcontains $slot) { continue }

    $destination = Join-Path $target.Out "$slot.png"
    try {
      Convert-Photo -SourcePath $file.FullName -DestinationPath $destination `
        -TargetWidth $target.Width -TargetHeight $target.Height -Quantisation $Mode
      $sizeKb = [int]((Get-Item $destination).Length / 1KB)
      Write-Output ("  ok  {0,-10} {1,-34} {2,5} KB" -f $group, "$slot.png", $sizeKb)
      $converted++
    }
    catch {
      $failed += "$group/$slot : $($_.Exception.Message)"
    }
  }
}

Write-Output ""
Write-Output "converted $converted file(s) in $Mode mode"
foreach ($failure in $failed) { Write-Output "  FAIL $failure" }
