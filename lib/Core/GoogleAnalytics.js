"use strict";

/*global ga*/
var defaultValue = require("terriajs-cesium/Source/Core/defaultValue").default;
var defined = require("terriajs-cesium/Source/Core/defined").default;
const i18next = require("i18next").default;

var GoogleAnalytics = function() {
  this.key = undefined;
  this.options = undefined;
};

GoogleAnalytics.prototype.start = function(userParameters) {
  this.key = userParameters.googleAnalyticsKey;
  this.options = userParameters.googleAnalyticsOptions;

  if (process.env.NODE_ENV === "development") {
    console.log(i18next.t("core.googleAnalytics.logEnabledOnDevelopment"));
  }
};

GoogleAnalytics.prototype.logEvent = function(category, action, label, value) {
  initializeGoogleAnalytics(this);

  gtag("event", action, {
    event_category: category,
    event_label: label,
    value: value
  });
};

function initializeGoogleAnalytics(that) {
  if (defined(window.gtag)) {
    return;
  }
  if (!defined(that.key)) {
    console.log(i18next.t("core.googleAnalytics.log"));
    window.gtag = function() {};
    return;
  }

  (function(i, s, o, g, r, a, m) {
    a = s.createElement(o);
    m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m);
  })(
    window,
    document,
    "script",
    `https://www.googletagmanager.com/gtag/js?id=${that.key}`,
    "gtag"
  );
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    dataLayer.push(arguments);
  };
  gtag("js", new Date());
  gtag("config", that.key);
}

module.exports = GoogleAnalytics;
