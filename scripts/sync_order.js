const orderNotFound = `
   <div class="om-not-found-wrap">
      <div style="padding:20px 10px;"><img style="width:30px;object-fit:cover;" src="${chrome.runtime.getURL(
        "assets/images/not-found.png",
      )}"/></div>
      <div class="om-text-not-found" >Orders not found</div>
   </div>
`;

const syncedAllOrders = `
   <div class="om-synced-all-wrap">
      <div style="padding:20px 10px;"><img style="width:30px;object-fit:cover;" src="${chrome.runtime.getURL(
        "assets/images/completed.png",
      )}"/></div>
      <div class="om-text-synced-all" >All orders were synced to MB</div>
   </div>
`;

const statusLabel = (status, colorCode) => `
   <div class="om-status-label-wrap" data-status="${status}">
      <span class="om-status-label" style="background-color:${colorCode};">${status}</span>
   </div>
`;

const addStatusLabel = (orderInfos) => {
  if (!orderInfos) return;
  // orderInfos = {
  //    [orderId]: {
  //       status: String,
  //       trackingCode: String
  //    }
  // }
  const ordersXpath = "#browse-view .panel-body-row";
  for (let i = 0; i < $(ordersXpath).length; i++) {
    const item = $(ordersXpath)?.eq(i);
    // const orderId = item?.find("h3 a:first-child")?.text()?.split("#")?.pop();
    const orderId = item?.find("button[orderid]").attr("orderid");
    if (!orderId || !orderInfos[orderId]) continue;
    item
      .find(".flag-body.wt-vertical-align-top")
      .attr("data-order-id", orderId);
    // item.find(`.flag-img [role="tablist"]`).attr("data-order-id", orderId);

    // Set attribute data-order-id.
    const btn = item?.find("button[orderid]");
    const p = $(btn).closest(".flag-img");
    $(p).attr("data-order-id", orderId);
    const addLabelXpath = ".flag .col-group .col-md-4";
    item
      .find(addLabelXpath)
      .append(`<div class="wt-mt-xs-2 om-order-info"></div>`);
    const elem = item.find(addLabelXpath + " .om-order-info");
    const { status, trackingCode } = orderInfos[orderId];
    switch (status) {
      case "Synced":
        if (!item.find(`[data-status="Synced"]`).length)
          elem.append(statusLabel("Synced", "#008060"));
        if (trackingCode) {
          if (!item.find(`[data-status="Tracking Available"]`).length)
            elem.append(statusLabel("Tracking Available", "#008060"));
        } else {
          if (!item.find(`[data-status="Tracking Not Available"]`).length)
            elem.append(statusLabel("Tracking Not Available", "#f44336"));
        }
        break;
      case "Not Synced":
        if (!item.find(`[data-status="Not Synced"]`).length)
          elem.append(statusLabel("Not Synced", "#f44336"));
        break;
      case "Ignored":
        if (!item.find(`[data-status="Ignored"]`).length)
          elem.append(statusLabel("MB Ignored", "#f44336"));
        break;
      default:
        break;
    }
  }
};

const removeTableLoading = () => {
  // remove loading
  $("#not_synced .loader-resp").remove();
  $("#ignored .loader-resp").remove();
  $("#add_tracking .loader-resp").remove();
  // show not synced table
  if (!$("#not_synced table").length)
    $("#not_synced").prepend(`
          <div class="table_wrap">
             <table class="om-table">
               <thead>
                  <tr>
                     <th class="force-sync-all-item">
                        <input class="om-checkbox" type="checkbox" />
                     </th>
                     <th>Image</th>
                     <th>Order ID</th>
                     <th>Action</th>
                  </tr>
               </thead>
               <tbody></tbody>
             </table>
          </div>
       `);
  // show ignore table
  if (!$("#ignored table").length)
    $("#ignored").prepend(`
          <div class="table_wrap">
             <table class="om-table">
               <thead>
                  <tr>
                     <th class="force-revert-all-item">
                        <input class="om-checkbox" type="checkbox" />
                     </th>
                     <th>Image</th>
                     <th>Order ID</th>
                     <th>Action</th>
                  </tr>
                </thead>
                <tbody></tbody>
             </table>
          </div>
       `);
  // show tracking table
  if (!$("#add_tracking table").length)
    $("#add_tracking").prepend(`
         <div class="table_wrap add_track_table_wrap">
            <table class="om-table">
              <thead>
                 <tr>
                    <th class="force-add-tracking-all-item">
                       <input class="om-checkbox" type="checkbox" />
                    </th>
                    <th>Image</th>
                    <th>Order ID</th>
                    <th>Action</th>
                 </tr>
               </thead>
               <tbody></tbody>
            </table>
         </div>
      `);
};

