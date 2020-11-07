const bunyan = require('bunyan'),
  bformat = require('bunyan-format'),
  formatOut = bformat({ outputMode: 'short' });
let logger;

if (!logger) {
  logger = bunyan.createLogger({
    name: 'core',
    stream: formatOut,
    level: (function () {
      switch (process.env.NODE_ENV) {
        case 'production':
          return 'info';
        case 'development':
          return 'debug';
        default:
          return 'info';
      }
    })()
  });
}

module.exports = logger;
