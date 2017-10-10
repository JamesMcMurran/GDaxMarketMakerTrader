interface LooseObject {
    [key: string]: any
}
var orderId = '81f7c32f-2246-452c-9fd5-36df93af61af';
var price = '23.33'
var sellArray: LooseObject = {};
sellArray[orderId] = price;
delete sellArray[orderId];

var orderId = 'bc9f5c71-e7af-4000-8791-02cd953efbd0';
var price = '74.22'

sellArray[orderId] = price;
console.log(sellArray);

if(typeof sellArray['sadasdwacd2as'] == "undefined"){
    console.log('WORKS')
}
