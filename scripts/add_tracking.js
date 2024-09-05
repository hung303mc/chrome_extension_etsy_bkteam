const detectCarrierCode = (tracking = "") => {
   tracking = String(tracking).trim();
   const trackLen = tracking.length;
   if (tracking.startsWith("RS")) {
      return "deutsche-post";
   }
   if (tracking.startsWith("LG")) {
      return "royal-mail";
   }

   // 6WAAO66AYD0PNL1CP6L8AV
   // 64XM724WNCWHEKJDJQFF3D
   // 1ZLSR5ANJXWDWR03JZEKV8
   // 3QYRX9FKXXJ2RJ7RDPSYMJ
   if (trackLen === 22 && !["92", "93", "94"].some((i) => tracking.startsWith(i))) {
      // Asendia USA
      return "asendia-usa";
   }

   // LF068163130FR |
   // LF068162678FR
   // LV771053632US
   // LF068324279FR
   if (tracking.startsWith("L") && trackLen == 13) {
      return "asendia";
   }

   // 420712919374811015300249592366 (22471845) => dhl_ecommerce | tracking_url => "https://webtrack.dhlglobalmail.com/orders?trackingNumber=420712919374811015300249592366"
   // TODO: 420531859374811015300513088939 => dhl_ecommerce
   if (tracking.startsWith("92")) {
      return "usps";
   }

   // 4206401592748903198293100006411915
   if (tracking.startsWith("420") && (trackLen === 30 || trackLen === 34)) {
      return "dhl";
   }

   const allowedString = [
      "GM",
      "LX",
      "RX",
      "UV",
      "CN",
      "SG",
      "TH",
      "IN",
      "HK",
      "MY",
      "42",
      "92",
   ];
   if (tracking.length < 2) {
      return "";
   }
   tracking = tracking.toUpperCase();
   const start = tracking.slice(0, 2);
   if (tracking.startsWith("1Z") || start.includes("80")) {
      return "ups";
   }
   if (tracking.startsWith("303")) {
      return "4px";
   }
   if (
      (start === "94" || start === "93" || start === "92") &&
      tracking.length !== 10
   ) {
      return "usps";
   }
   if (allowedString.includes(start)) {
      if (tracking.length > 12) {
         return "dhlglobalmail";
      }
   }
   if (start === "UE" || start === "UF") {
      return "yanwen";
   }
   if (start === "SF") {
      return "sfb2c";
   }
   if (start === "61" || (start === "77" && tracking.length == 12)) {
      return "fedex";
   }
   if (start === "23") {
      return "japan-post";
   }
   if (start === "YT") {
      return "yunexpress";
   }
   if (start === "US") {
      return "jetlogistic";
   }
   if (
      ["82", "69", "30", "75"].includes(start) ||
      tracking.length === 10 ||
      tracking.length === 8
   ) {
      return "dhl";
   }
   return "china-ems";
};

const detectCarrierValue = (carrierCode = "") => {
   switch (carrierCode) {
      case "usps":
         return 1;
      case "ups":
         return 2;
      case "fedex":
         return 3;
      case "dhl":
         return 4;
      case "asendia-usa":
         return 114;
      case "asendia":
         return -1;
      default:
         break;
   }
   return 0;
};

const mapCarrierName = (carrier) => {
   switch (carrier) {
      case "asendia":
         return "Asendia";
      case "usps":
         return "USPS";
      case "ups":
         return "UPS";
      default:
         break;
   }
};

