const isProduction = true;
const MBUrl = isProduction
  ? "https://api.merchbridge.com/query"
  : "https://api-dev.merchbridge.com/query";
const EtsyDomain = "https://www.etsy.com";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stopInteval = (params) => {
  clearInterval(params);
};

let doingAuto = false;

const sendMessage = (tabId, message, data) => {
  let timeOut = 0;
  let start = setInterval(function () {
    chrome.tabs.sendMessage(
      tabId,
      {
        message,
        data,
      },
      function (response) {
        if (!chrome.runtime.lastError && response?.message === "received")
          stopInteval(start);
        if (timeOut == 30) stopInteval(start);
      },
    );
    timeOut++;
  }, 1000);
};

const sendToContentScript = (msg, data) =>
  new Promise(async (resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs.length || !tabs[0].id) return resolve(false);
      sendMessage(tabs[0].id, msg, data);
      resolve(true);
    });
  });

const getMBApiKey = () =>
  new Promise(async (resolve) => {
    const isSended = await sendToContentScript("getApiKey", null);
    if (!isSended) resolve(null);
    chrome.runtime.onMessage.addListener(async (req, sender, res) => {
      const { message, data } = req || {};
      if (message === "getApiKey" && data) resolve(data);
    });
  });

const API_KEY_SPECIAL = ["etsyapi-962d89a0-f2f9-4919-9854-e9be5f3325ca"];

const convertTime = (orderDate) => {
  let dateStr = orderDate + "";
  if (dateStr.length < 13) {
    dateStr += "0".repeat(13 - dateStr.length);
  }
  // return new Date(parseInt(dateStr)).toISOString();
  const date = new Date(parseInt(dateStr));
  const pstDate = date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });

  const formatVal = (val) => {
    val = String(val);
    if (val.length === 1) {
      val = "0" + val;
    }
    return val;
  };

  const [T1, T2] = pstDate.split(/,/).map((i) => i.trim());
  let [mo, d, y] = T1.split(/\//g).map((i) => formatVal(i));
  let [h, m, s] = T2.split(/\:/g).map((i) => formatVal(i));
  [s] = s.split(" ");

  const pt = /PM/gi;
  if (!!pstDate.match(pt)) {
    h = parseInt(h) + 12;
    if (h >= 24) {
      h = h - 24;
      d = parseInt(d) + 1;
   }
  }

  const res = `${[y, mo, d].join("-")}T${[h, m, s].join(":")}.000Z`;
  return res;
}; // etsyapi-45fdd139-9a95-4905-a041-a2a916285bef

const getOrders = (data, mbApiKey) => {
  const orders = [];
  const mapBuyer = {};
  if (!data.buyers || !data.orders) return;
  for (const buyer of data.buyers) {
    mapBuyer[buyer.buyer_id] = buyer;
  }

  // Map transactions
  let transactionsObj = {};
  if (data?.transactions?.length > 0) {
    for (let item of data.transactions) {
      if (!item || typeof item !== "object" || !item.transaction_id) continue;
      transactionsObj[item.transaction_id] = item;
    }
  }

  for (const order of data.orders) {
    if (order.is_canceled) continue;

    // case: order's completed (`order.fulfillment.is_complete` = true) => skip
    if (!API_KEY_SPECIAL.includes(mbApiKey)) {
      if (order.fulfillment && order.fulfillment.is_complete) {
        continue;
      }
    }

    const buyer = mapBuyer[order.buyer_id];
    const shipping = order.fulfillment.to_address;
    const payment = order.payment.cost_breakdown;
    const notes = order.notes;
    let note = null;
    if (notes) {
      const { type, note_from_buyer } = notes;
      if (type == "Etsy_Order_Notes" && note_from_buyer)
        note = notes.note_from_buyer;
    }
    const newOrder = {
      orderId: String(order.order_id),
      orderDate: convertTime(order.order_date || ""),
      buyer: {
        email: buyer?.email,
        name: buyer?.name,
      },
      shipping: {
        name: shipping.name,
        address1: shipping.first_line,
        address2: shipping.second_line,
        city: shipping.city,
        state: shipping.state,
        zipCode: shipping.zip,
        country: shipping.country,
        phone: shipping.phone,
      },
      shippingMethod: order.fulfillment.shipping_method,
      grandTotal: payment.total_cost.value / 100,
      subTotal: payment.items_cost.value / 100,
      shippingTotal: payment.shipping_cost.value / 100,
      taxTotal: payment.tax_cost.value / 100,
      discountTotal: payment.discount.value / 100,
      items: [],
    };
    if (!order.transactions || order.transactions.length === 0) {
      if (order.transaction_ids?.length > 0) {
        let newTransactions = [];
        for (const id of order.transaction_ids) {
          if (transactionsObj[id] != null) {
            newTransactions.push(transactionsObj[id]);
          }
        }
        order.transactions = newTransactions;
      }
    }

    for (const transaction of order.transactions) {
      const newItem = {
        itemId: String(transaction.transaction_id),
        qty: transaction.quantity,
        isDigital: transaction.product.is_digital,
        isPersonalized: transaction.is_personalizable,
        productId: String(transaction.listing_id),
        productVariantId: String(transaction.product.product_id),
        sku: transaction.product.product_identifier,
        title: transaction.product.title,
        image: transaction.product.image_url_75x75.replace(
          "il_75x75",
          "il_fullxfull",
        ),
        isDigital: transaction.product.is_digital,
        price: transaction.cost.value / 100,
        shippingCost: 0,
        attributes: [],
        personalized: [],
      };
      if (note) newItem.note = note;
      for (const variation of transaction.variations) {
        if (variation.property === "Personalization") {
          newItem.personalized.push({
            name: variation.property,
            value: variation.value,
          });
        } else {
          newItem.attributes.push({
            name: variation.property,
            value: variation.value,
          });
        }
      }
      newOrder.items.push(newItem);
    }
    orders.push(newOrder);
  }
  return orders;
};

