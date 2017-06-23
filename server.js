var express = require('express'),
 expressws = require('express-ws')(express()),
 app = expressws.app;

app.use(express.static('public'));

var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var googleFinance = require('google-finance'),
 moment=require('moment');

const clients = []
app.ws('/', (ws, req) => {
  ws.send(JSON.stringify({type:"data",data:stocks}));
  ws.on('message', function(toRemove){
    var ti=-1;
    stocks.forEach(function(e,i){
      if(e.code==toRemove){
        ti=i;
      }
    });
    if(ti!=-1){
      clients.forEach(c=>c.send(JSON.stringify({type:"remove",toRemove:toRemove})))
      stocks.splice(ti,1);
    }
  });
  clients.push(ws);
  ws.on('close', function(){
    clients.splice(clients.indexOf(ws),1);
  });
})

app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

var stocks=[];
app.post("/get_stock",function(req,res){
  
  var getStock=stocks.every(function(e){
    if(e.code==req.body.symbol){
      res.send("success");
      var add_stock={type:"add_stock",quotes:e};
      clients.forEach(function(c){
        c.send(JSON.stringify(add_stock));
      });
      return false;
    }else return true;
  });
  
  if(getStock){
    var d=new Date();
    var to=moment(d).format("YYYY-MM-DD");
    d.setFullYear(d.getFullYear()-1);
    var from=moment(d).format("YYYY-MM-DD");
    
    googleFinance.historical({symbol:req.body.symbol,from:from,to:to}, function (err, quotes) {
      if(err){
        res.send({error:err});
      }else{
        if(quotes.length==0)
          res.send({error:"Invalid code."});
        else{
          quotes={code:req.body.symbol,data:quotes};
          stocks.push(quotes);
          res.send("success");
          clients.forEach(function(c){
            c.send(JSON.stringify({type:"add_stock",quotes:quotes}));
          });
        }
      }
    });
  }
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});