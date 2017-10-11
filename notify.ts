
let nodeMailer = require('nodemailer');

/**
 * This class is used to abstract the sending of notices.
 */
export class Notify {

    constructor() {
    }
    /**
     * this is used to send a txt via a Pre defined sender and receiver
     * @param {string} Message
     */
    sendMessage(Message:string) {
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
}