// etsyapi-e9928cd4-43d3-41c5-98d9-0388e1fb4908
const executeAddTracking = async (orderId, tracking, carrier = "") => {
   if (!orderId) {
      notifyError("Order not found.");
      return;
   }
   if (!tracking) {
      notifyError("Tracking Order not found.");
      return;
   }
   if (tracking.startsWith("YT")) {
      notifyError("Invalid Tracking Order.");
      return;
   }

   // map carrierCode via `shipping_carrier_code` else detect from `tracking_number`
   let carrierCode = "";
   let carrierName = "";
   if (carrier) {
      const carrierLowerCase = carrier.toLowerCase(); // case: Customcat return `coder` (vendor) is Uppercase
      carrierCode = detectCarrierValue(carrierLowerCase);
      carrierName = mapCarrierName(carrierLowerCase);
   }

   if (!carrierCode) {
      carrierCode = detectCarrierValue(detectCarrierCode(tracking));
      carrierName = mapCarrierName(detectCarrierCode(tracking));
   }

   // const carrierCode = detectCarrierValue(detectCarrierCode(tracking));
   if (!carrierCode) {
      notifyError("Could not detect carrier from tracking.");
      return;
   }
   // click btn update progress
   // const btnUpdateProgressXpath = `.flag-img [role="tablist"][data-order-id="${orderId}"] .wt-mb-xs-1:nth-child(2) button`;
   const btnUpdateProgressXpath = `.flag-img[data-order-id="${orderId}"] .wt-mb-xs-1:nth-child(2) button`;
   let timeOutBtnUpdateProgress = 0;
   while (true) {
      if (timeOutBtnUpdateProgress == 60) {
         notifyError("Order not found.");
         return;
      }
      if ($(btnUpdateProgressXpath).length) break;
      await sleep(500);
      timeOutBtnUpdateProgress++;
   }
   $(btnUpdateProgressXpath).trigger("click");
   // check has option progress
   const progressOptionXpath = `.flag-img[data-order-id="${orderId}"] .list-unstyled li:last-child .btn-primary`;
   if ($(progressOptionXpath).length) {
      let timeOutOrderInfo = 0;
      while (true) {
         if (timeOutOrderInfo == 60) {
            notifyError("Could not open progress options.");
            return;
         }
         if ($(progressOptionXpath).length) break;
         await sleep(500);
         timeOutOrderInfo++;
      }
      // click btn complete order
      const btnCompleteElem = document.querySelector(progressOptionXpath);
      const btnCompleteEvent = document.createEvent("HTMLEvents");
      btnCompleteEvent.initEvent("click", true, true);
      btnCompleteElem.dispatchEvent(btnCompleteEvent);
   }
   // wait modal add tracking
   let timeOutModalTracking = 0;
   while (true) {
      if (timeOutModalTracking == 60) {
         notifyError("Could not open model add tracking.");
         return;
      }
      if ($("#mark-as-complete-overlay").length) break;
      await sleep(500);
      timeOutModalTracking++;
   }
   // wait shipping carrier
   let timeOutCarrierSelect = 0;
   while (true) {
      if (timeOutCarrierSelect == 30) {
         notifyError("Could not find select carrier.");
         return;
      }
      if ($("#shipping-carrier-select").length) break;
      await sleep(500);
      timeOutCarrierSelect++;
   }
   const carrierOptionXpath = `#shipping-carrier-select option[value="${carrierCode}"]`;
   if (!$(carrierOptionXpath).length) {

      // case: cannot find option for carrier `acc khác ngoài us thì nó k nhận diện đc USPS`
      const carrierOther = `#shipping-carrier-select option[value="-1"]`;
      carrierCode = -1;

      console.log('carrierOther === ', carrierOther);
      if (!$(carrierOther).length) {
         notifyError("Carrier not found.");
         return;
      }
   }
   // select carrier
   // const carrierElem = document.querySelector(carrierOptionXpath);
   // carrierElem.value = carrierCode;

   // === 02/11/23
   const $select = document.querySelector("#shipping-carrier-select");
   const $options = Array.from($select.options);
   for (let opt of $options) {
      opt.selected = opt.value == carrierCode ? true : false;
   }

   $select.value = carrierCode;

   const carrierEvent = document.createEvent("HTMLEvents");
   carrierEvent.initEvent("change", true, true);
   // carrierElem.dispatchEvent(carrierEvent);

   $select.dispatchEvent(carrierEvent);

   if (carrierCode === -1 && carrierName) {
      await sleep(1000);
      const carrierXpath = `#mark-as-complete-overlay input[name="carrierName-${orderId}"]`;
      let timeOutTrackingInput = 0;
      while (true) {
         if (timeOutTrackingInput == 30) {
            notifyError("Could not find carrier input.");
            return;
         }
         if ($(carrierXpath).length) break;
         await sleep(500);
         timeOutTrackingInput++;
      }
      const carrierInputEle = $(carrierXpath);
      carrierInputEle.focus();
      carrierInputEle.val("");
      document.execCommand("insertText", false, carrierName);
      carrierInputEle.blur();
   }
   await sleep(1000);

   // enter tracking
   const trackingXpath = `#mark-as-complete-overlay input[name="trackingCode-${orderId}"]`;
   let timeOutTrackingInput = 0;
   while (true) {
      if (timeOutTrackingInput == 30) {
         notifyError("Could not find tracking input.");
         return;
      }
      if ($(trackingXpath).length) break;
      await sleep(500);
      timeOutTrackingInput++;
   }
   const trackingInputElem = $(trackingXpath);
   trackingInputElem.focus();
   trackingInputElem.val("");
   document.execCommand("insertText", false, tracking);
   trackingInputElem.blur();

   await sleep(1000);
   // submit add tracking
   const btnXpath =
      "#mark-as-complete-overlay .wt-overlay__footer__action .wt-btn--filled";
   let timeOutBtn = 0;
   while (true) {
      if (timeOutBtn == 30) {
         notifyError("Button Complete Order not found.");
         return;
      }
      if ($(btnXpath).length) break;
      await sleep(500);
      timeOutBtn++;
   }
   $(btnXpath).trigger("click");
   // show response success
   $(`#add_tracking tr[data-order-id="${orderId}"]`).remove();
   if ($(`#add_tracking tr`).length == 0) {
      $(".btn-add-tracking-wrap").css("display", "none");
      if (!$("#add_tracking .om-not-found-wrap").length)
         $("#add_tracking .table_wrap").append(orderNotFound);
   }
   notifySuccess("Add tracking success.");
   await sleep(1000);
};

