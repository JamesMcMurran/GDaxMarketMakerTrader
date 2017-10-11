import { OrderDoneMessage, PlaceOrderMessage } from "gdax-trading-toolkit/build/src/core";
import * as GTT from 'gdax-trading-toolkit';
import {GDAX_WS_FEED, GDAXFeedConfig, GDAXFeed} from "gdax-trading-toolkit/build/src/exchanges";
import {GDAX_API_URL} from "gdax-trading-toolkit/build/src/exchanges/gdax/GDAXExchangeAPI";
import {LiveOrder} from "gdax-trading-toolkit/build/src/lib";

let Message = new Notify();

const logger = GTT.utils.ConsoleLoggerFactory({ level: 'debug' });
const gdaxAPI = GTT.Factories.GDAX.DefaultAPI(logger);

interface LooseObject {
    [key: string]: any
}

let sellArray: LooseObject = {};
let product:string = "LTC-USD";
let buyId:string ;
let buyPrice:string;
let amountPerTrade:string = '1';
let maxOpenSellOrders:number = 4;
let minBuyValue:number = 10;
//this is used to slow down the growth of the buy down. the higher the value the slower the exp growth of the buy down.
let exp_growth_slowdown = 1;


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
                Message.sendMessage(`non recognized message`);
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
            Message.sendMessage(`Cleared Buy order`);
        }else{
            Message.sendMessage('Skipped delete was not the requested buy order')
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
        Message.sendMessage(`A buy order ${orderId} was placed at ${price}`);
    }else{
        sellArray[orderId] = price;
        Message.sendMessage(`A sell order ${orderId} was placed at ${price}`);
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
    Message.sendMessage(`I just bought ${amountPerTrade} at ${price}`);
    console.log(sellArray);
    if(Object.keys(sellArray).length<=maxOpenSellOrders){
        submitLimit('buy',  amountPerTrade ,roundTwoPlaces(buyDown));
        submitLimit('sell', amountPerTrade ,profit);
        Message.sendMessage(`Buy Limit placed for ${amountPerTrade} at ${roundTwoPlaces(buyDown)} and a sell limit for ${amountPerTrade} at ${roundTwoPlaces(profit)}`);
    }else{
        submitLimit('sell', amountPerTrade ,profit);
        Message. sendMessage(`A sell limit for ${amountPerTrade} at ${roundTwoPlaces(profit)} max sells has been reached.`);
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
    Message.sendMessage(`I just closed a Trade for profit`);
}

/**
 * this is used to calc the buy down interval
 * @returns {number}
 */
function calcBuyDown(price:string){
    let numOfOpenOrders = Object.keys(sellArray).length;

    //this will increase the interval the more orders are open and the longer the uptick age.
    let re = Math.pow(numOfOpenOrders, (numOfOpenOrders / exp_growth_slowdown))/100 ; //* uptickAgeGrowth();
    console.log(`Calc BuyDown Num of orders:${numOfOpenOrders} ^ (${numOfOpenOrders} / ${exp_growth_slowdown})/100 = ${re}`);
    let buyPrice = (Number(price) - re).toString();
    return roundTwoPlaces(buyPrice);

    //let re =(Number(price)-0.01).toString();
    //return re;
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
            productId: product,
            orderType: 'limit',
            side: side,
            size: amount,
            price:roundTwoPlaces(price)
        };
        gdaxAPI.placeOrder(order).then((result: LiveOrder) => {
            //pushMessage('Order executed', );
            Message.sendMessage(`Order to ${side} ${amount} 'LTC-USD' for${price}. Result: ${result.status}`);
        });
    }else{
        Message.sendMessage(`Um I just tried to do a crazy trade. Exiting`);
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
         Message.sendMessage(`I canceled order ${id}`);
     }
    ).catch(
        function () {
            Message.sendMessage(`I tried to cancel an order and it failed. The Id i was given was ${id}`);
        }
    );

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
