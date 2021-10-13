import {API_PROXY} from './config.js'

// CoinMarketCap Price API
const btc_price_url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';


// Talking to Flask API
let post_invoice_url = API_PROXY + '/api/generate_invoice';
let check_invoice_url = API_PROXY + '/api/check_invoice/';
let wait_invoice_url = API_PROXY + '/api/wait_invoice/';

const test = false;
if (test) {
    post_invoice_url = API_PROXY + '/test/generate_invoice';
    check_invoice_url = API_PROXY + '/test/check_invoice/';
    wait_invoice_url = API_PROXY + '/test/check_invoice/';
}

// global list of timers to keep track of
var timers = {}
var webln;

//
//  Shortcut methods - who needs jQuery
//
function get_elem(element_name) {
    return document.getElementById(element_name)
}

function show_element(element_name) {
    get_elem(element_name).style.display = 'block';
}

function show_element_inline(element_name) {
    get_elem(element_name).style.display = 'inline';
}

function hide_element(element_name) {
    get_elem(element_name).style.display = 'none';
}

// Zero pad a number
Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

// Simple client wrapper for requests
var HttpClient = function() {

    // GET
    this.get = function(aUrl, aCallback) {
        var anHttpRequest = new XMLHttpRequest();
        anHttpRequest.onreadystatechange = function() {
            if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200)
                aCallback(anHttpRequest.responseText);
        }

        anHttpRequest.open( "GET", aUrl, true );
        anHttpRequest.send( null );
    }

    this.post = function(aUrl, payload, aCallback) {
        var anHttpRequest = new XMLHttpRequest();
        anHttpRequest.onreadystatechange = function() {
            if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200)
                aCallback(anHttpRequest.responseText);
        }
        anHttpRequest.open("POST", aUrl, true );
        anHttpRequest.setRequestHeader("Content-Type", "application/json");
        anHttpRequest.send(payload);
    }
}

// Set the USD value of the Bolt11 invoice based
// CoinMarketCap API price
const setUsdValue = async() => {
    let amount =  Number(get_elem('amount').value);
    if (isNaN(amount)) {
        get_elem('amount_usd').value = "Not a number";
        get_elem('submit_amount').disabled = true;
        return;
    }
    if (amount < 0) {
        get_elem('amount_usd').value = "Value is negative";
        get_elem('submit_amount').disabled = true;
        return;
    }
    if (amount === 0) {
        get_elem('amount_usd').value = "$ 0.00";
        get_elem('submit_amount').disabled = true;
        return;
    }
    if (amount > 10000000) {
        get_elem('amount_usd').value = "Don't Troll!";
        get_elem('submit_amount').disabled = true;
        return;
    }

    get_elem('submit_amount').disabled = false;

    // Fetch price data and set element
    let client = new HttpClient();
    client.get(btc_price_url, function(json_response) {
        let data = JSON.parse(json_response);
        let btc_price = Number(data.bitcoin.usd);
        let tip_amout = 0.0;
        let amount_no_trunc = btc_price * (amount / 100000000);
        let tip_amount;
        if (amount_no_trunc > 0.05) {
            tip_amount = Math.floor(amount_no_trunc * 100) / 100;
        } else {
            tip_amount = Math.floor(amount_no_trunc * 100000) / 100000;
        }
        get_elem('amount_usd').value = '$ ' + tip_amount;
    });

}

// Bolt11 expiry countdown
function updateExpiration(expiration) {

    // Now in seconds
    const now = Math.round((new Date().getTime()) / 1000);

    // Find the distance between now and the count down date
    var distance = expiration - now;

    if (distance <= 0) {
        distance = 0;
        hide_element('bolt11_invoice');
        show_element('payment_status');
        show_element('pay_fail');
    }
    var minutes = Math.floor((distance % (60 * 60)) / 60);
    var seconds = Math.floor(distance % 60);


    // Set in mm:ss format
    get_elem("seconds_left").innerHTML = "" + (minutes).pad(2) + ":" + (seconds).pad(2);
}

