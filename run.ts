import { OrderDoneMessage, PlaceOrderMessage } from "gdax-trading-toolkit/build/src/core";
import * as GTT from 'gdax-trading-toolkit';
import {GDAX_WS_FEED, GDAXFeedConfig, GDAXFeed} from "gdax-trading-toolkit/build/src/exchanges";
import {GDAX_API_URL} from "gdax-trading-toolkit/build/src/exchanges/gdax/GDAXExchangeAPI";
import {LiveOrder} from "gdax-trading-toolkit/build/src/lib";

const logger = GTT.utils.ConsoleLoggerFactory({ level: 'debug' });
const gdaxAPI = GTT.Factories.GDAX.DefaultAPI(logger);

interface LooseObject {
    [key: string]: any
}

let sellArray: LooseObject = {};
let product:string = "LTC-USD";
let nodeMailer = require('nodemailer');
let buyId:string ;
let buyPrice:string;
let amountPerTrade:string = '1';
let maxOpenSellOrders:number = 4;
let minBuyValue:number = 10;
console.log(process.env.GDAX_KEY);


const options: GDAXFeedConfig = {
    logger: logger,
    auth: {
        key: process.env.GDAX_KEY,
        secret: process.env.GDAX_SECRET,
        passphrase:  process.env.GDAX_PASSPHRASE
          },
    channels: ['user'],
    wsUrl: GDAX_WS_FEED,
    apiUrl:GDAX_API_URL
};

/**
 * This is the meat of the program and will start a feed to the user data and wait for orders to finalize.
 */
GTT.Factories.GDAX.getSubscribedFeeds(options, [product]).then((feed: GDAXFeed) => {
    feed.on('data', (msg: OrderDoneMessage) => {
        console.log(msg);
        //recoded the ID and price
        if(msg.type == 'myOrderPlaced'){
            console.log('Placed an order');
            addTradeId(msg.orderId,msg.price,msg.side);
        }
        if(msg.type == 'tradeFinalized'){
            console.log('Order Finalized');
            //trade was Canceled
            if(msg.reason =='canceled'){
                removeTradeId('buy',msg.orderId);
                removeTradeId('sell',msg.orderId);
            }
            //Trade was filled
            if(msg.reason =="filled" && (msg.remainingSize == '0.00000000'|| msg.remainingSize == '0'))
            {
                //Was it buy or sell
                if(msg.side =="buy"){
                    buyOrderClosed(msg.orderId);
                }else{
                    sellOrderClosed(msg.orderId);
                }
            }else{
                sendMessage(`non recognized message`);
            }
        }
    });
});

/**
 * this is called when a trade needs to be removed from the tracking array such as when it is closed
 * @param {string} side - this is the side you want to remove the ID from
 * @param {string} orderId - this is the order id that is to be removed
 */
function removeTradeId(side:string,orderId:string){
    if(side == 'buy'){
        if(buyId == orderId) {
            buyId = null;
            buyPrice = null;
            sendMessage(`Cleared Buy order`);
        }else{
            sendMessage('Skipped delete was not the requested buy order')
        }
    }else{
        console.log(sellArray);
        delete sellArray[orderId];
        console.log(sellArray);
    }

}

/**
 * This is used to add a trade to the local storage to be later used.
 * @param {string} orderId - ID of the order
 * @param {string} price - Price the order was at
 * @param {string} side - side the order was on
 */
function addTradeId(orderId:string, price:string, side:string){
    if(side == 'buy'){
        buyId=orderId;
        buyPrice=price;
        sendMessage(`A buy order ${orderId} was placed at ${price}`);
    }else{
        sellArray[orderId] = price;
        sendMessage(`A sell order ${orderId} was placed at ${price}`);
        console.log(sellArray);
    }
}

/**
 * when a buy order is closed this is called. All the logic for what should happen on a buy closed is contained with in.
 * @param {string} orderId
 */
