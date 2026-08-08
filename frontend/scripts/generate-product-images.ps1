Add-Type -AssemblyName System.Drawing

$outputDirectory = Join-Path $PSScriptRoot "..\public\images\products"
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null

$products = @(
  @{ File = "rebar-12mm.png"; Title = "Reinforcement Bar 12 mm"; Subtitle = "Grade 60 deformed steel"; Kind = "rebar"; Accent = "#B45309" },
  @{ File = "galvanized-steel-pipe-2-inch.png"; Title = "Galvanized Steel Pipe"; Subtitle = "2 inch x 6 m"; Kind = "steel-pipe"; Accent = "#64748B" },
  @{ File = "hollow-concrete-block-20cm.png"; Title = "Hollow Concrete Block"; Subtitle = "40 x 20 x 20 cm"; Kind = "block"; Accent = "#71717A" },
  @{ File = "porcelain-floor-tile-60x60.png"; Title = "Porcelain Floor Tile"; Subtitle = "60 x 60 cm matte finish"; Kind = "tile"; Accent = "#0F766E" },
  @{ File = "corrugated-roofing-sheet-035.png"; Title = "Galvanized Roofing Sheet"; Subtitle = "0.35 mm corrugated profile"; Kind = "roof-sheet"; Accent = "#64748B" },
  @{ File = "washed-construction-sand.png"; Title = "Washed Construction Sand"; Subtitle = "7 m3 tipper load"; Kind = "sand"; Accent = "#C08457" },
  @{ File = "crushed-gravel-20mm.png"; Title = "Crushed Gravel"; Subtitle = "20 mm aggregate, 7 m3 load"; Kind = "gravel"; Accent = "#57534E" },
  @{ File = "interior-emulsion-paint-20l.png"; Title = "Interior Emulsion Paint"; Subtitle = "White matt, 20 litres"; Kind = "paint"; Accent = "#0891B2" },
  @{ File = "copper-cable-25mm.png"; Title = "Copper Building Wire"; Subtitle = "2.5 mm2 x 100 m"; Kind = "cable"; Accent = "#DC2626" },
  @{ File = "pvc-pressure-pipe-4-inch.png"; Title = "PVC Pressure Pipe"; Subtitle = "4 inch PN10 x 6 m"; Kind = "pvc-pipe"; Accent = "#2563EB" },
  @{ File = "rebar-16mm.png"; Title = "Reinforcement Bar 16 mm"; Subtitle = "Grade 60 deformed steel"; Kind = "rebar"; Accent = "#92400E" },
  @{ File = "binding-wire-25kg.png"; Title = "Annealed Binding Wire"; Subtitle = "25 kg contractor coil"; Kind = "wire"; Accent = "#475569" },
  @{ File = "hollow-concrete-block-15cm.png"; Title = "Hollow Concrete Block"; Subtitle = "40 x 20 x 15 cm"; Kind = "block"; Accent = "#52525B" },
  @{ File = "fired-clay-brick.png"; Title = "Fired Clay Brick"; Subtitle = "Standard masonry brick"; Kind = "brick"; Accent = "#B45309" },
  @{ File = "ceramic-wall-tile-30x60.png"; Title = "Ceramic Wall Tile"; Subtitle = "30 x 60 cm gloss white"; Kind = "wall-tile"; Accent = "#0284C7" },
  @{ File = "tile-adhesive-25kg.png"; Title = "Tile Adhesive"; Subtitle = "Interior and exterior, 25 kg"; Kind = "bag"; Accent = "#0F766E" },
  @{ File = "prepainted-roofing-sheet-040.png"; Title = "Prepainted Roofing Sheet"; Subtitle = "0.40 mm, charcoal finish"; Kind = "roof-sheet"; Accent = "#334155" },
  @{ File = "galvanized-ridge-cap.png"; Title = "Galvanized Ridge Cap"; Subtitle = "3 m roof finishing section"; Kind = "ridge-cap"; Accent = "#64748B" },
  @{ File = "crushed-hardcore-40mm.png"; Title = "Crushed Stone Hardcore"; Subtitle = "40 mm base course aggregate"; Kind = "hardcore"; Accent = "#44403C" },
  @{ File = "exterior-weather-paint-20l.png"; Title = "Exterior Weather Paint"; Subtitle = "Weather-resistant, 20 litres"; Kind = "paint"; Accent = "#15803D" },
  @{ File = "alkali-resistant-primer-20l.png"; Title = "Alkali Resistant Primer"; Subtitle = "Masonry primer, 20 litres"; Kind = "paint"; Accent = "#D97706" },
  @{ File = "copper-cable-15mm.png"; Title = "Copper Lighting Wire"; Subtitle = "1.5 mm2 x 100 m"; Kind = "cable"; Accent = "#2563EB" },
  @{ File = "distribution-board-12-way.png"; Title = "12-Way Distribution Board"; Subtitle = "Flush-mounted consumer unit"; Kind = "distribution-board"; Accent = "#0F766E" },
  @{ File = "twin-socket-13a.png"; Title = "Twin Switched Socket"; Subtitle = "13 A white wall outlet"; Kind = "socket"; Accent = "#64748B" },
  @{ File = "pvc-drainage-pipe-110mm.png"; Title = "PVC Drainage Pipe"; Subtitle = "110 mm x 6 m"; Kind = "pvc-pipe"; Accent = "#F59E0B" },
  @{ File = "ppr-pipe-25mm.png"; Title = "PPR Water Pipe"; Subtitle = "25 mm PN20 x 4 m"; Kind = "ppr-pipe"; Accent = "#16A34A" },
  @{ File = "brass-gate-valve-1-inch.png"; Title = "Brass Gate Valve"; Subtitle = "1 inch threaded connection"; Kind = "valve"; Accent = "#CA8A04" },
  @{ File = "security-steel-door.png"; Title = "Security Steel Door"; Subtitle = "900 x 2100 mm complete set"; Kind = "steel-door"; Accent = "#374151" },
  @{ File = "aluminium-sliding-window.png"; Title = "Aluminium Sliding Window"; Subtitle = "1200 x 1200 mm glazed unit"; Kind = "window"; Accent = "#0284C7" },
  @{ File = "flush-interior-door.png"; Title = "Flush Interior Door"; Subtitle = "800 x 2100 mm leaf"; Kind = "wood-door"; Accent = "#A16207" },
  @{ File = "eucalyptus-poles-4m.png"; Title = "Treated Eucalyptus Poles"; Subtitle = "4 m construction poles"; Kind = "poles"; Accent = "#7C5A32" },
  @{ File = "plywood-18mm.png"; Title = "Structural Plywood"; Subtitle = "18 mm, 1220 x 2440 mm"; Kind = "board"; Accent = "#B7791F" },
  @{ File = "mdf-board-16mm.png"; Title = "MDF Board"; Subtitle = "16 mm, 1220 x 2440 mm"; Kind = "board"; Accent = "#92400E" },
  @{ File = "torch-on-membrane.png"; Title = "Torch-On Membrane"; Subtitle = "4 mm x 10 m waterproofing roll"; Kind = "membrane"; Accent = "#111827" },
  @{ File = "cementitious-waterproofing-25kg.png"; Title = "Waterproofing Coating"; Subtitle = "Cementitious compound, 25 kg"; Kind = "bag"; Accent = "#0369A1" },
  @{ File = "close-coupled-toilet.png"; Title = "Close-Coupled Toilet"; Subtitle = "Dual-flush ceramic suite"; Kind = "toilet"; Accent = "#0E7490" },
  @{ File = "ceramic-wash-basin.png"; Title = "Ceramic Wash Basin"; Subtitle = "550 mm pedestal basin"; Kind = "basin"; Accent = "#0284C7" },
  @{ File = "chrome-shower-mixer.png"; Title = "Chrome Shower Mixer"; Subtitle = "Single-lever wall set"; Kind = "shower"; Accent = "#64748B" }
)

