import { OrderDoneMessage } from "gdax-trading-toolkit/build/src/core";
import * as GTT from 'gdax-trading-toolkit';
import {GDAX_WS_FEED, GDAXFeedConfig, GDAXFeed} from "gdax-trading-toolkit/build/src/exchanges";
import {GDAX_API_URL} from "gdax-trading-toolkit/build/src/exchanges/gdax/GDAXExchangeAPI";

const logger = GTT.utils.ConsoleLoggerFactory({ level: 'debug' });



let product:string = "LTC-USD";
let nodeMailer = require('nodemailer');
let amountPerTrade:string = '1';
let sellsCounter= 0;
let initMoney = 1070;

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

GTT.Factories.GDAX.getSubscribedFeeds(options, [product]).then((feed: GDAXFeed) => {
    feed.on('data', (msg: OrderDoneMessage) => {
        console.log(msg);
        //recoded the ID and price
        if(msg.type == 'myOrderPlaced'){
            sendMessage(`I just placed and order for ${amountPerTrade} at ${msg.price} on side ${msg.side}`);
        }
        if(msg.type == 'tradeFinalized'){
            console.log('Order Finalized');
            //Trade was filled
            if(msg.reason =="filled" && (msg.remainingSize == '0.00000000'|| msg.remainingSize == '0'))
            {
                //Was it buy or sell
                if(msg.side =="buy"){
                    buyOrderClosed(msg.price);
                }else{
                    sellOrderClosed(msg.orderId);
                }
            }else{
                //TODO:: need to add canceled message tracking
                sendMessage(`non recognized message`);
            }
        }
    });
});

/**
 * when a buy order is closed this is called. All the logic for what should happen on a buy closed is contained with in.
 * @param {string} price
 */
function buyOrderClosed(price:string){
    sendMessage(`I just bought ${amountPerTrade} at ${price}`);}

/**
 * when a sell trade is closed this is called
 * @param {string} orderId
 */
function sellOrderClosed(orderId:string){
    sendMessage(
        `I just closed a Trade for profit. I have now made ${calcProfit()}. And the order ID was ${orderId}`,
        process.env.Email_Profit_User,
        process.env.Email_Profit_Password,
        process.env.Email_Profit_From,
        process.env.Email_Profit_To)
    sellCountUp();
}

/**
 * this is used to send a txt via a Pre defined sender and receiver
 * @param {string} Message
 */
function sendMessage(Message:string,user:string=process.env.Email_User, pass:string=process.env.Email_Password, from:string=process.env.Email_From, to:string=process.env.Email_To) {
    console.log();
    console.log(Message);
    console.log();
    let transporter = nodeMailer.createTransport({
        service: 'gmail',
        auth: {
            user: user,
            pass: pass
        }
    });

    let mailOptions = {
        from: from,
        to: to,
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
 * Calculates the profit that you have made so far
 * TODO::update once variable BD and PI are running. And get rid of the placeholder x log
 * @returns {number}
 */
function calcProfit(){
    let x =  ifSellsClosed() + openBuysTotalMoney() + freeMoney() - initMoney;
    console.log(x);
    return sellsCounter*.25;
}

/**
 * Tracks the amount of sells we have made
 */
function sellCountUp(){
    sellsCounter++;
}

/**
 * This is amount of money that would be in the account if all sells were to close.
 * @returns {number}
 * TODO:: Get the real numbs. I am still thinking about the logic of this
 */
function ifSellsClosed(){
    return 300;
}

/**
 * This is the amount of money that is take by open orders and if we canceled them we would have this much.
 * @returns {number}
 * TODO:: Get the real numbs. I am still thinking about the logic of this
 */
function openBuysTotalMoney(){
    return 250;
}

/**
 * This is the amount of money that is available to be used .
 * @returns {number}
 * TODO:: Get the real numbs. I am still thinking about the logic of this
 */
function freeMoney(){
    return 250;
}