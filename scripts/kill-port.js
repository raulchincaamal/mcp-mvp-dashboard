const { execSync } = require('child_process');

try {
  const out = execSync('netstat -ano', { encoding: 'utf8' });
  const lines = out.split('\n').filter(l => l.includes(':4000') && l.includes('LISTENING'));
  lines.forEach(line => {
    const pid = line.trim().split(/\s+/).pop();
    if (pid && /^\d+$/.test(pid)) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[predev] Killed process on :4000 (PID ${pid})`);
      } catch {}
    }
  });
} catch {}
