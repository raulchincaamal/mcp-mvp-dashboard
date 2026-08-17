$src = 'packages\mcp-main\src\orchestrator.ts'
$content = Get-Content $src -Raw -Encoding UTF8

# Fix Latin-1 misread as UTF-8 — common mojibake patterns
$fixes = @(
    # a con tilde
    @('Ã¡', 'á'), @('Ã ', 'à'),
    # e con tilde
    @('Ã©', 'é'), @('Ã¨', 'è'),
    # i con tilde
    @('Ã­', 'í'), @('Ã¬', 'ì'),
    # o con tilde
    @('Ã³', 'ó'), @('Ã²', 'ò'),
    # u con tilde
    @('Ãº', 'ú'), @('Ã¹', 'ù'), @('Ã¼', 'ü'),
    # n tilde
    @('Ã±', 'ñ'),
    # mayusculas
    @('Ã', 'Á'), @('Ã‰', 'É'), @('Ã', 'Í'), @('Ã"', 'Ó'), @('Ãš', 'Ú'), @('Ã'', 'Ñ'),
    # otros
    @('â€"', '—'), @('â€™', "'"), @('â€œ', '"'), @('â€', '"'),
    @('Â¿', '¿'), @('Â¡', '¡'),
    # emoji mojibake patterns
    @('ðŸ"Š', '📊'), @('ðŸ'°', '💰'), @('ðŸ"‹', '📋'), @('ðŸ"ˆ', '📈'), @('ðŸ"‰', '📉'),
    @('ðŸ†', '🏆'), @('ðŸ"', '📍'), @('ðŸ"…', '📅'), @('ðŸ'³', '💳'), @('ðŸš¨', '🚨'),
    @('ðŸ·ï¸', '🏷️'), @('âš ï¸', '⚠️'), @('âœ…', '✅'), @('â—', '❌'),
    @('ðŸ"Œ', '📌'), @('ðŸ'µ', '💵'), @('ðŸ"¦', '📦'), @('ðŸ'¤', '👤'),
    @('ðŸ"¡', '📡'), @('ðŸ"', '🔍'), @('ðŸ'‹', '👋'), @('â"', '❓'),
    @('ðŸ•', '🕐'), @('ðŸ"', '📌')
)

$fixed = $content
foreach ($pair in $fixes) {
    $fixed = $fixed.Replace($pair[0], $pair[1])
}

$before = ($content | Select-String -Pattern 'Ã' -AllMatches).Matches.Count
$after  = ($fixed  | Select-String -Pattern 'Ã' -AllMatches).Matches.Count

[System.IO.File]::WriteAllText((Resolve-Path $src).Path, $fixed, [System.Text.Encoding]::UTF8)
Write-Host "Fixed. Corrupted 'Ã' occurrences: $before -> $after"
