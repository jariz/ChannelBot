var request = require('request'),
  RSVP = require('rsvp'),
  schedule = require('./schedule'),
  EventSource = require('eventsource'),
  baseUrl = 'http://www.reddit.com',
  knownShadowbans = {},
  lastRedditRequestTimeByUrl = {},
  lastRedditRequestTime,
  defaultUserAgent = 'noob-nodewhal-dev-soon-to-be-ip-banned';

function NodewhalSession(userAgent) {
  var self = this;
  self.userAgent = userAgent || defaultUserAgent;
  self.session = {
    cookieJar: request.jar()
  };

  self.newSubmissions = [];
  self.login = function (username, password) {
    return self.post(baseUrl + '/api/login', {
      form: {
        api_type: 'json',
        passwd: password,
        rem: true,
        user: username
      }
    }).then(function (data) {
        if (data && data.json && data.json.errors && data.json.errors.length) {
          throw data.json.errors;
        }
        Object.keys(data.json.data).forEach(function (key) {
          self.session[key] = data.json.data[key];
        });
        return self;
      });
  };

  self.submit = function (subreddit, kind, title, urlOrText, resubmit) {
    urlOrText = urlOrText || '';
    kind = (kind || 'link').toLowerCase();
    var form = {
      api_type: 'json',
      kind: kind,
      title: title,
      sr: subreddit,
      resubmit: resubmit,
      uh: self.session.modhash
    };
    if (kind === 'self' || !urlOrText) {
      form.text = urlOrText;
    } else {
      form.url = urlOrText;
    }
    return self.post(baseUrl + '/api/submit', {form: form}).then(function (data) {
      if (data && data.json && data.json.errors && data.json.errors.length) {
        throw data.json.errors;
      }
      if (data && data.json && data.json.data) {
        return data.json.data;
      }
      return data;
    });
  };

  self.comment = function (thing_id, markdown) {
    return self.post(baseUrl + '/api/comment', {
      form: {
        api_type: 'json',
        text: markdown,
        thing_id: thing_id,
        uh: self.session.modhash
      }
    });
  };

  self.flair = function (subreddit, linkName, template, flairText) {
    return self.post(baseUrl + '/api/flair', {
      form: {
        api_type: 'json',
        link: linkName,
        r: subreddit,
        text: flairText,
        css_class: template,
        uh: self.session.modhash
      }
    })
  };

  self.aboutUser = function (username) {
    return self.get(
        baseUrl + '/user/' + username + '/about.json'
      ).then(function (json) {
        return json.data;
      });
  };

  self.submitted = function (subreddit, url) {
    url = encodeURIComponent(url);
    return self.get(baseUrl + '/r/' + subreddit + '/submit.json?url=' + url, {});
  };

  self.moderated = function() {
    return self.get(baseUrl + '/subreddits/mine/moderator.json').then(function(json) {
      return json.data.children.map(function(child) {return child.data;});
    });
  };

  self.modlog = function(name) {
    return self.get(baseUrl + '/r/' + name + '/about/log.json').then(function(json) {
      return json.data.children.map(function(child) {return child.data;});
    });
  };

  self.duplicates = function (subreddit, id) {
    if (id.indexOf('_') !== -1) {
      id = id.split('_')[1];
    }
    return self.get(baseUrl + '/r/' + subreddit + '/duplicates/' + id + '/_/.json');
  };

  self.checkForShadowban = function (username) {
    var url = baseUrl + '/user/' + username;
    return new RSVP.Promise(function (resolve, reject) {
      if (knownShadowbans[username]) {
        return reject('shadowban');
      }
      Nodewhal.respectRateLimits('get', url).then(function () {
        request(url, {}, function (error, response, body) {
          if (error) {
            reject(error);
          } else {
            if (body.indexOf('the page you requested does not exist') === -1) {
              resolve(username);
            } else {
              knownShadowbans[username] = true;
              reject('shadowban');
            }
          }
        });
      });
    });
  };

  self.listing = function (listingPath, options) {
    var url = baseUrl + listingPath + '.json',
      options = options || {},
      max = options.max,
      after = options.after,
      limit = max || 100;
    if (limit > 100) {limit = 100;}
    if (url.indexOf('?') < 0) {
      url += '?limit=' + limit;
    } else {
      url += '&limit=' + limit;
    }
    if (after) {
      url += '&after=' + after;
    }
    return self.get(url, {}).then(function (listing) {
      var results = {}, resultsLength;
      if (listing && listing.data && listing.data.children && listing.data.children.length) {
        listing.data.children.forEach(function (submission) {
          resultsLength = Object.keys(results).length;
          if (!max || resultsLength < max) {
            results[submission.data.name] = submission.data;
          }
        });
        //console.log("Length:", resultsLength);

        if (
          listing.data.after &&
            (typeof max === 'undefined' || resultsLength + 1 < max)
          ) {
          if (!typeof max === 'undefined') {
            max = max - resultsLength;
          }
          return schedule.wait(options.wait).then(function () {
            return self.listing(listingPath, {
              max: max,
              after: listing.data.after,
              wait: options.wait
            }).then(function (moreResults) {
                Object.keys(moreResults).forEach(function (key) {
                  results[key] = moreResults[key];
                });
                return results;
              })
          });
        } else {
          return results;
        }
      } else {
        return {};
      }
    });
  };

  self.startSubmissionStream = function (cb, subreddit, author, domain, is_self) {
    url = "http://api.rednit.com/submission_stream?eventsource=true";
    if (subreddit && subreddit.length) {
      subreddit = subreddit.join('+');
    }
    if (subreddit) {
      url += "&subreddit=" + subreddit;
    }
    if (author) {
      url += "&author=" + author;
    }
    if (domain) {
      url += "&domain=" + domain;
    }
    if (is_self) {
      url += "&is_self=" + is_self;
    }
//    console.log('stream start:', url);
    self.es = new EventSource(url);
    if (cb != null) {
      self.es.onmessage = function (e) {
        cb(JSON.parse(e.data));
      }
    }
    else {

      self.es.onmessage = function (e) {
        self.newSubmissions.push(JSON.parse(e.data));
      };
      self.es.onerror = function () {
//        console.log("Error in the submission stream.");
      }
    }
  };

  self.stopSubmissionStream = function () {
    self.es.close();
  };

  self.byId = function (ids) {
    var isSingle = false;
    if (typeof ids == "string") {
      ids = [ids];
      isSingle = true;
    }
    ids = ids.map(function (id) {
      if (id.substr(0, 3) == "t3_") {
        return id
      }
      else {
        return "t3_" + id;
      }
    });

    var fetch_ids_wrapper = function (u) {
      var url = u;
      return function () {
        return self.get(url, {}).then(function (listing) {
          var results = {};
          if (listing && listing.data && listing.data.children && listing.data.children.length) {
            if (isSingle) {
              return listing.data.children[0].data;
            }
            listing.data.children.forEach(function (submission) {
              results[submission.data.name] = submission.data;
            });
          }
          return results;
        });
      };
    };
    if (ids.length <= 100) {
      var url = baseUrl + "/by_id/" + ids.join(",") + '/.json';
      return fetch_ids_wrapper(url)();
    }
    else {
      var promises = [];

      for (var i = 0; i < (ids.length + 100); i += 100) {
        if (ids.slice(i, i + 101).length > 0) {
          u = baseUrl + "/by_id/" + ids.slice(i, i + 101).join(",") + '/.json?limit=100';
          promises.push(fetch_ids_wrapper(u))
        }
      }
      return schedule.runInSeries(promises).then(function (resultList) {
        var results = {};
        var len = 0;
        resultList.forEach(function (element, index, array) {
          for (attrname in element) {
            results[attrname] = element[attrname];
          }
        });

        return results;
      });

    }

  };

  self.get = function (url, opts) {
    return self.req(url, 'get', opts);
  };

  self.post = function (url, opts) {
    return self.req(url, 'post', opts);
  };

  self.req = function (url, method, opts) {
    return Nodewhal.respectRateLimits(method, url).then(function () {
      opts = opts || {};
      if (self.session && self.session.cookieJar) {
        opts.jar = self.session.cookieJar;
      }
      opts.headers = opts.headers || {};
      opts.headers['User-Agent'] = self.userAgent;
      return Nodewhal.rsvpRequest(method, url, opts);
    }).then(function (body) {
        var json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          console.error('Cant parse', url, method, opts,  body);
          throw e;
        }
        if (json && json.error) {
//          console.log('error', json);
          throw Error(json.error);
        }
        return json;
      }, function (error) {
        console.error(error.stack || error);
        throw error;
      });
  };
}