function New-Brush([string] $color) {
  return [System.Drawing.SolidBrush]::new(
    [System.Drawing.ColorTranslator]::FromHtml($color)
  )
}

function New-Pen([string] $color, [float] $width) {
  $pen = [System.Drawing.Pen]::new(
    [System.Drawing.ColorTranslator]::FromHtml($color),
    $width
  )
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  return $pen
}

function Fill-RoundedRectangle(
  [System.Drawing.Graphics] $graphics,
  [System.Drawing.Brush] $brush,
  [float] $x,
  [float] $y,
  [float] $width,
  [float] $height,
  [float] $radius
) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc(
    $x + $width - $diameter,
    $y + $height - $diameter,
    $diameter,
    $diameter,
    0,
    90
  )
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-ProductObject(
  [System.Drawing.Graphics] $graphics,
  [string] $kind,
  [System.Drawing.Color] $accent
) {
  $accentBrush = [System.Drawing.SolidBrush]::new($accent)
  $accentDark = [System.Drawing.Color]::FromArgb(
    255,
    [Math]::Max(0, $accent.R - 42),
    [Math]::Max(0, $accent.G - 42),
    [Math]::Max(0, $accent.B - 42)
  )
  $accentPen = [System.Drawing.Pen]::new($accentDark, 10)
  $darkBrush = New-Brush "#27272A"
  $midBrush = New-Brush "#A1A1AA"
  $lightBrush = New-Brush "#F4F4F5"
  $whiteBrush = New-Brush "#FFFFFF"
  $linePen = New-Pen "#52525B" 9
  $whitePen = New-Pen "#FFFFFF" 5

  switch ($kind) {
    "rebar" {
      for ($index = 0; $index -lt 7; $index++) {
        $y = 270 + ($index * 45)
        $graphics.DrawLine($accentPen, 210, $y, 985, $y - 72)
        for ($rib = 0; $rib -lt 9; $rib++) {
          $x = 260 + ($rib * 82)
          $graphics.DrawLine($linePen, $x, $y - 18, $x + 22, $y + 12)
        }
      }
    }
    "steel-pipe" {
      for ($index = 0; $index -lt 5; $index++) {
        $y = 300 + ($index * 72)
        $graphics.FillRectangle($midBrush, 235, $y, 690, 48)
        $graphics.FillEllipse($lightBrush, 885, $y, 80, 48)
        $graphics.FillEllipse($darkBrush, 905, $y + 11, 40, 26)
      }
    }
    "wire" {
      for ($index = 0; $index -lt 8; $index++) {
        $size = 390 - ($index * 34)
        $offset = $index * 17
        $graphics.DrawEllipse($linePen, 405 + $offset, 240 + $offset, $size, $size)
      }
      $graphics.DrawLine($accentPen, 390, 635, 785, 650)
    }
    "block" {
      $graphics.FillRectangle($midBrush, 285, 255, 630, 330)
      $graphics.FillRectangle($lightBrush, 335, 310, 150, 215)
      $graphics.FillRectangle($lightBrush, 525, 310, 150, 215)
      $graphics.FillRectangle($lightBrush, 715, 310, 150, 215)
      $graphics.DrawRectangle($linePen, 285, 255, 630, 330)
    }
    "brick" {
      for ($row = 0; $row -lt 3; $row++) {
        for ($column = 0; $column -lt 4; $column++) {
          $offset = if ($row % 2 -eq 0) { 0 } else { 75 }
          $graphics.FillRectangle(
            $accentBrush,
            230 + $offset + ($column * 180),
            260 + ($row * 110),
            155,
            88
          )
        }
      }
    }
    "tile" {
      $graphics.FillPolygon(
        $lightBrush,
        [System.Drawing.Point[]]@(
          [System.Drawing.Point]::new(310, 220),
          [System.Drawing.Point]::new(920, 330),
          [System.Drawing.Point]::new(750, 650),
          [System.Drawing.Point]::new(180, 500)
        )
      )
      $graphics.DrawPolygon(
        $accentPen,
        [System.Drawing.Point[]]@(
          [System.Drawing.Point]::new(310, 220),
          [System.Drawing.Point]::new(920, 330),
          [System.Drawing.Point]::new(750, 650),
          [System.Drawing.Point]::new(180, 500)
        )
      )
      $graphics.DrawLine($linePen, 470, 250, 340, 540)
      $graphics.DrawLine($linePen, 650, 282, 515, 585)
      $graphics.DrawLine($linePen, 825, 315, 690, 630)
      $graphics.DrawLine($linePen, 250, 390, 835, 520)
    }
    "wall-tile" {
      for ($row = 0; $row -lt 2; $row++) {
        for ($column = 0; $column -lt 3; $column++) {
          $x = 250 + ($column * 235)
          $y = 235 + ($row * 190)
          $graphics.FillRectangle($whiteBrush, $x, $y, 205, 160)
          $graphics.DrawRectangle($accentPen, $x, $y, 205, 160)
          $graphics.DrawArc($linePen, $x + 25, $y + 35, 150, 80, 12, 155)
        }
      }
    }
    "bag" {
      Fill-RoundedRectangle $graphics $lightBrush 390 205 420 430 28
      $graphics.FillRectangle($accentBrush, 390, 330, 420, 150)
      $graphics.DrawLine($linePen, 420, 245, 780, 245)
      $graphics.DrawLine($linePen, 430, 590, 770, 590)
    }
    "roof-sheet" {
      for ($index = 0; $index -lt 9; $index++) {
        $x = 210 + ($index * 82)
        $graphics.DrawBezier(
          $accentPen,
          $x,
          250,
          $x + 35,
          330,
          $x - 25,
          530,
          $x + 15,
          620
        )
      }
    }
    "ridge-cap" {
      $graphics.FillPolygon(
        $accentBrush,
        [System.Drawing.Point[]]@(
          [System.Drawing.Point]::new(205, 540),
          [System.Drawing.Point]::new(575, 250),
          [System.Drawing.Point]::new(995, 540),
          [System.Drawing.Point]::new(925, 610),
          [System.Drawing.Point]::new(575, 365),
          [System.Drawing.Point]::new(275, 610)
        )
      )
      $graphics.DrawLines(
        $linePen,
        [System.Drawing.Point[]]@(
          [System.Drawing.Point]::new(205, 540),
          [System.Drawing.Point]::new(575, 250),
          [System.Drawing.Point]::new(995, 540)
        )
      )
    }
    { $_ -in @("sand", "gravel", "hardcore") } {
      $randomSeed = switch ($kind) {
        "sand" { 1101 }
        "gravel" { 2202 }
        default { 3303 }
      }
      $random = [System.Random]::new($randomSeed)
      for ($index = 0; $index -lt 180; $index++) {
        $x = $random.Next(245, 955)
        $y = $random.Next(300, 610)
        $relative = [Math]::Abs($x - 600) / 355
        $maxHeight = 610 - [Math]::Round((1 - $relative) * 300)
        if ($y -ge $maxHeight) {
          $size = if ($kind -eq "sand") { $random.Next(5, 14) } elseif ($kind -eq "gravel") { $random.Next(12, 30) } else { $random.Next(22, 46) }
          $graphics.FillEllipse($accentBrush, $x, $y, $size, $size)
        }
      }
      $graphics.DrawArc($linePen, 235, 330, 730, 360, 8, 164)
    }
    "paint" {
      Fill-RoundedRectangle $graphics $lightBrush 395 255 410 350 18
      $graphics.FillRectangle($accentBrush, 395, 360, 410, 150)
      $graphics.DrawArc($linePen, 455, 175, 290, 235, 190, 160)
      $graphics.FillEllipse($midBrush, 395, 230, 410, 70)
    }
    "cable" {
      for ($index = 0; $index -lt 8; $index++) {
        $size = 410 - ($index * 40)
        $offset = $index * 20
        $graphics.DrawEllipse($accentPen, 395 + $offset, 215 + $offset, $size, $size)
      }
      $graphics.DrawLine($accentPen, 785, 520, 950, 610)
      $graphics.FillEllipse($darkBrush, 935, 595, 28, 28)
    }
    "distribution-board" {
      Fill-RoundedRectangle $graphics $whiteBrush 350 190 500 450 22
      $graphics.DrawRectangle($linePen, 350, 190, 500, 450)
      for ($row = 0; $row -lt 2; $row++) {
        for ($column = 0; $column -lt 6; $column++) {
          $x = 400 + ($column * 67)
          $y = 285 + ($row * 145)
          $graphics.FillRectangle($accentBrush, $x, $y, 42, 80)
          $graphics.FillRectangle($darkBrush, $x + 10, $y + 12, 22, 20)
        }
      }
    }
    "socket" {
      Fill-RoundedRectangle $graphics $whiteBrush 405 215 390 390 24
      $graphics.DrawRectangle($linePen, 405, 215, 390, 390)
      foreach ($x in @(500, 680)) {
        $graphics.FillEllipse($darkBrush, $x, 330, 34, 34)
        $graphics.FillEllipse($darkBrush, $x + 48, 330, 34, 34)
        $graphics.FillRectangle($darkBrush, $x + 35, 390, 18, 46)
        $graphics.FillRectangle($accentBrush, $x + 8, 480, 72, 38)
      }
    }
    "pvc-pipe" {
      for ($index = 0; $index -lt 4; $index++) {
        $y = 285 + ($index * 90)
        $graphics.FillRectangle($accentBrush, 245, $y, 680, 58)
        $graphics.FillEllipse($lightBrush, 885, $y, 92, 58)
        $graphics.FillEllipse($darkBrush, 910, $y + 14, 43, 30)
      }
    }
    "ppr-pipe" {
      for ($index = 0; $index -lt 4; $index++) {
        $y = 285 + ($index * 90)
        $graphics.FillRectangle($accentBrush, 245, $y, 680, 58)
        $graphics.DrawLine($whitePen, 300, $y + 29, 875, $y + 29)
        $graphics.FillEllipse($lightBrush, 885, $y, 92, 58)
      }
    }
    "valve" {
      $graphics.FillRectangle($accentBrush, 400, 350, 400, 170)
      $graphics.FillEllipse($accentBrush, 315, 345, 180, 180)
      $graphics.FillEllipse($accentBrush, 705, 345, 180, 180)
      $graphics.FillRectangle($accentBrush, 555, 250, 90, 120)
      $graphics.DrawEllipse($accentPen, 435, 160, 330, 150)
      $graphics.DrawLine($accentPen, 600, 175, 600, 300)
    }
    "steel-door" {
      $graphics.FillRectangle($accentBrush, 425, 140, 350, 540)
      $graphics.DrawRectangle($linePen, 425, 140, 350, 540)
      $graphics.DrawRectangle($linePen, 475, 205, 250, 180)
      $graphics.DrawRectangle($linePen, 475, 420, 250, 190)
      $graphics.FillEllipse($midBrush, 685, 395, 30, 30)
    }
    "window" {
      $graphics.FillRectangle($lightBrush, 315, 185, 570, 440)
      $graphics.DrawRectangle($accentPen, 315, 185, 570, 440)
      $graphics.DrawLine($accentPen, 600, 185, 600, 625)
      $graphics.DrawLine($accentPen, 315, 405, 885, 405)
      $graphics.DrawLine($linePen, 570, 185, 570, 625)
      $graphics.FillRectangle($accentBrush, 565, 375, 18, 58)
    }
    "wood-door" {
      $woodBrush = New-Brush "#C98D4B"
      $graphics.FillRectangle($woodBrush, 425, 140, 350, 540)
      $graphics.DrawRectangle($accentPen, 425, 140, 350, 540)
      for ($index = 0; $index -lt 5; $index++) {
        $graphics.DrawArc($linePen, 470, 210 + ($index * 75), 250, 100, 190, 150)
      }
      $graphics.FillEllipse($darkBrush, 690, 400, 30, 30)
      $woodBrush.Dispose()
    }
    "poles" {
      for ($index = 0; $index -lt 7; $index++) {
        $x = 250 + ($index * 85)
        $graphics.DrawLine($accentPen, $x, 610, $x + 250, 225)
        $graphics.FillEllipse($darkBrush, $x + 225, 205, 55, 55)
      }
    }
    "board" {
      for ($index = 0; $index -lt 4; $index++) {
        $offset = $index * 35
        $graphics.FillPolygon(
          $accentBrush,
          [System.Drawing.Point[]]@(
            [System.Drawing.Point]::new(270 + $offset, 260 - $offset),
            [System.Drawing.Point]::new(870 + $offset, 330 - $offset),
            [System.Drawing.Point]::new(760 + $offset, 610 - $offset),
            [System.Drawing.Point]::new(180 + $offset, 520 - $offset)
          )
        )
        $graphics.DrawPolygon(
          $linePen,
          [System.Drawing.Point[]]@(
            [System.Drawing.Point]::new(270 + $offset, 260 - $offset),
            [System.Drawing.Point]::new(870 + $offset, 330 - $offset),
            [System.Drawing.Point]::new(760 + $offset, 610 - $offset),
            [System.Drawing.Point]::new(180 + $offset, 520 - $offset)
          )
        )
      }
    }
    "membrane" {
      $graphics.FillRectangle($darkBrush, 310, 330, 590, 230)
      $graphics.FillEllipse($accentBrush, 770, 330, 260, 230)
      $graphics.FillEllipse($lightBrush, 825, 375, 150, 140)
      $graphics.FillEllipse($darkBrush, 865, 410, 70, 70)
      $graphics.DrawLine($linePen, 310, 330, 875, 330)
      $graphics.DrawLine($linePen, 310, 560, 875, 560)
    }
    "toilet" {
      $graphics.FillEllipse($whiteBrush, 390, 340, 420, 235)
      $graphics.DrawEllipse($accentPen, 390, 340, 420, 235)
      Fill-RoundedRectangle $graphics $whiteBrush 470 175 260 220 26
      $graphics.DrawRectangle($accentPen, 470, 175, 260, 220)
      $graphics.FillRectangle($whiteBrush, 500, 500, 200, 150)
    }
    "basin" {
      $graphics.FillEllipse($whiteBrush, 310, 240, 580, 260)
      $graphics.DrawEllipse($accentPen, 310, 240, 580, 260)
      $graphics.FillEllipse($darkBrush, 580, 350, 40, 28)
      $graphics.FillPolygon(
        $whiteBrush,
        [System.Drawing.Point[]]@(
          [System.Drawing.Point]::new(500, 440),
          [System.Drawing.Point]::new(700, 440),
          [System.Drawing.Point]::new(660, 670),
          [System.Drawing.Point]::new(540, 670)
        )
      )
      $graphics.DrawLine($accentPen, 500, 440, 540, 670)
      $graphics.DrawLine($accentPen, 700, 440, 660, 670)
    }
    "shower" {
      $graphics.DrawLine($accentPen, 400, 300, 800, 300)
      $graphics.FillEllipse($midBrush, 350, 255, 100, 90)
      $graphics.FillEllipse($midBrush, 750, 255, 100, 90)
      $graphics.FillEllipse($accentBrush, 540, 240, 120, 120)
      $graphics.DrawLine($accentPen, 600, 350, 600, 580)
      $graphics.DrawArc($accentPen, 600, 470, 220, 180, 90, 180)
      $graphics.FillEllipse($midBrush, 780, 425, 110, 110)
    }
  }

  $accentBrush.Dispose()
  $accentPen.Dispose()
  $darkBrush.Dispose()
  $midBrush.Dispose()
  $lightBrush.Dispose()
  $whiteBrush.Dispose()
  $linePen.Dispose()
  $whitePen.Dispose()
}