function buyOrderClosed(orderId:string){
    let price:number = Number(buyPrice);
    let profit:string = calcProfitInterval(buyPrice);
    let buyDown:string = calcBuyDown(buyPrice);
    removeTradeId('buy',orderId);
    sendMessage(`I just bought ${amountPerTrade} at ${price}`);
    console.log(sellArray);
    if(Object.keys(sellArray).length<=maxOpenSellOrders){
        submitLimit('buy',  amountPerTrade ,roundTwoPlaces(buyDown));
        submitLimit('sell', amountPerTrade ,profit);
        sendMessage(`Buy Limit placed for ${amountPerTrade} at ${roundTwoPlaces(buyDown)} and a sell limit for ${amountPerTrade} at ${roundTwoPlaces(profit)}`);
    }else{
        submitLimit('sell', amountPerTrade ,profit);
        sendMessage(`A sell limit for ${amountPerTrade} at ${roundTwoPlaces(profit)} max sells has been reached.`);
    }

}

/**
 * when a sell trade is closed this is called
 * @param {string} orderId
 */
function sellOrderClosed(orderId:string){
    let price = sellArray[orderId];
    console.log(sellArray);
    if(buyId !='' ) {
        cancelOrder(buyId);
    }
    removeTradeId('sell',orderId);
    submitLimit('buy',  amountPerTrade ,calcBuyDown(price));
    sendMessage(`I just closed a Trade for profit`);
}

/**
 * this is used to calc the buy down interval
 * @returns {number}
 */
function calcBuyDown(price:string){
    let re =(Number(price)-0.01).toString();
    console.log(`Calc BuyDown price:${price} - 0.02 = ${re}`);
    return re;
}

/**
 * This is used to calc the profit interval
 * @returns {number}
 */
function calcProfitInterval(price:string){
    let re= (Number(price)+0.02).toString();
   console.log(`Calc profit price:${price} + 0.02 = ${re}`);
    return re;
}


/**
 * This is used to submit a limit order.
 * @param {string} side   This is the side you want to submit the trade on.
 *                        Options: "buy" or "sell"
 * @param {string} amount This is the amount you want to
 *
 * @param {string} price This is the price you want to set the limit for
 */
function submitLimit(side: string, amount: string ,price:string) {
    console.log("side:"+side+' Amount:'+amount+ ' Price:'+roundTwoPlaces(price));
    //Sanity Check lets not buy or sell Bellow x value
    if(Number(roundTwoPlaces(price))>minBuyValue){
        const order: PlaceOrderMessage = {
            type: 'order',
            time: null,
            productId: 'LTC-USD',
            orderType: 'limit',
            side: side,
            size: amount,
            price:roundTwoPlaces(price)
        };
        gdaxAPI.placeOrder(order).then((result: LiveOrder) => {
            //pushMessage('Order executed', );
            sendMessage(`Order to ${side} ${amount} 'LTC-USD' for${price}. Result: ${result.status}`);
        });
    }else{
        sendMessage(`Um I just tried to do a crazy trade. Exiting`);
        //TODO:: EXIT THE PROGRAM HERE
    }

}


/**
 * This is used to cancel orders
 * @param {string} id
 */
function cancelOrder(id: string){
    gdaxAPI.cancelOrder(id).then(
     function () {
         sendMessage(`I canceled order ${id}`);
     }
    ).catch(
        function () {
            sendMessage(`I tried to cancel an order and it failed. The Id i was given was ${id}`);
        }
    );

}

/**
 * this is used to send a txt via a Pre defined sender and receiver
 * @param {string} Message
 */
function sendMessage(Message:string) {
    console.log();
    console.log(Message);
    console.log();
    let transporter = nodeMailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.Email_User,
            pass: process.env.Email_Password
        }
    });

    let mailOptions = {
        from: process.env.Email_From,
        to: process.env.Email_To,
        subject: '',
        text: Message
    };

    transporter.sendMail(mailOptions, function (error: object, info: object) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ');
        }
    });
}

/**
 * This is simply used to round numbers to two places.
 * @param {string} num
 * @returns {string}
 */
function roundTwoPlaces(num:string){
    let numIs:number = Number(num);
    return (Math.round(numIs*100)/100).toString();
}
