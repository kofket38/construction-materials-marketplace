<#
.SYNOPSIS
  Tiles the images under public/images into labelled contact sheets.

.DESCRIPTION
  Sourcing a photograph from a search result proves nothing about what the
  photograph shows. The only check that catches "a Volkswagen window on the
  aluminium-window listing" is a human looking at the picture next to the slot
  name it was filed under — and looking at fifty files one at a time is how that
  check gets skipped. So this renders each group onto one sheet, every tile
  captioned with its filename, which makes a mismatch obvious at a glance.

  Sheets land in .image-staging/ (git-ignored); they are a review aid, not an
  application asset.

.PARAMETER Group
  products, categories, hero, or all (default).
#>
[CmdletBinding()]
param(
  [ValidateSet('products', 'categories', 'hero', 'all')]
  [string]$Group = 'all'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase

$frontendDir = Split-Path -Parent $PSScriptRoot
$imagesDir = Join-Path $frontendDir 'public/images'
$outDir = Join-Path $frontendDir '.image-staging'

# Tile geometry per group. Products get the smallest tiles because there are the
# most of them; the hero banners get the largest because the landing page shows
# one of them at full width and a thumbnail cannot tell you whether it works.
$layouts = @{
  products   = @{ Columns = 6; TileWidth = 210; TileHeight = 158 }
  categories = @{ Columns = 5; TileWidth = 250; TileHeight = 188 }
  hero       = @{ Columns = 2; TileWidth = 460; TileHeight = 259 }
}

$captionHeight = 22
$gap = 6
$typeface = New-Object System.Windows.Media.Typeface('Consolas')
$black = [System.Windows.Media.Brushes]::Black
$white = [System.Windows.Media.Brushes]::White
$grey = New-Object System.Windows.Media.SolidColorBrush(
  [System.Windows.Media.Color]::FromRgb(38, 38, 38))
$grey.Freeze()

function New-Caption {
  param([string]$Text, [double]$MaxWidth)

  $formatted = New-Object System.Windows.Media.FormattedText(
    $Text,
    [System.Globalization.CultureInfo]::InvariantCulture,
    [System.Windows.FlowDirection]::LeftToRight,
    $typeface, 11.0, $white, 1.0)
  $formatted.MaxTextWidth = $MaxWidth
  $formatted.MaxLineCount = 1
  $formatted.Trimming = [System.Windows.TextTrimming]::CharacterEllipsis
  return $formatted
}

function Build-Sheet {
  param([string]$Name)

  $sourceDir = Join-Path $imagesDir $Name
  if (-not (Test-Path $sourceDir)) {
    Write-Host "  skip $Name (no such directory)"
    return
  }

  $files = @(Get-ChildItem $sourceDir -File | Sort-Object Name)
  if ($files.Count -eq 0) {
    Write-Host "  skip $Name (empty)"
    return
  }

  $layout = $layouts[$Name]
  $columns = [Math]::Min($layout.Columns, $files.Count)
  $rows = [Math]::Ceiling($files.Count / $columns)
  $cellW = $layout.TileWidth + $gap
  $cellH = $layout.TileHeight + $captionHeight + $gap
  $sheetW = ($columns * $cellW) + $gap
  $sheetH = ($rows * $cellH) + $gap

  $visual = New-Object System.Windows.Media.DrawingVisual
  $ctx = $visual.RenderOpen()
  $ctx.DrawRectangle($black, $null,
    (New-Object System.Windows.Rect(0, 0, $sheetW, $sheetH)))

  for ($i = 0; $i -lt $files.Count; $i++) {
    $file = $files[$i]
    $col = $i % $columns
    $row = [Math]::Floor($i / $columns)
    $x = $gap + ($col * $cellW)
    $y = $gap + ($row * $cellH)

    $tileRect = New-Object System.Windows.Rect(
      $x, $y, $layout.TileWidth, $layout.TileHeight)
    $ctx.DrawRectangle($grey, $null, $tileRect)

    # Letterbox rather than crop: a contact sheet exists to show what the file
    # contains, and cropping to the tile could hide the very subject in question.
    $frame = [System.Windows.Media.Imaging.BitmapFrame]::Create(
      (New-Object System.Uri($file.FullName)),
      [System.Windows.Media.Imaging.BitmapCreateOptions]::None,
      [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
    $scale = [Math]::Min(
      $layout.TileWidth / $frame.PixelWidth,
      $layout.TileHeight / $frame.PixelHeight)
    $drawW = $frame.PixelWidth * $scale
    $drawH = $frame.PixelHeight * $scale
    $ctx.DrawImage($frame, (New-Object System.Windows.Rect(
      ($x + (($layout.TileWidth - $drawW) / 2)),
      ($y + (($layout.TileHeight - $drawH) / 2)),
      $drawW, $drawH)))

    $caption = New-Caption -Text $file.BaseName -MaxWidth $layout.TileWidth
    $ctx.DrawText($caption, (New-Object System.Windows.Point(
      $x, ($y + $layout.TileHeight + 4))))
  }

  $ctx.Close()

  $target = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(
    [int]$sheetW, [int]$sheetH, 96, 96,
    [System.Windows.Media.PixelFormats]::Pbgra32)
  $target.Render($visual)

  $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add(
    [System.Windows.Media.Imaging.BitmapFrame]::Create($target))
  $outPath = Join-Path $outDir "contact-$Name.png"
  $stream = [System.IO.File]::Create($outPath)
  try { $encoder.Save($stream) } finally { $stream.Dispose() }

  Write-Host ("  {0,-11} {1,2} tile(s)  {2}" -f $Name, $files.Count, $outPath)
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$groups = if ($Group -eq 'all') { 'products', 'categories', 'hero' } else { @($Group) }
foreach ($name in $groups) { Build-Sheet -Name $name }
