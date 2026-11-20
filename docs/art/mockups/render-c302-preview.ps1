# Renders a phase-1 preview of room C302 (layout of docs/art/mockups/room-map-style2-32px.html) from
# assets/art/sprite-map.json. Keys with no pack art are drawn as simple code placeholders, as in the mockup.
param([string]$Repo, [string]$Out, [int]$Scale = 2)
Add-Type -AssemblyName System.Drawing
$map = Get-Content (Join-Path $Repo 'assets/art/sprite-map.json') -Raw | ConvertFrom-Json
$W = 512; $H = 320
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.Clear([System.Drawing.Color]::FromArgb(255, 42, 49, 64))
$sheets = @{}
function Sheet($src, $name) {
  $k = "$src/$name"
  if (-not $sheets.ContainsKey($k)) { $sheets[$k] = [System.Drawing.Image]::FromFile((Join-Path $Repo $map.sources.$src.files.$name)) }
  $sheets[$k]
}
function Spr($key) { $s = $map.sprites.$key; if (-not $s) { throw "unknown key $key" }; $s }
# draw sprite with its top-left at (sx, sy)
function PutAt($key, $sx, $sy) {
  $s = Spr $key; $r = $s.rect
  $g.DrawImage((Sheet $s.source $s.sheet), (New-Object System.Drawing.Rectangle $sx, $sy, $r[2], $r[3]), (New-Object System.Drawing.Rectangle $r[0], $r[1], $r[2], $r[3]), [System.Drawing.GraphicsUnit]::Pixel)
}
# draw sprite so its footprint top-left lands on pixel (fx, fy)
function Put($key, $fx, $fy) { $s = Spr $key; $a = if ($s.anchor) { $s.anchor } else { @(0, 0) }; PutAt $key ($fx - $a[0]) ($fy - $a[1]) }
function Tile($key, $col, $row) { PutAt $key ($col * 32) ($row * 32) }
function C($hex, $alpha = 255) { $c = [System.Drawing.ColorTranslator]::FromHtml($hex); [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B) }
function Box($x, $y, $w, $h, $hex, $alpha = 255) { $b = New-Object System.Drawing.SolidBrush (C $hex $alpha); $g.FillRectangle($b, $x, $y, $w, $h); $b.Dispose() }

# ---- floors: work zone cols 0-10, meeting cols 11-15 rows 2-6, lounge cols 11-15 rows 7-9
for ($r = 2; $r -lt 10; $r++) { for ($c = 0; $c -lt 16; $c++) {
  $k = if ($c -le 10) { 'floor.carpet' } elseif ($r -le 6) { 'floor.carpet.alt' } else { 'floor.wood' }
  Tile $k $c $r } }
# ---- walls: back wall rows 0-1 with windows, side walls, front wall with a door gap at cols 12-13
Tile 'wall.corner.nw' 0 0; Tile 'wall.corner.nw.face' 0 1
for ($c = 1; $c -lt 15; $c++) {
  if ($c -in 2, 3, 7, 8) { Tile 'window.single.top' $c 0; Tile 'window.single' $c 1 } else { Tile 'wall.top' $c 0; Tile 'wall.face' $c 1 } }
Tile 'wall.corner.ne' 15 0; Tile 'wall.corner.ne.face' 15 1
for ($r = 2; $r -lt 9; $r++) { Tile 'wall.side.w' 0 $r; Tile 'wall.side.e' 15 $r }
Tile 'wall.corner.sw' 0 9; Tile 'wall.corner.se' 15 9
for ($c = 1; $c -lt 15; $c++) { if ($c -eq 11) { Tile 'wall.front.end.e' $c 9 } elseif ($c -eq 14) { Tile 'wall.front.end.w' $c 9 } elseif ($c -notin 12, 13) { Tile 'wall.front' $c 9 } }