const setTextBtnAddTrack = () => {
   let hasChecked = false;
   $(".force-add-tracking-item .om-checkbox").each(function () {
      if ($(this).is(":checked")) {
         hasChecked = true;
         return false;
      }
   });
   if (hasChecked) $("#add-trackings").text("Add Tracks Selected Orders");
   else $("#add-trackings").text("Add Trackings");
};

// checked force add tracking
$(document).on(
   "click",
   ".force-add-tracking-all-item .om-checkbox",
   async function () {
      if ($(this).is(":checked"))
         $(".force-add-tracking-item .om-checkbox").each(function () {
            if (!$(this).is(":checked")) $(this).click();
         });
      else
         $(".force-add-tracking-item .om-checkbox").each(function () {
            if ($(this).is(":checked")) $(this).click();
         });
      setTextBtnAddTrack();
   },
);

// checked force add all tracking
$(document).on("click", ".force-add-tracking-item .om-checkbox", function () {
   setTextBtnAddTrack();
});

$(document).on("click", ".add-tracking-item", async function () {
   const orderId = $(this).attr("data-order-id");
   const tracking = $(this).attr("data-tracking");
   const carrier = $(this).attr("data-carrier");
   if (!orderId) {
      notifyError("Order not found.");
      return;
   }
   if (!tracking) {
      notifyError("Tracking Order not found.");
      return;
   }
   await fetchTrackChinaToUS();
   if ($(`#add_tracking tr[data-order-id="${orderId}"]`).length == 0) {
      notifyError("Order without US tracking code.");
      return;
   }
   $("#add-trackings").addClass("loader");
   $(this).addClass("loader");
   await executeAddTracking(orderId, tracking, carrier);
   $(this).removeClass("loader");
   $("#add-trackings").removeClass("loader");
});

$(document).on("click", "#add-trackings", async function () {
   await fetchTrackChinaToUS();
   const orders = [];
   // check sync order specify
   let isAddTrackingSpecify = false;
   $(".force-add-tracking-item .om-checkbox").each(function () {
      if ($(this).is(":checked")) {
         isAddTrackingSpecify = true;
         return false;
      }
   });
   $(".force-add-tracking-item .om-checkbox").each(function () {
      const orderId = $(this).attr("data-order-id");
      const tracking = $(this).attr("data-tracking");
      const carrier = $(this).attr("data-carrier");
      if (!orderId || !tracking) return true;
      if (isAddTrackingSpecify) {
         if ($(this).is(":checked"))
            orders.push({ orderId, tracking, carrier });
         return true;
      }
      orders.push({ orderId, tracking, carrier });
   });
   if (orders.length == 0) {
      notifyError("Order not found.");
      return;
   }
   $(this).addClass("loader");
   for (const { orderId, tracking, carrier } of orders) {
      $(`.add-tracking-item[data-order-id="${orderId}"]`).addClass("loader");
      await executeAddTracking(orderId, tracking, carrier);
      await sleep(4000);
      $(`.add-tracking-item[data-order-id="${orderId}"]`).removeClass("loader");
   }
   $(this).removeClass("loader");
});

