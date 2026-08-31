const fs = require('fs');
let c = fs.readFileSync('packages/mcp-main/src/orchestrator.ts', 'utf8');
const lines = c.split('\n');
let fixed = 0;

// Fix lines 688-696 (0-indexed: 687-695) that have backtick-wrapped sum/count inside template literal
for (let i = 687; i <= 696; i++) {
  if (!lines[i]) continue;
  const orig = lines[i];
  // Replace `sum` and `count` with [sum] and [count]
  lines[i] = lines[i].split('`sum`').join('[sum]').split('`count`').join('[count]');
  if (lines[i] !== orig) {
    fixed++;
    console.log('Fixed line', i + 1);
  }
}

// Also remove duplicate REGLA CRITICA line (lines 691-692 are duplicates)
// Keep line 691 (i=690), remove line 692 (i=691) if identical
if (lines[690] && lines[691] && lines[690] === lines[691]) {
  lines.splice(691, 1);
  console.log('Removed duplicate line 692');
}

c = lines.join('\n');
fs.writeFileSync('packages/mcp-main/src/orchestrator.ts', c, 'utf8');
console.log('Done. Fixed', fixed, 'lines');
