import { OrderDoneMessage, PlaceOrderMessage } from "gdax-trading-toolkit/build/src/core";
import * as GTT from 'gdax-trading-toolkit';
import {GDAX_WS_FEED, GDAXFeedConfig, GDAXFeed} from "gdax-trading-toolkit/build/src/exchanges";
import {GDAX_API_URL} from "gdax-trading-toolkit/build/src/exchanges/gdax/GDAXExchangeAPI";
import {LiveOrder} from "gdax-trading-toolkit/build/src/lib";
import {Notify} from './notify';

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
let maxOpenSellOrders:number = process.env.MAX_SELL_ORDERS;
let minBuyValue:number = 10;


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
        Message.log(msg);
        PossessMessage(msg);
    });
});


/**
 * When starting get the open orders and add them to the local storage.
 */
gdaxAPI.loadAllOrders(product).then((orders) => {
    orders.forEach((o: LiveOrder) => {
        addTradeId(o.id, Number(o.price).toString(), o.side);
    });
});

/**
 * Possess the message that was received.
 * @param msg this is the message obj from the steam that is to be possessed
 */
function PossessMessage(msg:any){
    //recoded the ID and price
    if(msg.type == 'myOrderPlaced'){
        Message.log('Placed an order');
        addTradeId(msg.orderId,msg.price,msg.side);
    }
    if(msg.type == 'tradeFinalized'){
        Message.log('Order Finalized');
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
                buyOrderClosed(msg.orderId,msg.origin.price);
            }else{
                sellOrderClosed(msg.orderId,msg.origin.price);
            }
        }else{
            Message.log(`non recognized message`);
        }
    }
}



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
            Message.log(`Cleared Buy order`);
        }else{
            Message.log('Skipped delete was not the requested buy order')
        }
    }else{
        Message.log(sellArray);
        delete sellArray[orderId];
        Message.log(sellArray);
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
        Message.log(`A buy order ${orderId} was placed at ${price}`);
    }else{
        sellArray[orderId] = price;
        Message.log(`A sell order ${orderId} was placed at ${price}`);
        Message.log(sellArray);
    }
}

/**
 * when a buy order is closed this is called. All the logic for what should happen on a buy closed is contained with in.
 * @param {string} orderId
 */
function buyOrderClosed(orderId:string,price:string){

    let profit:string = calcProfitInterval(price);
    let buyDown:string = calcBuyDown(price);

    removeTradeId('buy',orderId);
    Message.log(`I just bought ${amountPerTrade} at ${price}`);
    Message.log(sellArray);
    if(Object.keys(sellArray).length<=maxOpenSellOrders){
        submitLimit('buy',  amountPerTrade ,roundTwoPlaces(buyDown));
        submitLimit('sell', amountPerTrade ,profit);
        Message.log(`Buy Limit placed for ${amountPerTrade} at ${roundTwoPlaces(buyDown)} and a sell limit for ${amountPerTrade} at ${roundTwoPlaces(profit)}`);
    }else{
        submitLimit('sell', amountPerTrade ,profit);
        Message.log(`A sell limit for ${amountPerTrade} at ${roundTwoPlaces(profit)} max sells has been reached.`);
    }

}

/**
 * when a sell trade is closed this is called
 * @param {string} orderId
 */
function sellOrderClosed(orderId:string,priceIn:string){
    let price = priceIn;
    Message.log(sellArray);
    if(buyId !='' ) {
        cancelOrder(buyId);
    }
    removeTradeId('sell',orderId);
    submitLimit('buy',  amountPerTrade ,calcBuyDown(price));
    Message.log(`I just closed a Trade for profit. I sold it for ${priceIn}`);
}

/**
 * this is used to calc the buy down interval
 * @returns {number}
 */
function calcBuyDown(price:string){
    let buyPrice = (Number(price) - 0.25 ).toString();
    Message.log(`Calc Buydown price:${price} - 0.25 = ${buyPrice}`);
    return roundTwoPlaces(buyPrice);
}

/**
 * This is used to calc the profit interval. You give it your price and it will return a price for profit.
 * @returns {number}
 */
function calcProfitInterval(price:string){
    let re= (Number(price)+0.25).toString();
    Message.log(`Calc profit price:${price} + 0.25 = ${re}`);
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

//TODO:: Clean this function up it is far too long and messy.

function submitLimit(side: string, amount: string ,price:string,tryNum:number=0) {
    Message.log("side:"+side+' Amount:'+amount+ ' Price:'+roundTwoPlaces(price));
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
            Message.log(`Order to ${side} ${amount} 'LTC-USD' for${price}. Result: ${result.status} 
            
            -------Order-------
            type:${order.type}
            Time:${order.time}
            ProductId:${order.productId}
            OrderType:${order.orderType}
            Side:${order.side}
            Size:${order.size}
            Price:${order.price}
            
            `);

        }).catch(
            function (message:any) {
            Message.sendMessage(`I tried to place an order and it failed.  ${side} ${amount} ${product} for${price}. I got ${message}.
            
            -------Order-------
            type:${order.type}
            Time:${order.time}
            ProductId:${order.productId}
            OrderType:${order.orderType}
            Side:${order.side}
            Size:${order.size}
            Price:${order.price}
            `);
            Message.log(order);

            //So it failed let try spreeing the gap and running it aging.
                if(tryNum==0)
                {
                    if(order.side=="buy"){
                       var newPrice = (Number(order.price) - .03).toString();
                    }else{
                       var newPrice = (Number(order.price) + .02).toString();
                    }
                    submitLimit(order.side, amountPerTrade , newPrice ,1);
                }


        });
    }else{
        Message.sendMessage(`Um I just tried to do a crazy trade. Side:${side} Amount:${amount} ${product} for${price}.`);
        //TODO:: EXIT THE PROGRAM HERE
    }

}


/**
 * This is used to cancel orders
 * @param {string} id this is the ID of the order you would like to cancel
 */
function cancelOrder(id: string){
    //TODO:: Make it check if a partial order has been filled and if not respond accordingly
    gdaxAPI.cancelOrder(id).then(
     function () {
         Message.log(`I canceled order ${id}`);
     }
    ).catch(
        function () {
            Message.log(`I tried to cancel an order and it failed. The Id I was given was ${id}`);
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
