var d3;

var toggle=true,
 clientSocket,
 owidth=$("#svgchart").attr("width"),
 stock_symbols=[],
 data=[],
 oticks=12,
 otickformat="%b'%y",
 omult=1;

//drawer logic
$("#drawer_toggle").click(function(){
  if(toggle){
    $("#bottom_drawer").animate({height:"40vh"});
  }else{
    $("#bottom_drawer").animate({height:"35px"});
  }
  toggle=!toggle;
});

//window events
$(document).ready(function(){
  clientSocket = new WebSocket('wss://stock-chart.glitch.me');
  clientSocket.onmessage=function(msg){
    
    msg=JSON.parse(msg.data);
    
    if(msg.type=="add_stock" && stock_symbols.indexOf(msg.quotes.code)==-1){
      stock_symbols.push(msg.quotes.code);
      drawChart(msg.quotes);
    }else if(msg.type=="data"){
      data=msg.data;
      if(data.length==0)
        get_stock("FB");
      else
        drawChart(null,true);
      
    }else if(msg.type=="remove")
      remove(msg.toRemove);
    
  }
  owidth=$("#chart").width();
  $("#svgchart").attr("width",owidth);
  $("#svgchart").attr("height",$("#chart").height()-40);
  $("#svgchart").css("height",$("#chart").height()-40+8);
});

window.onresize=function(){
  owidth=$("#chart").width();
  $("#svgchart").attr("height",$("#chart").height()-40);
  $("#svgchart").css("height",$("#chart").height()-40+8);
  drawChart();
};

//mouse events
$(document).on("click",".badge",function(){
  remove($(this).attr("data"));
});

$("#add_stock").click(function(){
  add_stock($("#stock_code").val().trim().toUpperCase());
});

$(".btn-group .btn").click(function(){
  var text=$(this).text();
  otickformat="%d.%b";
  switch(text){
    case "1M":
      omult=12;
      oticks=144;
    break;
    case "3M":
      omult=4;
      oticks=48;
    break;
    case "6M":
      omult=2;
      oticks=27;
    break;
    case "1Y":
      omult=1;
      oticks=12;
      otickformat="%b'%y";
    break;
   }
  drawChart(null);
});

//keyboard events
$("#stock_code").keyup(function(event){
  if(event.keyCode==13){
    $("#add_stock").click();
  }
});

//functions
function get_stock(symbol){
  $("#rloader").css("display","inline-block");
  $.post('/get_stock',{symbol:symbol},function(res){
    $("#rloader").css("display","none");
    if(res.error){
      $("#error").css("display","block"); 
      $("#error").text(res.error);
    }else{
      $("#error").css("display","none"); 
      $("#stock_code").val("");
    }
  });
}

function remove(toRemove){
  stock_symbols.splice(stock_symbols.indexOf(toRemove), 1);
  var ti=-1;
  data.forEach(function(e,i){
    if(e.code==toRemove){
      ti=i;
    }
  });
  if(ti!=-1){
    $(".badge[data='"+toRemove+"']").parent().remove();
    clientSocket.send(toRemove);
    data.splice(ti,1);
    drawChart();
  }
}

function add_stock(code){
  if(code!="" && stock_symbols.indexOf(code)==-1){
    get_stock(code);
  }
}

