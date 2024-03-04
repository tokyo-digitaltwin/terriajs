"use strict";

import i18next from "i18next";
import ReactGA from "react-ga4";
import { Analytics, ConfigParameters } from "../Models/Terria";
import isDefined from "./isDefined";

type GoogleAnalyticsConfigParameters = Pick<
  ConfigParameters,
  "enableConsoleAnalytics" | "googleAnalyticsKey" | "googleAnalyticsOptions"
>;

export default class GoogleAnalytics implements Analytics {
  key: string | undefined = undefined;
  options: any = undefined;

  start(configParameters: GoogleAnalyticsConfigParameters) {
    this.key = configParameters.googleAnalyticsKey;
    this.options = configParameters.googleAnalyticsOptions;

    if (process.env.NODE_ENV === "development") {
      console.log(i18next.t("core.googleAnalytics.logEnabledOnDevelopment"));
    }
    initializeGoogleAnalytics(this);
  }

  logEvent(category: string, action: string, label?: string, value?: number) {
    const fieldObject: any = {
      hitType: "event",
      eventCategory: category,
      eventAction: action
    };
    if (label) {
      fieldObject.eventLabel = label;
    }
    if (isDefined(value)) {
      fieldObject.value = value;
    }
    ReactGA.send(fieldObject);
  }
}

function initializeGoogleAnalytics(that: GoogleAnalytics) {
  // Cookie拒否によりwindow.gtag = {}になっていたら何もしない
  if (isDefined((window as any).gtag)) {
    return;
  }

  if (!isDefined(that.key)) {
    console.log(i18next.t("core.googleAnalytics.log"));
    return;
  }
  ReactGA.initialize(that.key, {
    gaOptions: { anonymizeIp: true, ...(that.options ?? {}) },
    gtagOptions: {
      send_page_view: false
    }
  });
  ReactGA.send({ hitType: "pageview" });

  // クロスドメイン集計用
  const gtag:any = (window as any).gtag;
  gtag("js", new Date());
  gtag("config", that.key);

  gtag('config', 'UA-196433925-1');
  gtag('config', 'G-R074JDNDN9');
  gtag('config', 'UA-196433925-3', {
    'linker': {
    'accept_incoming': true,
    'domains': ['3dview.tokyo-digitaltwin.metro.tokyo.lg.jp', 'info.tokyo-digitaltwin.metro.tokyo.lg.jp']
    }
  });
  // クロスドメイン集計用 ここまで



}