function checkInvoice(label) {
    let invoice_url = check_invoice_url + label;
    let lbl = label;

    // Wait for invoice completion
    let client = new HttpClient();
    client.get(invoice_url, function(json_response) {
        let data = JSON.parse(json_response);

        console.log("Status is " + JSON.stringify(data, null, 4));

        // If we get a paid response
        if (data.status === 'paid') {
            // clear timers associated with that invoice
            for (let id of timers[lbl]) {
                clearInterval(id);
            }
            hide_element('bolt11_invoice');
            show_element('payment_status');
            show_element('pay_success');
            hide_element('pay_fail');
        }
    });
}

// Wrapper around setInterval for us to keep track of timers globally
function registerInterval(key, func, interval) {
    let id = setInterval(func, interval);
    // Can have multiple timers on the same key
    if (timers[key]) {
        timers[key].push(id);
    } else {
        timers[key] = [id];
    }
    return id;
}


// Process input amount and make bolt 11 invoice
function processAmount() {

    let amount =  Number(get_elem('amount').value);
    if (isNaN(amount) || amount <= 0) {
        return;
    }

    let amount_msatoshi = amount * 1000;
    let expiry = 600;

    let post_data = {
        'msatoshi': amount_msatoshi,
        'expiry': expiry,
        'description': 'Lightning Tip For Conor conscott Scott'
    }

    let client = new HttpClient();
    client.post(post_invoice_url, JSON.stringify(post_data), function(json_response) {

        let data = JSON.parse(json_response);

        // Get label for invoice
        let label = data.label;
        let bolt11 = data.bolt11;
        const now = Math.round((new Date().getTime()) / 1000);
        let expires = now + expiry;

        hide_element('make_invoice');
        get_elem('bolt11_inv').innerHTML = bolt11;
        show_element('bolt11_invoice');

        // Make qr code
        let qrcode = new QRCode(document.getElementById('qrcode'), bolt11);


        var timerCountdownId = registerInterval(label, function() { updateExpiration(expires) }, 1000);

        // Clear the timer after it's not longer needed
        setTimeout(function() {clearInterval(timerCountdownId)}, (expiry+2)*1000);

        // Settle for a polling solution
        var timerCheckInvoiceId = registerInterval(label, function() { checkInvoice(label) }, 3000);

        // Clear the timer after it's not longer needed
        setTimeout(function() {clearInterval(timerCheckInvoiceId)}, (expiry+2)*1000);
    });
}

// Copy bolt11 text to clipboard
function copyBoltToClipboard() {
    var range = document.createRange();
    range.selectNode(get_elem('bolt11_inv'));
    window.getSelection().addRange(range);
    document.execCommand("copy");

    // Remove selection
    var sel = window.getSelection ? window.getSelection() : document.selection;
    if (sel) {
        if (sel.removeAllRanges) {
            sel.removeAllRanges();
        } else if (sel.empty) {
            sel.empty();
        }
    }
}

// Try to pay with JOULE or other webln thing
const openWalletPay = async() => {
  let bolt11 = get_elem('bolt11_inv');
  let send = await webln.sendPayment(bolt11.innerHTML);
}

// Add the "Open Wallet" button if WebLN detected
const setupLNProvier = async() => {
  webln = await WebLN.requestProvider();
  if (webln) {
    console.log("Detected WebLN provider!");
    show_element_inline('wallet_pay');
    get_elem('wallet_pay').disabled = false;
  }
};


setUsdValue();
setupLNProvier();

get_elem('amount').addEventListener("input", setUsdValue);
get_elem('submit_amount').addEventListener("click", processAmount);
get_elem('copy_invoice').addEventListener("click", copyBoltToClipboard);
get_elem('wallet_pay').addEventListener("click", openWalletPay);