const sendRequestToMB = async (endPoint, apiKey, data) => {
  const res = {
    data: null,
    error: null,
  };
  const url = endPoint ? MBUrl.replace("/query", endPoint) : MBUrl;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: data,
    });
    return await resp.json();
  } catch (error) {
    res.error = error.message;
  }
  return res;
};

// capture event from content script
chrome.runtime.onMessage.addListener(async (req, sender, res) => {
  const { message, data } = req || {};
  if (message === "syncOrderToMB") {
    const { apiKey, orders } = data;

    if (!apiKey || !orders || !orders.length) return;
    // Split order
    const newOrders = [];
    for (let order of orders) {
      if (!order || typeof order !== "object") continue;
      const { splitCount, ...rest } = order;
      if (!splitCount || splitCount === 1) {
        newOrders.push(rest);
        continue;
      }

      // push first item;
      const newItems = [];
      for (let item of rest.items) {
        for (let i = 0; i < splitCount; i++) {
          let itemId = item.itemId;
          itemId = i ? `${itemId}-${i}` : itemId;
          newItems.push({ ...item, itemId, qty: 1 });
        }
      }

      newOrders.push({ ...rest, items: newItems });
    }
    let query = JSON.stringify({
      operationName: "createEtsyOrder",
      variables: {
        input: newOrders,
      },
      query:
        "mutation createEtsyOrder($input: [NewEtsyOrder!]!) {createEtsyOrder(input: $input){error}}",
    });
    const result = await sendRequestToMB(null, apiKey, query);
    const resp = {
      orders,
      data: result.data ? result.data.createEtsyOrder : null,
      error: result.errors ? result.errors[0].message : null,
    };
    sendMessage(sender.tab.id, "syncOrderToMB", resp);

    if (data?.markSynced) {
      await sendToContentScript("auto_synced");
    }
  }
  if (message === "deleteIgnoreOrder") {
    const { apiKey, orders } = data;
    if (!apiKey || !orders || !orders.length) return;
    let query = JSON.stringify({
      operationName: "deleteIgnoreEtsyOrder",
      variables: {
        originOrderIds: orders.map((o) => o.orderId),
      },
      query:
        "mutation deleteIgnoreEtsyOrder($originOrderIds: [ID!]!) {deleteIgnoreEtsyOrder(originOrderIds: $originOrderIds)}",
    });
    const result = await sendRequestToMB(null, apiKey, query);
    const resp = {
      orders,
      data: result.data ? result.data.deleteIgnoreEtsyOrder : null,
      error: result.errors ? result.errors[0].message : null,
    };
    sendMessage(sender.tab.id, "deleteIgnoreEtsyOrder", resp);
  }
  if (message === "fetchTrackChinaToUS") {
    const { endpoint } = data;
    chrome.tabs.create({ url: endpoint }, (tab) => {
      sendMessage(tab.id, "fetchTrackChinaToUS", {
        receiverId: sender.tab.id,
      });
    });
  }
  if (message === "fetchedTrackChinaToUS") {
    const { receiverId, validTracks } = data;
    chrome.tabs.remove(sender.tab.id);
    chrome.tabs.update(receiverId, { selected: true });
    sendMessage(receiverId, "fetchedTrackChinaToUS", {
      validTracks,
    });
  }

  // Auto sync order
  if (message === "autoReady") {
    if (doingAuto) return;

    doingAuto = true;
    openOrderPage();
    return;
  }
  return;
});

