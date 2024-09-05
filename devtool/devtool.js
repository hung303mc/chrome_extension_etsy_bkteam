// chrome.devtools.panels.create(
//    "Etsy Helper",
//    "../../assets/images/48.png",
//    "devtool/htmls/panel.html",
//    function (panel) {}
// );

//Created a port with background page for continous message communication
var port = chrome.runtime.connect({ name: "captureOrders" });
// capture response request get orders
chrome.devtools.network.onRequestFinished.addListener(async function (
   netevent
) {
   const request = await netevent.request;
   const response = await netevent.response;
   if (
      !request?.url?.includes("https://www.etsy.com/api/v3/") ||
      !request?.url?.includes("/mission-control/orders?filters") ||
      response.status !== 200 ||
      !response?.content?.mimeType?.includes("application/json")
   )
      return;
   // send response to background
   netevent.getContent(function (body) {
      const orders = JSON.parse(body);
      port.postMessage({
         message: "orderInfo",
         data: orders,
      });
   });
});