const calcu = (val, convertVal) => {
  return Number((val / convertVal).toFixed(2));
};

const appendOrdersIntoTable = (data) => {
  removeTableLoading();
  if (!data) return;
  const { orders, mbInfos = {} } = data;
  const countUnsyncOrders = Object.values(mbInfos).filter(
    (item) => item.status === "Not Synced",
  ).length;
  if (countUnsyncOrders == 0) {
    $(".om-table tbody").empty();
    $(".om-synced-all-wrap").show();
  } else {
    $(".om-synced-all-wrap").hide();
  }
  addStatusLabel(mbInfos);
  let hasNotSync = false;
  let hasIgnore = false;
  let hasTracking = false;

  let convert = false;
  let convertVal = 1;
  let currencyConvert = getCookie("currencyConvert");
  if (currencyConvert && typeof currencyConvert === "string") {
    currencyConvert = JSON.parse(currencyConvert);
    convert = !!currencyConvert.checked;
    convertVal = currencyConvert.value;
    if (convertVal) convertVal = parseFloat(convertVal);
  }
  for (let order of orders) {
    // add order into not sync table
    if (!order || !mbInfos || !mbInfos[order.orderId]) continue;
    const { status, trackingCode, shippingCarrierCode } =
      mbInfos[order.orderId];

    if (convert && convertVal) {
      const {
        discountTotal,
        grandTotal,
        shippingTotal,
        subTotal,
        taxTotal,
        items,
      } = order || {};
      const newItems = (items || []).map((item) => {
        const { price, shippingCost } = item || {};
        return {
          ...item,
          price: calcu(price, convertVal),
          shippingCost: calcu(shippingCost, convertVal),
        };
      });

      order = {
        ...order,
        items: newItems,
        discountTotal: calcu(discountTotal, convertVal),
        grandTotal: calcu(grandTotal, convertVal),
        shippingTotal: calcu(shippingTotal, convertVal),
        subTotal: calcu(subTotal, convertVal),
        taxTotal: calcu(taxTotal, convertVal),
      };
    }

    const style =
      "border: 1px solid #d9d9d9;border-radius: 5px;box-shadow: none;padding-left: 5px;width:50px;";
    if (status === "Not Synced") {
      hasNotSync = true;
      if (!$(`#not_synced tr[data-order-id="${order.orderId}"]`).length) {
        $("#not_synced .om-table tbody").append(`
               <tr data-order-id="${order.orderId}">
                  <td class="force-sync-item"><input data-order="${b64Encode(
                    order,
                  )}" class="om-checkbox" type="checkbox"></td>
                  <td> <img class="om-img-50" src="${
                    order.items[0].image
                  }" /></td>
                  <td>${order.orderId}</td>
                  <td>
                    <div style="display:flex;gap: 10px;">
                      <button class="sync-order-item om-btn" data-order-id="${
                        order.orderId
                      }" data-order="${b64Encode(order)}">Sync</button>
                      <input title="split count" type="number" class="split-order" value="1" min="1" style="${style}"/>
                    </div>
                  </td>
               </tr>
            `);
      }
    }
    // add order into ignored table
    if (status === "Ignored") {
      hasIgnore = true;
      if (!$(`#ignored tr[data-order-id="${order.orderId}"]`).length) {
        $("#ignored .om-table tbody").append(`
               <tr data-order-id="${order.orderId}">
                  <td class="force-revert-item"><input data-order="${b64Encode(
                    order,
                  )}" class="om-checkbox" type="checkbox"></td>
                  <td> <img class="om-img-50" src="${
                    order.items[0].image
                  }" /></td>
                  <td>${order.orderId}</td>
                  <td><button class="revert-order-item om-btn" data-order-id="${
                    order.orderId
                  }" data-order="${b64Encode(order)}">Revert</button></td>
               </tr>
            `);
      }
    }
    // add order into tracking table
    if (trackingCode) {
      hasTracking = true;
      let carrier = shippingCarrierCode ? shippingCarrierCode : "";

      if (!$(`#add_tracking tr[data-order-id="${order.orderId}"]`).length) {
        $("#add_tracking .om-table tbody").append(`
               <tr data-order-id="${order.orderId}">
                  <td class="force-add-tracking-item"><input data-tracking="${trackingCode}" data-carrier="${carrier}" data-order-id="${order.orderId}" class="om-checkbox" type="checkbox"></td>
                  <td> <img class="om-img-50" src="${order.items[0].image}" /></td>
                  <td>
                     <span class="om-order-id-tag">${order.orderId}</span>
                     <span class="om-tracking-tag">${trackingCode}</span>
                  </td>
                  <td><button class="add-tracking-item om-btn" data-order-id="${order.orderId}" data-tracking="${trackingCode}" data-carrier="${carrier}">Add</button></td>
               </tr>
            `);
      }
    }
  }
  $("#not_synced .om-not-found-wrap").remove();
  $("#ignored .om-not-found-wrap").remove();
  $("#add_tracking .om-not-found-wrap").remove();
  if (hasNotSync) $(".btn-sync-order-wrap").css("display", "flex");
  else {
    if (!$("#not_synced .om-synced-all-wrap").length)
      $("#not_synced .table_wrap").append(syncedAllOrders);
    $("#not_synced .btn-sync-order-wrap").css("display", "none");
  }
  if (hasIgnore) $(".btn-revert-order-wrap").css("display", "flex");
  else {
    if (!$("#ignored .table_wrap .om-not-found-wrap").length)
      $("#ignored .table_wrap").append(orderNotFound);
    $("#ignored .btn-revert-order-wrap").css("display", "none");
  }
  if (hasTracking) $(".btn-add-tracking-wrap").css("display", "flex");
  else {
    if (!$("#add_tracking .table_wrap .om-not-found-wrap").length)
      $("#add_tracking .table_wrap").append(orderNotFound);
    $("#add_tracking .btn-add-tracking-wrap").css("display", "none");
  }
};

