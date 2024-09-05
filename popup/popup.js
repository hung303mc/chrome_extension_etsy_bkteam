$(document).on("click", "#save", async function () {
   const value = $("#api_key").val();
   if (!value.includes("etsyapi")) {
      alert("Invalid api key");
      return;
   }
   $(this).addClass("loader");
   chrome.runtime.sendMessage({
      message: "popupSaveApiKey",
      data: value,
   });
});

$(document).ready(function () {
   $("#save").addClass("loader");
   chrome.runtime.sendMessage({
      message: "popupGetApiKey",
   });
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
   console.log("popup listing: ", request);
   if (request.message === "listedSaveApiKey") {
      window.close();
   }
   if (request.message === "popupGetApiKeyValue") {
      $("#api_key").val(request.data);
      $("#save").removeClass("loader");
   }
});