foreach ($product in $products) {
  $bitmap = [System.Drawing.Bitmap]::new(1200, 900)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#F8FAFC"))

  $floorBrush = New-Brush "#E4E4E7"
  $graphics.FillEllipse($floorBrush, 160, 600, 880, 95)
  $floorBrush.Dispose()

  $accent = [System.Drawing.ColorTranslator]::FromHtml($product.Accent)
  Draw-ProductObject $graphics $product.Kind $accent

  $labelBrush = New-Brush "#FFFFFF"
  $titleBrush = New-Brush "#18181B"
  $subtitleBrush = New-Brush "#52525B"
  $categoryBrush = [System.Drawing.SolidBrush]::new($accent)
  $titleFont = [System.Drawing.Font]::new("Arial", 32, [System.Drawing.FontStyle]::Bold)
  $subtitleFont = [System.Drawing.Font]::new("Arial", 20, [System.Drawing.FontStyle]::Regular)
  $categoryFont = [System.Drawing.Font]::new("Arial", 15, [System.Drawing.FontStyle]::Bold)

  $graphics.FillRectangle($labelBrush, 0, 710, 1200, 190)
  $graphics.FillRectangle($categoryBrush, 72, 750, 9, 90)
  $graphics.DrawString($product.Title, $titleFont, $titleBrush, 112, 742)
  $graphics.DrawString($product.Subtitle, $subtitleFont, $subtitleBrush, 114, 795)
  $graphics.DrawString("CONSTRUCTION MATERIAL", $categoryFont, $categoryBrush, 875, 805)

  $path = Join-Path $outputDirectory $product.File
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $categoryFont.Dispose()
  $subtitleFont.Dispose()
  $titleFont.Dispose()
  $categoryBrush.Dispose()
  $subtitleBrush.Dispose()
  $titleBrush.Dispose()
  $labelBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "Generated $($products.Count) product images in $outputDirectory"
