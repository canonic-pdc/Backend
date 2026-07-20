import 'tsconfig-paths/register';
import 'module-alias/register';

console.log('=== Canonic API Serverless Function Bootstrapping ===');
console.log(`Node Version: ${process.version}`);
console.log(`CWD: ${process.cwd()}`);

let app: any;
try {
  // First try loading the pre-compiled dist/app where tsc-alias has resolved all path aliases to relative paths
  app = require('../dist/app').default || require('../dist/app');
  console.log('Successfully loaded application from ../dist/app (compiled bundle)');
} catch (distError: any) {
  console.warn('Failed to load from ../dist/app, falling back to ../src/app:', distError.message);
  try {
    app = require('../src/app').default || require('../src/app');
    console.log('Successfully loaded application from ../src/app');
  } catch (srcError: any) {
    console.error('CRITICAL: Failed to load both ../dist/app and ../src/app!');
    console.error('distError:', distError);
    console.error('srcError:', srcError);
    throw srcError;
  }
}

export default app;
module.exports = app;
