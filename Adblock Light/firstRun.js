/*
 * This file is part of Adblock Light <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Light is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Light is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Light.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

(function()
{
  // Load subscriptions for features
  var featureSubscriptions = [
    {
      feature: "malware",
      homepage: "http://malwaredomains.com/",
      title: "Malware Domains",
      url: "https://easylist-downloads.adblockplus.org/malwaredomains_full.txt"
    },
    {
      feature: "social",
      homepage: "https://www.fanboy.co.nz/",
      title: "Fanboy's Social Blocking List",
      url: "https://easylist-downloads.adblockplus.org/fanboy-social.txt"
    },
    {
      feature: "tracking",
      homepage: "https://easylist.adblockplus.org/",
      title: "EasyPrivacy",
      url: "https://easylist-downloads.adblockplus.org/easyprivacy.txt"
    }
  ];

  function onDOMLoaded()
  {
    var locale = require("utils").Utils.appLocale;
    document.documentElement.setAttribute("lang", locale);

    // Set up URLs
    var donateLink = E("donate");
    donateLink.href = Utils.getDocLink("donate");

    var contributors = E("contributors");
    contributors.href = Utils.getDocLink("contributors");

    setLinks("share-headline", Utils.getDocLink("contribute"));

    // Show warning if data corruption was detected
    if (typeof backgroundPage != "undefined" && backgroundPage.seenDataCorruption)
    {
      E("dataCorruptionWarning").removeAttribute("hidden");
      setLinks("dataCorruptionWarning", Utils.getDocLink("knownIssuesChrome_filterstorage"));
    }

    // Set up feature buttons linked to subscriptions
    featureSubscriptions.forEach(setToggleSubscriptionButton);
    var filterListener = function(action)
    {
      if (/^subscription\.(added|removed|disabled)$/.test(action))
      {
        for (var i = 0; i < featureSubscriptions.length; i++)
        {
          var featureSubscription = featureSubscriptions[i];
          updateToggleButton(featureSubscription.feature, isSubscriptionEnabled(featureSubscription));
        }
      }
    }
    FilterNotifier.addListener(filterListener);
    window.addEventListener("unload", function(event)
    {
      FilterNotifier.removeListener(filterListener);
    }, false);

    // You can click activate-feature or one of the icons to toggle the features area
    E("activate-features").addEventListener("click", toggleFeature, false);
    E("can-do-more-overview").addEventListener("click", toggleFeature, false);

    initSocialLinks();
  }

  function toggleFeature()
  {
    E("can-do-more").classList.toggle("expanded");
  }

  function isSubscriptionEnabled(featureSubscription)
  {
    return featureSubscription.url in FilterStorage.knownSubscriptions
      && !Subscription.fromURL(featureSubscription.url).disabled;
  }

  function setToggleSubscriptionButton(featureSubscription)
  {
    var feature = featureSubscription.feature;

    var element = E("toggle-" + feature);
    updateToggleButton(feature, isSubscriptionEnabled(featureSubscription));
    element.addEventListener("click", function(event)
    {
      var subscription = Subscription.fromURL(featureSubscription.url);
      if (isSubscriptionEnabled(featureSubscription))
        FilterStorage.removeSubscription(subscription);
      else
      {
        subscription.disabled = false;
        subscription.title = featureSubscription.title;
        subscription.homepage = featureSubscription.homepage;
        FilterStorage.addSubscription(subscription);
        if (!subscription.lastDownload)
          Synchronizer.execute(subscription);
      }
    }, false);
  }

  function openSharePopup(url)
  {
    var iframe = E("share-popup");
    var glassPane = E("glass-pane");
    var popupMessageReceived = false;

    var popupMessageListener = function(event)
    {
      var originFilter = Filter.fromText("||adblockplus.org^");
      if (!originFilter.matches(event.origin, "OTHER", null, null))
        return;

      var width = event.data.width;
      var height = event.data.height;
      iframe.width = width;
      iframe.height = height;
      iframe.style.marginTop = -height/2 + "px";
      iframe.style.marginLeft = -width/2 + "px";
      popupMessageReceived = true;
      window.removeEventListener("message", popupMessageListener);
    };
    // Firefox requires last parameter to be true to be triggered by unprivileged pages
    window.addEventListener("message", popupMessageListener, false, true);

    var popupLoadListener = function()
    {
      if (popupMessageReceived)
      {
        iframe.className = "visible";

        var popupCloseListener = function()
        {
          iframe.className = glassPane.className = "";
          document.removeEventListener("click", popupCloseListener);
        };
        document.addEventListener("click", popupCloseListener, false);
      }
      else
      {
        glassPane.className = "";
        window.removeEventListener("message", popupMessageListener);
      }

      iframe.removeEventListener("load", popupLoadListener);
    };
    iframe.addEventListener("load", popupLoadListener, false);

    iframe.src = url;
    glassPane.className = "visible";
  }

  function initSocialLinks()
  {
    var networks = ["twitter", "facebook", "gplus"];
    networks.forEach(function(network)
    {
      var link = E("share-" + network);
      link.addEventListener("click", onSocialLinkClick, false);
    });
  }

  function onSocialLinkClick(event)
  {
    // Don't open the share page if the sharing script would be blocked
    var filter = defaultMatcher.matchesAny(event.target.getAttribute("data-script"), "SCRIPT", "adblockplus.org", true);
    if (!(filter instanceof BlockingFilter))
    {
      event.preventDefault();
      openSharePopup(Utils.getDocLink(event.target.id));
    }
  }

  function setLinks(id)
  {
    var element = E(id);
    if (!element)
    {
      return;
    }

    var links = element.getElementsByTagName("a");

    for (var i = 0; i < links.length; i++)
    {
      if (typeof arguments[i + 1] == "string")
      {
        links[i].href = arguments[i + 1];
        links[i].setAttribute("target", "_blank");
      }
      else if (typeof arguments[i + 1] == "function")
      {
        links[i].href = "javascript:void(0);";
        links[i].addEventListener("click", arguments[i + 1], false);
      }
    }
  }

  function openFilters()
  {
    if (typeof UI != "undefined")
      UI.openFiltersDialog();
    else
    {
      backgroundPage.openOptions();
    }
  }

  function updateToggleButton(feature, isEnabled)
  {
    var button = E("toggle-" + feature);
    if (isEnabled)
      button.classList.remove("off");
    else
      button.classList.add("off");
  }

  document.addEventListener("DOMContentLoaded", onDOMLoaded, false);
})();
