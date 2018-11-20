const btc_price_url = 'https://api.coinmarketcap.com/v1/ticker/bitcoin/';
const post_invoice_url = 'http://localhost:5000/api/post_test_invoice';
const check_invoice_url = 'http://localhost:5000/api/check_fake_invoice/fake_label';

var HttpClient = function() {
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

function setUsdValue() {
    let amount =  Number(document.getElementById('amount').value);
    if (isNaN(amount)) {
        document.getElementById('amount_usd').value = "Not a number";
        document.getElementById('submit_amount').disabled = true;
        return;
    }
    if (amount < 0) {
        document.getElementById('amount_usd').value = "Value is negative";
        document.getElementById('submit_amount').disabled = true;
        return;
    }

    document.getElementById('submit_amount').disabled = false;
    
    let client = new HttpClient();
    client.get(btc_price_url, function(json_response) {
        let data = JSON.parse(json_response);
        let btc_price = Number(data[0].price_usd);
        let tip_amout = 0.0;
        let amount_no_trunc = btc_price * (amount / 100000000);
        if (amount_no_trunc > 0.05) {
            tip_amount = Math.floor(amount_no_trunc * 100) / 100;
        } else {
            tip_amount = Math.floor(amount_no_trunc * 100000) / 100000;
        }
        document.getElementById('amount_usd').value = '$ ' + tip_amount;
    });

}

function updateExpiration(expiration) {
    const now = Math.round((new Date().getTime()) / 1000);

    // Find the distance between now and the count down date
    var distance = expiration - now;
    var minutes = Math.floor((distance % (60 * 60)) / 60);
    var seconds = Math.floor(distance % 60);

    // Set in mm:ss format
    document.getElementById("seconds_left").innerHTML = "" + minutes + ":" + seconds;
}


// Process input amount and make bolt 11 invoice
function processAmount() {
    console.log("Click amount...");
    let amount =  Number(document.getElementById('amount').value);
    if (isNaN(amount) || amount < 0) {
        return;
    }
    
    let amount_msatoshi = amount * 1000;
    let expiry = 600;

    post_data = {
        'msatoshi': amount_msatoshi,
        'expiry': expiry
    }
    
    let client = new HttpClient();
    client.post(post_invoice_url, JSON.stringify(post_data), function(json_response) {

        let data = JSON.parse(json_response);

        // Get label for invoice
        let label = data.label;
        let bolt11 = data.bolt11;
        const now = Math.round((new Date().getTime()) / 1000);
        let expires = now + 600;

        document.getElementById('make_invoice').style.display = 'none';
        document.getElementById('bolt11_inv').innerHTML = bolt11;
        document.getElementById('bolt11_invoice').style.display = 'block';

        setInterval(function() { updateExpiration(expires) }, 1);
        
        client.get(check_invoice_url, function(json_response) {
            document.getElementById('bolt11_invoice').style.display = 'none';
            document.getElementById('payment_status').style.display = 'block';
        });
    
    });
}

function copyToClipboard() {
    var range = document.createRange();
    range.selectNode(document.getElementById('bolt11_inv'));
    window.getSelection().addRange(range);
    document.execCommand("copy");

    var sel = window.getSelection ? window.getSelection() : document.selection;
    if (sel) {
        if (sel.removeAllRanges) {
            sel.removeAllRanges();
        } else if (sel.empty) {
            sel.empty();
        }
    }
}

setUsdValue();

document.getElementById('amount').addEventListener("input", setUsdValue);
document.getElementById('submit_amount').addEventListener("click", processAmount);
document.getElementById('copy_invoice').addEventListener("click", copyToClipboard);
