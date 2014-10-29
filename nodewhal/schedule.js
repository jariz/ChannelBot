var RSVP = require('rsvp');

var schedule = module.exports = {
  wait: function(milliseconds) {
    return new RSVP.Promise(function(resolve, reject) {
      setTimeout(resolve, milliseconds || 1);
    }).then(undefined, function(error) {
      if (error.stack) {
        console.error(error.stack);
      }
      throw error;
    });
  },

  runInParallel: function(promiseFunctions) {
    return new RSVP.Promise(function(resolve, reject) {
      RSVP.all(promiseFunctions.map(function(func) {
        return func().then(undefined, function(error) {
          if (error.stack) {
            console.error(error.stack);
          }
          throw error;
        });
      })).then(resolve, reject);
    });
  },

  runInSeries: function (promiseFunctions, interval) {
    promiseFunctions = (promiseFunctions || []).slice(0);
    return new RSVP.Promise(function(resolve, reject) {
      var results = [];
      interval = interval || 0;
      if (!promiseFunctions.length) {
        resolve([]);
      }

      function runNext() {
        return schedule.wait(interval).then(function() {
          var func = promiseFunctions.pop(), promise;
          if (func && (func.call || func.then)) {
            if (!func.call) {
              promise = func;
              func  = function() {return promise;};
            }
            var result = func();
            if (result && result.then) {
              return result.then(function(result) {
                results.push(result);
              }).then(runNext, function(error) {
                if (error.stack) {
                  console.error(error.stack);
                }
                  return runNext();
                });
            } else {
              console.error('Result of ', func, 'is not a promise', result);
              return runNext();
            }
          } else if (func) {
            console.error('Not a function or promise', func);
          }
          return results;
        });
      }
      resolve(runNext())
    }).then(undefined, function(error) {
      if (error.stack) {
        console.error(error.stack);
      }
      throw error;
    });
  },

  repeat: function(promiseFunc, interval)  {
    try {
      var promise = promiseFunc();
      interval = interval || 0;
      function runNext() {
        schedule.wait(interval).then(function() {
          schedule.repeat(promiseFunc, interval);
        }, function(error) {
          if (error.stack) {
            console.error(error.stack);
          } else {
            console.log(error);
          }
          schedule.repeat(promiseFunc, interval);
        });
      }
      promise.then(runNext, function(error) {
        if (error.stack) {
          console.error(error, error.stack);
        }
        runNext();
      });
      return promise;
    } catch(e) {
      if (e.stack) {
        console.error(e.stack);
      }
      throw e;
    }
  }
};
