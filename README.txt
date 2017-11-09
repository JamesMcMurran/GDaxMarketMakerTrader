Copyright 2017 James McMurran

Licence:Creative Commons  Attribution-ShareAlike
CC BY-SA


THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


Trader.ts is used for running the maker bot and is the meat of the bot.
Watcher.ts is used to Watch your account for trades and let you know when trades happen.
Listen.py is used for dumping all the stream into a mongodb. This is useful if you would like to use market data to set your buy down and profit intervals


The Goal of this project is to make it so that you can link in your buy down and profit logic and not have to handle anything else.

This project is still in beta as it some times fails to place an order in a response to an event. But it will notify you of this.

Please keep in mind that this is a simple market maker and is used just to place and respond to the trades.
I highly recommend finding a better way of setting the buydown and profit interval.

To run you need to set env vars like so in the console be for running the scripts.
Trader.ts is running then you place a limit trade on the web interface and sit back and let it run.

Also please not that the Gdax folder is included as it is a fork of the original Gdax Python project as I needed to change how it handled a closed socket.

```
#Gdax settings
export GDAX_KEY="";
export GDAX_SECRET="";
export GDAX_PASSPHRASE="";

#You can put the email for email2txt so get txt's on your phone

#noice email settings
export Email_User="";
export Email_Password="";
export Email_From="";
export Email_To="";

#profit email settings I like to have a different sound effect for this one as this is the fun one.
export Email_Profit_User="";
export Email_Profit_Password="";
export Email_Profit_From="";
export Email_Profit_To="";

#the max sell orders that it can have open
export MAX_SELL_ORDERS=3;
#this was for an experiment where the more open sells it had the bigger the buy down would get
export EXP_BUYDOWN_SLOWDOWN=1;
```