# ---- code placeholders (keys the packs do not cover)
function Avatar($x, $y, $seed, $front) {
  $skin = '#f6d0b1', '#e8b48f', '#c98e66', '#8d5a3b'; $hair = '#2b2118', '#5a3a22', '#b07a3a', '#1f2a44'; $shirt = '#e05d5d', '#3a7bd5', '#2fa36b', '#8e5bd6', '#f0a03c'
  $sk = $skin[$seed % 4]; $hr = $hair[($seed + 1) % 4]; $sh = $shirt[$seed % 5]
  Box ($x - 1) ($y - 1) 20 26 '#2a3140'
  Box ($x + 2) ($y + 12) 14 10 $sh; Box $x ($y + 13) 18 7 $sh
  if ($front) { Box ($x + 3) $y 12 6 $hr; Box ($x + 4) ($y + 4) 10 7 $sk; Box ($x + 6) ($y + 7) 2 2 '#2a3140'; Box ($x + 10) ($y + 7) 2 2 '#2a3140' }
  else { Box ($x + 3) $y 12 11 $hr }
}
function Rack($x, $y) { Box ($x - 1) ($y - 1) 28 52 '#2a3140'; Box $x $y 26 50 '#353b45'; for ($i = 0; $i -lt 7; $i++) { Box ($x + 3) ($y + 6 + $i * 6) 20 4 '#4a515d'; Box ($x + 4) ($y + 7 + $i * 6) 1 1 '#5ee08f' } }
function Phone($x, $y) { Box ($x - 1) ($y - 1) 14 9 '#2a3140'; Box $x $y 12 7 '#353b45'; Box ($x + 7) ($y + 2) 4 1 '#3b7dd4' }
function Sofa($x, $y) { Box ($x - 1) ($y - 1) 94 36 '#2a3140'; Box $x ($y + 6) 92 28 '#4462b5'; Box ($x + 4) $y 84 14 '#5a7bd6'; Box ($x + 10) ($y + 14) 72 16 '#7d98e3' }
function CoffeeTable($x, $y) { Box ($x - 1) ($y - 1) 42 20 '#2a3140'; Box $x $y 40 14 '#ead9c0'; Box $x ($y + 14) 40 4 '#cdb995' }

# ---- work zone: two pods; row 0 sits north of its desk (faces south), row 1 sits south (faces north)
$seats = @(
  @{ col = 1; row = 0; state = 'occ'; seed = 3; dev = @('mon', 'pc') }, @{ col = 3; row = 0; state = 'empty'; dev = @('mon') },
  @{ col = 6; row = 0; state = 'mine'; seed = 5; dev = @('mon', 'lap') }, @{ col = 8; row = 0; state = 'cannot'; dev = @() },
  @{ col = 1; row = 1; state = 'pending'; dev = @('mon') }, @{ col = 3; row = 1; state = 'occ'; seed = 2; dev = @('lap', 'phone') },
  @{ col = 6; row = 1; state = 'empty'; dev = @() }, @{ col = 8; row = 1; state = 'occ'; seed = 7; dev = @('mon', 'pc', 'phone') })
$Y0 = 96; $Y1 = 128   # footprint top of the row-0 and row-1 desks
Rack 322 40           # rack.server placeholder at the edge of the work zone
foreach ($s in $seats | Where-Object { $_.row -eq 0 }) { $x = $s.col * 32; Put 'chair.office.s' ($x + 16) ($Y0 - 32); if ($s.state -eq 'occ' -or $s.state -eq 'mine') { Avatar ($x + 23) ($Y0 - 30) $s.seed $true } }
foreach ($s in $seats | Where-Object { $_.row -eq 0 }) { $x = $s.col * 32; Put 'desk.single.n' $x $Y0 }
foreach ($s in $seats | Where-Object { $_.row -eq 0 }) { $x = $s.col * 32; $top = $Y0 - 19
  if ($s.dev -contains 'mon') { PutAt 'device.monitor.n' ($x + $(if ($s.dev -contains 'lap') { 4 } else { 16 })) ($top + 2) }
  if ($s.dev -contains 'lap') { PutAt 'device.laptop.n' ($x + 38) ($top + 10) }
  if ($s.dev -contains 'pc') { Box ($x + 50) ($top + 2) 10 20 '#2a3140'; Box ($x + 51) ($top + 3) 8 18 '#353b45'; Box ($x + 57) ($top + 18) 1 1 '#5ee08f' } }