function Nodewhal(userAgent) {
  return new NodewhalSession(userAgent);
}

Nodewhal.schedule = schedule;

Nodewhal.rsvpRequest = function (method, url, opts) {
  return new RSVP.Promise(function (resolve, reject) {
    if (url.indexOf('api/login') === -1 && method === 'post') {
//      console.log(method, url, JSON.stringify(opts.form));
    } else {
//      console.log(method, url);
    }
    if (!method || method === 'get') {
      method = request;
    } else {
      method = request[method];
    }
    method(url, opts, function (error, response, body) {
      if (error) {
        reject(error);
      } else {
        resolve(body);
      }
    });
  });
};

Nodewhal.respectRateLimits = function (method, url) {
  return new RSVP.Promise(function (resolve, reject) {
    var now = new Date(),
      minInterval = 2100,
      minUrlInterval = 30100,
      lastUrlInterval, lastUrlTime = lastRedditRequestTimeByUrl[url],
      interval = now - lastRedditRequestTime;

    if (method == 'get' && lastUrlTime) {
      lastUrlInterval = now - lastUrlTime;
    }
    if (lastRedditRequestTime && interval < minInterval) {
      resolve(schedule.wait(minInterval - interval).then(function () {
        return Nodewhal.respectRateLimits(method, url);
      }));
    } else {
      if (lastUrlInterval && lastUrlInterval < minUrlInterval) {
        resolve(schedule.wait(minUrlInterval - lastUrlInterval).then(function () {
          return Nodewhal.respectRateLimits(method, url);
        }));
      } else {
        lastRedditRequestTime = now;
        lastRedditRequestTimeByUrl[url] = now;
        resolve(true);
      }
    }
  }).then(undefined, function (error) {
      if (error.stack) {
        console.error(error.stack);
      }
      throw error;
    });
};

module.exports = Nodewhal;