const trackChinaToUS = {
   trackings: [],
   fetched: false,
};
const fetchTrackChinaToUS = async () => {
   const trackings = [];
   $(".force-add-tracking-item .om-checkbox").each(function () {
      const tracking = $(this).attr("data-tracking");
      if (tracking.startsWith("YT")) trackings.push(tracking);
   });
   if (trackings.length == 0) return;
   const endpoint = `https://www.yuntrack.com/parcelTracking?id=${trackings.join(
      ",",
   )}`;
   chrome.runtime.sendMessage({
      message: "fetchTrackChinaToUS",
      data: {
         endpoint,
      },
   });
   while (true) {
      await sleep(1000);
      if (trackChinaToUS.fetched) break;
   }
   for (const tracking of trackings) {
      let isValid = false;
      for (const { oldTrack, newTrack } of trackChinaToUS.trackings) {
         if (tracking == oldTrack) {
            isValid = true;
            const orderId = $(
               `.force-add-tracking-item [data-tracking="${oldTrack}"] `,
            ).attr("data-order-id");
            $(`.force-add-tracking-item [data-tracking="${oldTrack}"]`).attr(
               "data-tracking",
               newTrack,
            );
            $(
               `#add_tracking [data-order-id="${orderId}"] .om-tracking-tag:last-child`,
            ).text(newTrack);
            $(`.add-tracking-item [data-tracking="${oldTrack}"]`).attr(
               "data-tracking",
               newTrack,
            );
         }
      }
      if (!isValid) {
         const orderId = $(
            `.force-add-tracking-item [data-tracking="${tracking}"] `,
         ).attr("data-order-id");
         $(`#add_tracking tr[data-order-id="${orderId}"]`).remove();
      }
   }

   const res = [...trackChinaToUS.trackings];
   trackChinaToUS.trackings = [];
   trackChinaToUS.fetched = false;
   return res;
};

chrome.runtime.onMessage.addListener(async function (req, sender, res) {
   const { message, data } = req || {};
   if (message === "fetchTrackChinaToUS") {
      res({ message: "received" });
      let validTracks = [];
      let countTimeout = 0;
      let isValid = false;
      while (true) {
         if (countTimeout == 30) break;
         if ($(".el-table__row").length > 0) {
            isValid = true;
            break;
         }
         countTimeout++;
         await sleep(1000);
      }
      if (isValid) {
         for (let i = 1; i <= $(".el-table__row").length; i++) {
            let oldTrack = $(
               `.el-table__row:nth-child(${i}) td:nth-child(2) .cell>div:nth-child(1)`,
            ).text();
            let newTrack = $(
               `.el-table__row:nth-child(${i}) td:nth-child(4) .cell>div:nth-child(1)`,
            ).text();
            if (!oldTrack || !newTrack) continue;
            newTrack = newTrack.trim();
            if (!newTrack.startsWith("92")) continue;
            validTracks.push({ oldTrack, newTrack });
         }
      }
      chrome.runtime.sendMessage({
         message: "fetchedTrackChinaToUS",
         data: { ...data, validTracks },
      });
   }
   if (message === "fetchedTrackChinaToUS") {
      res({ message: "received" });
      const { validTracks } = data;
      trackChinaToUS.trackings = validTracks;
      trackChinaToUS.fetched = true;
   }
});

const compareValues = (val1, val2) => {
   return (val1 || "").toLowerCase() === (val2 || "").toLowerCase();
};

{
   /* <optgroup label="Select shipping carrier">
  <option value="1">USPS</option>
  <option value="115">LaserShip</option>
  <option value="116">ABF Freight</option>
  <option value="120">OnTrac</option>
  <option value="112">Direct Link</option>
  <option value="113">YRC Freight</option>
  <option value="114">Asendia USA</option>
  <option value="121">UPS Freight</option>
  <option value="331">Skynet Worldwide Express</option>
  <option value="122">Evergreen</option>
  <option value="123">Estes</option>
  <option value="124">RL Carriers</option>
  <option value="308">i-parcel</option>
  <option value="311">APC Postal Logistics</option>
  <option value="326">Greyhound</option>
  <option value="353">uShip</option>
  <option value="354">Amazon Logistics US</option>
  <option value="356">Freightquote by C. H. Robinson</option>
  <option value="365">Courier Express</option>
  <option value="368">ePost Global</option>
  <option value="370">FedEx Cross Border</option>
  <option value="371">UDS</option>
  <option value="372">Spee-Dee</option>
  <option value="373">Better Trucks</option>
  <option value="374">GSO</option>
  <option value="375">CDL</option>
  <option value="4">DHL</option>
  <option value="110">TNT</option>
  <option value="111">Aramex</option>
  <option value="3">FedEx</option>
  <option value="2">UPS</option>
  <option value="-1">Other</option>
  <option value="-2">Not Available</option>
</optgroup>; */
}
