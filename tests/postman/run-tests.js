const newman = require('newman');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('environment', {
    alias: 'e',
    description: 'Environment to run tests against',
    type: 'string',
    default: 'local'
  })
  .option('collection', {
    alias: 'c',
    description: 'Collection to run',
    type: 'string',
    default: 'CinemaAbyss'
  })
  .option('folder', {
    alias: 'f',
    description: 'Specific folder in the collection to run',
    type: 'string'
  })
  .option('reporters', {
    alias: 'r',
    description: 'Reporters to use (comma-separated)',
    type: 'string',
    default: 'cli,htmlextra,junit'
  })
  .option('bail', {
    alias: 'b',
    description: 'Stop on first error',
    type: 'boolean',
    default: false
  })
  .option('timeout', {
    alias: 't',
    description: 'Request timeout in ms',
    type: 'number',
    default: 15000
  })
  .option('continue-on-failure', {
    alias: 'c',
    description: 'Continue workflow even if tests fail',
    type: 'boolean',
    default: true
  })
  .help()
  .alias('help', 'h')
  .argv;

// Create reports directory if it doesn't exist
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Configure Newman run
const collectionPath = path.join(__dirname, `${argv.collection}.postman_collection.json`);
const environmentPath = path.join(__dirname, `${argv.environment}.environment.json`);

// Validate files exist
if (!fs.existsSync(collectionPath)) {
  console.error(`Collection file not found: ${collectionPath}`);
  process.exit(1);
}

if (!fs.existsSync(environmentPath)) {
  console.error(`Environment file not found: ${environmentPath}`);
  process.exit(1);
}

console.log(`Using collection: ${collectionPath}`);
console.log(`Using environment: ${environmentPath}`);

// Parse reporters
const reporters = argv.reporters.split(',').map(r => r.trim());

// Configure Newman options
const newmanOptions = {
  collection: require(collectionPath),
  environment: require(environmentPath),
  reporters: reporters,
  reporter: {
    htmlextra: {
      export: path.join(reportsDir, `report-${argv.environment}-${Date.now()}.html`),
      template: 'default',
      showOnlyFails: false,
      noSyntaxHighlighting: false,
      testPaging: true,
      browserTitle: "CinemaAbyss API Test Report",
      title: "CinemaAbyss API Test Report",
      titleSize: 1,
      omitHeaders: false,
      skipHeaders: false,
      showEnvironmentData: true
    },
    junit: {
      export: path.join(reportsDir, `junit-report-${argv.environment}-${Date.now()}.xml`)
    }
  },
  bail: argv.bail,
  timeoutRequest: argv.timeout,
  delayRequest: 1000,
  suppressExitCode: argv.continueOnFailure
};

// Add folder option if specified
if (argv.folder) {
  newmanOptions.folder = argv.folder;
  console.log(`Running specific folder: ${argv.folder}`);
}

// Run Newman
console.log(`Running tests against ${argv.environment} environment...`);
console.log(`Request timeout: ${argv.timeout}ms`);
console.log(`Reporters: ${reporters.join(', ')}`);

newman.run(newmanOptions, function (err, summary) {
  if (err) { 
    console.error('Error running Newman:', err);
    process.exit(1);
  }
  
  // Log results
  console.log('\n Newman run completed!');
  console.log('='.repeat(50));
  
  const stats = summary.run.stats;
  console.log(`Total requests: ${stats.requests.total}`);
  console.log(`Passed requests: ${stats.requests.total - stats.requests.failed}`);
  console.log(`Failed requests: ${stats.requests.failed}`);
  console.log(`Total assertions: ${stats.assertions.total}`);
  console.log(`Passed assertions: ${stats.assertions.total - stats.assertions.failed}`);
  console.log(`Failed assertions: ${stats.assertions.failed}`);
  
  // Show failed tests if any
  if (summary.run.failures.length > 0) {
    console.log('\nFailed tests:');
    summary.run.failures.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure.source.name} - ${failure.error.message}`);
    });
  }
  
  // Exit with appropriate code
  const hasFailures = summary.run.failures.length > 0;
  
  if (hasFailures && !argv.continueOnFailure) {
    console.log('\nTests failed and continueOnFailure is false - exiting with error');
    process.exit(1);
  } else if (hasFailures) {
    console.log('\nTests failed but continueOnFailure is true - exiting successfully');
    process.exit(0);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
});