const url = window.location.href;

// Etsy > Marketing Tab > Etsy Ads > view Listing Details
if (url.includes("/your/shops/me/advertising/listings/")) {
  const cssLink = chrome.runtime.getURL(
    "assets/styles/etsy-marketing/style.css"
  );
  $('<link rel="stylesheet" type="text/css" href="' + cssLink + '" >').appendTo(
    "head"
  );
}