const setTextBtnSync = () => {
  let hasChecked = false;
  $(".force-sync-item .om-checkbox").each(function () {
    if ($(this).is(":checked")) {
      hasChecked = true;
      return false;
    }
  });
  if (hasChecked) $("#sync-order").text("Sync Selected Orders");
  else $("#sync-order").text("Sync Orders");
};

const setTextBtnRevert = () => {
  let hasChecked = false;
  $(".force-revert-item .om-checkbox").each(function () {
    if ($(this).is(":checked")) {
      hasChecked = true;
      return false;
    }
  });
  if (hasChecked) $("#revert-order").text("Revert Selected Orders");
  else $("#revert-order").text("Revert Orders");
};

// listing event from background
chrome.runtime.onMessage.addListener(async function (req, sender, res) {
  const { message, data } = req || {};
  if (message === "orders") {
    res({ message: "received" });
    if (!data) {
      return;
    }
    const { error } = data || {};
    if (error) {
      notifyError("Check synced order: " + data.error);
      return;
    }
    appendOrdersIntoTable(data);
    setDivHeight();

    if (data?.orders?.length > 0) {
      // Auto sync
      const isAuto = getCookie("_mb_auto");
      const autoKey = getCookie("_mb_auto_key");
      if (isAuto && autoKey) {
        $(".om-addon #not_synced #sync-order").trigger("click");
        return;
      }
    }
  }

  if (message === "syncOrderToMB") {
    res({ message: "received" });
    $(".loader").removeClass("loader");
    const {
      data: { error: message },
      error,
      orders,
    } = data;
    let hasError = false;
    if (error) {
      notifyError(error);
      return;
    }
    for (const order of orders) {
      if (message[order.orderId]) hasError = true;
      else $(`tr[data-order-id="${order.orderId}"]`).remove();
    }
    if (!hasError) notifySuccess("Sync orders success.");
    else {
      for (const order of Object.entries(message)) {
        notifySuccess(order[0] + ": " + order[1]);
      }
    }
    // If the order is out of stock, then add not found
    if (!$("#not_synced tr[data-order-id]").length) {
      if (!$("#not_synced .table_wrap .om-not-found-wrap").length)
        $("#not_synced .table_wrap").append(orderNotFound);
      $(".btn-sync-order-wrap").css("display", "none");
    }
    setTextBtnSync();
  }
  if (message === "deleteIgnoreEtsyOrder") {
    res({ message: "received" });
    $(".loader").removeClass("loader");
    const { orders, data: result, error } = data;
    if (error) {
      notifyError("Delete ignore order: " + error);
      return;
    }
    notifySuccess("Delete ignore order success.");
    for (const order of orders) {
      const status = result[order["orderId"]];
      if (status !== "Ignored")
        $(`#ignored tr[data-order-id="${order.orderId}"]`).remove();
      if (status === "Not Synced")
        if (!$(`#not_synced tr[data-order-id="${order.orderId}"]`).length) {
          $("#not_synced .om-table").append(`
                  <tr data-order-id="${order.orderId}">
                     <td class="force-sync-item"><input data-order="${b64Encode(
                       order,
                     )}" class="om-checkbox" type="checkbox"></td>
                     <td> <img class="om-img-50" src="${
                       order.items[0].image
                     }" /></td>
                     <td>${order.orderId}</td>
                     <td><button class="sync-order-item om-btn" data-order-id="${
                       order.orderId
                     }" data-order="${b64Encode(order)}">Sync</button></td>
                  </tr>
               `);
        }
    }
    if ($("#ignored tr[data-order-id]").length == 0) {
      if (!$("#ignored .table_wrap .om-not-found-wrap").length)
        $("#ignored .table_wrap").append(orderNotFound);
      $("#ignored .btn-revert-order-wrap").css("display", "none");
    }
    setTextBtnRevert();
  }

  if (message === "auto_synced") {
    res({ message: "received" });
    notifySuccess("Auto synced orders");
    $("#sync-order").removeClass("loader");
    setTimeout(() => {
      const event = new CustomEvent("mb_sync_done");
      window.dispatchEvent(event);
    }, 5 * 1000);
  }
  return;
});

