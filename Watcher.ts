import { OrderDoneMessage } from "gdax-trading-toolkit/build/src/core";
import * as GTT from 'gdax-trading-toolkit';
import {GDAX_WS_FEED, GDAXFeedConfig, GDAXFeed} from "gdax-trading-toolkit/build/src/exchanges";
import {GDAX_API_URL} from "gdax-trading-toolkit/build/src/exchanges/gdax/GDAXExchangeAPI";

const logger = GTT.utils.ConsoleLoggerFactory({ level: 'debug' });



let product:string = "LTC-USD";
let nodeMailer = require('nodemailer');
let amountPerTrade:string = '1';
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
        `I just closed a Trade for profit${orderId}`,
        process.env.Email_Profit_User,
        process.env.Email_Profit_Password,
        process.env.Email_Profit_From,
        process.env.Email_Profit_To)
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