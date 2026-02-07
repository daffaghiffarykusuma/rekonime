import { execFileSync } from 'node:child_process';

const runGitStatus = () => {
  try {
    return execFileSync('git', [
      'status',
      '--porcelain',
      '--untracked-files=no',
      '--',
      '.',
      ':(exclude)dist/**',
      ':(exclude)coverage/**'
    ], { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Unable to run git status check:', error.message || error);
    process.exitCode = 1;
    return null;
  }
};

const output = runGitStatus();
if (output === null) {
  process.exit();
}

if (output) {
  console.error('Build produced tracked source changes outside dist/ and coverage/:');
  console.error(output);
  process.exitCode = 1;
} else {
  console.log('Build cleanliness check passed.');
}