foreach ($s in $seats | Where-Object { $_.row -eq 1 }) { $x = $s.col * 32; Put 'desk.single.s' $x $Y1 }
foreach ($s in $seats | Where-Object { $_.row -eq 1 }) { $x = $s.col * 32; $top = $Y1 - 21
  if ($s.dev -contains 'mon') { PutAt 'device.monitor.s' ($x + 16) ($top - 4) }
  if ($s.dev -contains 'lap') { PutAt 'device.laptop.s' ($x + 20) ($top + 2) }
  if ($s.dev -contains 'pc') { Box ($x + 50) ($top - 6) 10 20 '#2a3140'; Box ($x + 51) ($top - 5) 8 18 '#353b45'; Box ($x + 57) ($top + 10) 1 1 '#5ee08f' }
  if ($s.dev -contains 'phone') { Phone ($x + 3) ($top + 6) }
  if ($s.state -eq 'occ') { PutAt 'prop.mug' ($x + 46) ($top + 4) } }
foreach ($s in $seats | Where-Object { $_.row -eq 1 }) { $x = $s.col * 32; Put 'chair.office.n' ($x + 16) ($Y1 + 32); if ($s.state -eq 'occ') { Avatar ($x + 23) ($Y1 + 30) $s.seed $false } }
# overlays (code-drawn in every phase)
foreach ($s in $seats) { $x = $s.col * 32; $dy = if ($s.row -eq 0) { $Y0 - 30 } else { $Y1 - 22 }
  if ($s.state -eq 'mine') { Box ($x + 1) $dy 62 58 '#14b8a6' 46 }
  if ($s.state -eq 'cannot') { $b = New-Object System.Drawing.SolidBrush (C '#ef4444'); $g.FillEllipse($b, $x + 24, $dy + 14, 15, 15); $b.Dispose(); Box ($x + 27) ($dy + 20) 9 3 '#ffffff' }
  if ($s.state -eq 'pending') { Box ($x + 44) ($Y1 + 20) 14 11 '#f59e0b'; Box ($x + 46) ($Y1 + 31) 4 3 '#f59e0b'; Box ($x + 50) ($Y1 + 22) 2 5 '#ffffff'; Box ($x + 50) ($Y1 + 28) 2 2 '#ffffff' } }

# ---- storage and plants in the work zone
Put 'cabinet.filing.s' 32 256; Put 'cabinet.filing.s' 64 256
Put 'plant.small' 128 256; Put 'plant.large' 288 256

# ---- meeting zone: 3x2 table, 3 chairs each side
foreach ($c in 12, 13, 14) { Put 'chair.office.s' ($c * 32) 64 }
Put 'table.meeting.s' 384 96
PutAt 'device.laptop.s' 404 86; PutAt 'prop.mug' 446 96; PutAt 'prop.papers' 420 108
foreach ($c in 12, 13, 14) { Put 'chair.office.n' ($c * 32) 160 }
Put 'plant.large' 352 64; Put 'plant.small' 352 192

# ---- lounge: sofa and coffee table are placeholders (not in the free pack)
CoffeeTable 410 236; Sofa 384 264; Put 'plant.large' 448 224

$big = New-Object System.Drawing.Bitmap ($W * $Scale), ($H * $Scale)
$g2 = [System.Drawing.Graphics]::FromImage($big)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g2.DrawImage($bmp, 0, 0, $W * $Scale, $H * $Scale)
$big.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose(); $big.Dispose(); $g.Dispose(); $bmp.Dispose(); foreach ($v in $sheets.Values) { $v.Dispose() }
"wrote $Out"
