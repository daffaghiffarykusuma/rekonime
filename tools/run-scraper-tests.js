import { spawnSync } from 'node:child_process';

const COMMANDS = process.platform === 'win32'
  ? [
      { file: 'python', args: ['-m', 'unittest', 'discover', '-s', 'tools/scraper/tests', '-p', 'test_*.py'] },
      { file: 'python3', args: ['-m', 'unittest', 'discover', '-s', 'tools/scraper/tests', '-p', 'test_*.py'] },
      { file: 'py', args: ['-3', '-m', 'unittest', 'discover', '-s', 'tools/scraper/tests', '-p', 'test_*.py'] }
    ]
  : [
      { file: 'python3', args: ['-m', 'unittest', 'discover', '-s', 'tools/scraper/tests', '-p', 'test_*.py'] },
      { file: 'python', args: ['-m', 'unittest', 'discover', '-s', 'tools/scraper/tests', '-p', 'test_*.py'] }
    ];

const PYTHON_MISSING_PATTERNS = [
  /python was not found/i,
  /is not recognized as the name of a cmdlet/i,
  /command not found/i,
  /no such file or directory/i
];

const isMissingInterpreter = (output) => {
  const text = String(output || '').trim();
  if (!text) return false;
  return PYTHON_MISSING_PATTERNS.some((pattern) => pattern.test(text));
};

const run = ({ file, args }) => {
  const result = spawnSync(file, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error) {
    return { matched: false, status: 1 };
  }

  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const combined = `${stdout}\n${stderr}`.trim();

  if (result.status !== 0 && isMissingInterpreter(combined)) {
    return { matched: false, status: result.status ?? 1 };
  }

  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }
  return { matched: true, status: result.status ?? 1 };
};

let matched = false;
let exitStatus = 1;

for (const command of COMMANDS) {
  const result = run(command);
  if (!result.matched) {
    continue;
  }
  matched = true;
  exitStatus = result.status;
  break;
}

if (!matched) {
  console.error('Unable to find a Python interpreter for scraper tests. Tried:');
  COMMANDS.forEach(({ file, args }) => {
    console.error(`- ${file} ${args.join(' ')}`);
  });
  process.exitCode = 1;
} else {
  process.exitCode = exitStatus;
}