// control tabs sync orders
$(document).on("click", `.sync-order-wrap .tablinks`, function (e) {
  $(".sync-order-wrap .tabcontent").each(function () {
    $(this).css("display", "none");
  });
  $(".sync-order-wrap .tablinks").each(function () {
    $(this).removeClass("om-active om-active-tab");
  });
  $(`#${$(this).attr("data-name")}`).css("display", "block");
  $(this).addClass("om-active om-active-tab");
});

// checked force sync orders
$(document).on("click", ".force-sync-all-item .om-checkbox", function () {
  if ($(this).is(":checked"))
    $(".force-sync-item .om-checkbox").each(function () {
      if (!$(this).is(":checked")) $(this).click();
    });
  else
    $(".force-sync-item .om-checkbox").each(function () {
      if ($(this).is(":checked")) $(this).click();
    });
  setTextBtnSync();
});

// checked force sync order item
$(document).on("click", ".force-sync-item .om-checkbox", function () {
  setTextBtnSync();
});

// checked force revert orders
$(document).on("click", ".force-revert-all-item .om-checkbox", function () {
  if ($(this).is(":checked"))
    $(".force-revert-item .om-checkbox").each(function () {
      if (!$(this).is(":checked")) $(this).click();
    });
  else
    $(".force-revert-item .om-checkbox").each(function () {
      if ($(this).is(":checked")) $(this).click();
    });
  setTextBtnRevert();
});

// checked force revert order item
$(document).on("click", ".force-revert-item .om-checkbox", function () {
  setTextBtnRevert();
});