// capture event from popup
chrome.runtime.onMessage.addListener(async (req, sender, res) => {
  const { message, data } = req || {};
  switch (message) {
    case "popupSaveApiKey":
      sendToContentScript("popupSaveApiKey", data);
      break;
    case "popupGetApiKey":
      sendToContentScript("popupGetApiKey", null);
    default:
      break;
  }
});

// capture event from devtool
chrome.runtime.onConnect.addListener(function (port) {
  if (port.name !== "captureOrders") return;
  port.onMessage.addListener(async (msg) => {
    const { message, data } = msg || {};
    return;
    // get data from `injected` script
    switch (message) {
      case "orderInfo":
        const mbApiKey = await getMBApiKey();
        if (!mbApiKey) return;
        if (!data) break;
        const orders = getOrders(data, mbApiKey);
        console.log("orders:", orders);
        const resp = {
          orders,
          mbInfos: {},
          error: null,
        };

        if (orders.length === 0) {
          sendToContentScript("orders", resp);
          return;
        }
        // check synced orders
        const query = JSON.stringify({
          query: `
                  query{
                     checkEtsyOrderSyncedByIds(
                        ids: ${JSON.stringify(orders.map((o) => o["orderId"]))}
                     )
                  }
            `,
        });
        const result = await sendRequestToMB(null, mbApiKey, query);
        resp.mbInfos = result.data
          ? result.data.checkEtsyOrderSyncedByIds
          : null;
        resp.error = result.errors ? result.errors[0].message : null;

        sendToContentScript("orders", resp);
        break;
      default:
        break;
    }
  });
});

// message from `content_script`
chrome.runtime.onMessage.addListener(async (req) => {
  const { message, data } = req || {};
  switch (message) {
    case "orderInfo":
      const mbApiKey = await getMBApiKey();
      if (!mbApiKey) return;
      if (!data) break;
      const orders = getOrders(data, mbApiKey);
      console.log("orders:", orders);
      const resp = {
        orders,
        mbInfos: {},
        error: null,
      };

      if (orders.length === 0) {
        sendToContentScript("orders", resp);
        return;
      }
      // check synced orders
      const query = JSON.stringify({
        query: `
          query{
            checkEtsyOrderSyncedByIds(
              ids: ${JSON.stringify(orders.map((o) => o["orderId"]))}
            )
          }
        `,
      });
      const result = await sendRequestToMB(null, mbApiKey, query);
      resp.mbInfos = result.data ? result.data.checkEtsyOrderSyncedByIds : null;
      resp.error = result.errors ? result.errors[0].message : null;

      sendToContentScript("orders", resp);
      break;
    default:
      break;
  }
});

const openOrderPage = () => {
  const url = `https://www.etsy.com/your/orders/sold`;
  chrome.tabs.query({}, (tabs) => {
    let found = false;

    for (let tab of tabs) {
      if (found) break;
      if (tab?.url?.includes("/your/orders/sold")) {
        found = tab.id;
        break;
      }
    }

    if (found) {
      chrome.tabs.update(found, {
        active: true,
        url,
      });
    } else {
      chrome.tabs.create({
        active: true,
        url,
      });
    }
  });
};

chrome.runtime.onInstalled.addListener(details => {
  openOrderPage();

  const script = {
    id: 'injected',
    matches: ["https://www.etsy.com/*", "https://www.yuntrack.com/*"],
    js: ['injected.js'],
    world: 'MAIN',
    runAt: 'document_start'
  }

  chrome.scripting.registerContentScripts([script])
});