function drawChart(resp,formatdata){
  $("#svgchart").html("");
  d3.select("#svgchart").on("mousemove",function(){});
  if(data.length==0 && !resp){
    $("#nst").css("display","inline-block");
    $("#svgchart").css("display","none");
    $(".date").css("display","none");
    return;
  }else{
    $("#nst").css("display","none");
    $("#svgchart").css("display","inline-block");
  }
  $("#svgchart").attr("width",owidth*omult);
  var parseTime = d3.timeParse("%Y-%m-%d");
  if(resp){
    var datar=resp.data.map(function(d){
      var dn={};
      dn.date=parseTime(d.date.substring(0,d.date.indexOf("T")));
      dn.close=d.close;
      return dn;
    });
    
    $.get("https://query.yahooapis.com/v1/public/yql?q=select%20Name%20from%20yahoo.finance.quotes%20where%20symbol%3D'"+resp.code+"'%0A&format=json&diagnostics=true&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=",function(stock){
      $("#stocks").append('<li class="list-group-item">'+stock.query.results.quote.Name+'<span data="'+resp.code+'" class="badge badge-default badge-pill">&times</span>');
    $("#rloader").css("display","none");
    });
    data.push({code:resp.code,data:datar});
  }else if(formatdata){
    data=data.map(function(d,i){
      stock_symbols.push(d.code);
      $.get("https://query.yahooapis.com/v1/public/yql?q=select%20Name%20from%20yahoo.finance.quotes%20where%20symbol%3D'"+d.code+"'%0A&format=json&diagnostics=true&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=",function(stock){
        $("#stocks").append('<li class="list-group-item">'+stock.query.results.quote.Name+'<span data="'+d.code+'" class="badge badge-default badge-pill">&times</span>');
        if(i==data.length-1){
          $("#rloader").css("display","none");
        }
      });
      var datar=d.data.map(function(d2){
        var dn={};
        dn.date=parseTime(d2.date.substring(0,d2.date.indexOf("T")));
        dn.close=d2.close;
        return dn;
      });
      return {code:d.code,data:datar};
    });
  }
  var svg = d3.select("#svgchart"),
  margin = {top: 20, right: 10, bottom: 10, left: 20},
  width = +svg.attr("width") - margin.left - margin.right,
  height = +svg.attr("height") - margin.top - margin.bottom;
  
  svg.on("mousemove",function(){
    var xc = d3.mouse(this)[0]-margin.left;
    var yc = d3.mouse(this)[1]-margin.top;
    if(xc>=0 && xc<=width && yc>=0 && yc<=height){
      hoverLine.attr("x1", xc).attr("x2", xc).style("opacity", 1);
      var date=x.invert(xc);

      var tipHtml=format(date);
      data.forEach(function(d){
        var item = d.data[bisect(d.data,date)];
        tipHtml+= '<br/><svg style="height:10px" width="10"><g><circle cx="5" cy="5" r="5" stroke="black" stroke-width="1" fill="'+z(d.code)+
          '"/></g></svg>'+d.code+" : "+item.close;
      });

      
      var off=0;
      if((width-xc)<$("#tip").width()){
        off+=$("#tip").width()+30;
      }
      tooltip.html(tipHtml)	
          .style("left", (d3.event.pageX+10-off) + "px")		
          .style("top", (d3.event.pageY - 28) + "px");
      tooltip.style("display","block");
    }else{
      hoverLine.style("opacity", 1e-6);
      tooltip.style("display","none");
    }
  }).on("mouseout", function() {
    hoverLine.style("opacity", 1e-6);
      tooltip.style("display","none");
  });
  
  var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  
  var x = d3.scaleTime()
      .rangeRound([0, width]),
    y = d3.scaleLinear()
        .rangeRound([height, 0]),
    z = d3.scaleOrdinal(d3.schemeCategory20);

  var line = d3.line()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d.close); });

	var format = d3.timeFormat("%A, %b %d, %Y");
  var mindate=d3.min(data, function(c) { return d3.min(c.data, function(d) { return d.date; }); });
  var maxdate=d3.max(data, function(c) { return d3.max(c.data, function(d) { return d.date; }); });
  x.domain([mindate,maxdate]);
  
  $(".date").css("display","inline-block");
  if(mindate){
    $("#from").text("From : "+format(mindate));
    $("#to").text("To : "+format(maxdate));
  }else
  $(".date").css("display","none");
  
  y.domain([
      d3.min(data, function(c) { return d3.min(c.data, function(d) { return d.close; }); }),
      d3.max(data, function(c) { return d3.max(c.data, function(d) { return d.close; }); })
    ]);

  z.domain(data.map(function(c) { return c.code; }));
  
  g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).ticks(owidth*omult/100).tickFormat(d3.timeFormat(otickformat)));
  
  function make_y_gridlines() {		
      return d3.axisLeft(y)
          .ticks(10)
  }
  
  var yaxis=g.append("g")
      .attr("transform", "translate(" + width + ",0)")
      .call(d3.axisRight(y));
 yaxis.selectAll("text")
   .style("text-anchor", "start")
   .attr("transform", "translate(-30, 0)");
  yaxis.append("text")
    .attr("fill", "#000")
    .attr("transform", "rotate(-90)")
    .attr("y", -30)
    .attr("x", 20)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end")
    .text("Price ($)");
  
  var hoverLine=g.append("g").attr("class", "hover-line")
      .append("line")
      .attr("stroke", "#000")
      .attr("x1", 10).attr("x2", 10) 
      .attr("y1", 0).attr("y2", height).style("opacity", 1e-6);
  
  var tooltip=d3.select("#tip");
  
  var bisect = d3.bisector(function(d) { return d.date; }).right;
  var stocksg = g.selectAll(".stocksg")
    .data(data)
    .enter().append("g");
  
  stocksg.append("path")
      .attr("class", "line")
      .attr("d", function(d) { return line(d.data); })
          .attr("fill", "none")
      .style("stroke", function(d) { return z(d.code); }).attr("class", "stocksg");
  
  g.append("g")			
      .attr("class", "grid")
      .call(make_y_gridlines()
          .tickSize(-width)
          .tickFormat("")
      )
    .select(".domain")
      .style("stroke","lightgrey");
}