// click sync orders
$(document).on("click", "#sync-order", async function () {
  const orders = [];
  // check sync order specify
  let isSyncOrderSpecify = false;
  $(".force-sync-item .om-checkbox").each(function () {
    if ($(this).is(":checked")) {
      isSyncOrderSpecify = true;
      return false;
    }
  });
  $(".force-sync-item .om-checkbox").each(function () {
    const orderString = $(this).attr("data-order");
    if (!orderString) return true;
    const order = b64Decode(orderString);
    if (isSyncOrderSpecify) {
      if ($(this).is(":checked")) orders.push(order);
      return true;
    }
    orders.push(order);
  });
  if (orders.length == 0) {
    notifyError("Order not found.");
    return;
  }
  $(this).addClass("loader");
  for (const order of orders) {
    $(`.sync-order-item[data-order-id="${order.orderId}"]`).addClass("loader");
  }

  const isAuto = getCookie("_mb_auto");
  const autoKey = getCookie("_mb_auto_key");
  // send order ids to background
  chrome.runtime.sendMessage({
    message: "syncOrderToMB",
    data: {
      apiKey: getCookie(mbApi),
      orders,
      markSynced: isAuto && autoKey,
    },
  });
});

// click force sync order
$(document).on("click", ".sync-order-item", async function () {
  const orders = [];
  const orderString = $(this).attr("data-order");
  if (!orderString) {
    notifyError("Order not found.");
    return;
  }
  orders.push(b64Decode(orderString));
  $(this).addClass("loader");
  $("#sync-order").addClass("loader");
  // send order ids to background
  chrome.runtime.sendMessage({
    message: "syncOrderToMB",
    data: {
      apiKey: getCookie(mbApi),
      orders,
    },
  });
});

// Split
$(document).on("change", ".split-order", async function () {
  const p = $(this).parent();
  let val = $(this).val();
  val = val ? parseInt(val) : 1;
  if (val < 2) return;

  if (p?.length > 0) {
    const btn = p.find(".sync-order-item");
    if (btn?.length > 0) {
      let data = $(btn).data("order");
      if (data?.length > 0) {
        const order = b64Decode(data);
        if (order && order.orderId) {
          order.splitCount = val;
          const encode = b64Encode(order);

          $(btn).attr("data-order", encode);
          const tr = $(this).closest(`tr[data-order-id="${order.orderId}"]`);
          if (tr?.length > 0) {
            const checkbox = $(tr).find(".om-checkbox");
            if (checkbox.length > 0) {
              $(checkbox).attr("data-order", encode);
            }
          }
        }
      }
    }
  }
});

// click revert orders
$(document).on("click", "#revert-order", async function () {
  const orders = [];
  // check sync order specify
  let isRevertOrderSpecify = false;
  $(".force-revert-item .om-checkbox").each(function () {
    if ($(this).is(":checked")) {
      isSyncOrderSpecify = true;
      return false;
    }
  });
  $(".force-revert-item .om-checkbox").each(function () {
    const orderString = $(this).attr("data-order");
    if (!orderString) return true;
    const order = b64Decode(orderString);
    if (isRevertOrderSpecify) {
      if ($(this).is(":checked")) orders.push(order);
      return true;
    }
    orders.push(order);
  });
  if (orders.length == 0) {
    notifyError("Order not found.");
    return;
  }
  $(this).addClass("loader");
  for (const order of orders) {
    $(`.revert-order-item[data-order-id="${order.orderId}"]`).addClass(
      "loader",
    );
  }

  // send order ids to background
  chrome.runtime.sendMessage({
    message: "deleteIgnoreOrder",
    data: {
      apiKey: getCookie(mbApi),
      orders,
    },
  });
});

// click force revert order
$(document).on("click", ".revert-order-item", async function () {
  const orders = [];
  const orderString = $(this).attr("data-order");
  if (!orderString) {
    notifyError("Order not found.");
    return;
  }
  orders.push(b64Decode(orderString));
  $(this).addClass("loader");
  $("#revert-order").addClass("loader");
  // send order ids to background
  chrome.runtime.sendMessage({
    message: "deleteIgnoreOrder",
    data: {
      apiKey: getCookie(mbApi),
      orders,
    },
  });
});

window.addEventListener("mb_sync_now", async (event) => {
  if (event?.detail?.mb_api) {
    setCookie("_mb_auto", true);
    setCookie("_mb_auto_key", event?.detail?.mb_api?.etsy);
    setCookie(mbApi, event?.detail?.mb_api?.etsy);
    chrome.runtime.sendMessage({
      message: "autoReady",
      domain: window.location.origin,
      apiKey: event?.detail?.mb_api?.etsy,
    });
  }
});
