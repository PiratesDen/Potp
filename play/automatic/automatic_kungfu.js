var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

var stats_canvas = document.getElementById("stats_canvas");
var stats_ctx = stats_canvas.getContext("2d");

var NONCONFORM = 1.00;
var BIAS = 0.33;
var TILE_SIZE = 30;
var PEEP_SIZE = 30;
var GRID_SIZE = 20;
var DIAGONAL_SQUARED = (TILE_SIZE+5)*(TILE_SIZE+5) + (TILE_SIZE+5)*(TILE_SIZE+5);

var DEBUGGING = true; // Set this to true when running test case.
Math.seed = 6; // Initial seed for Math.seededRandom()

var kungfuLog = [];

window.RATIO_TRIANGLES = 0.5;
window.RATIO_SQUARES = 0.5;
window.EMPTINESS = 0.2;


var assetsLeft = 0;
var onImageLoaded = function(){
	assetsLeft--;
};

var images = {};
function addAsset(name,src){
	assetsLeft++;
	images[name] = new Image();
	images[name].onload = onImageLoaded;
	images[name].src = src;
}
addAsset("yayTriangle","../img/yay_triangle.png");
addAsset("mehTriangle","../img/meh_triangle.png");
addAsset("sadTriangle","../img/sad_triangle.png");
addAsset("yaySquare","../img/yay_square.png");
addAsset("mehSquare","../img/meh_square.png");
addAsset("sadSquare","../img/sad_square.png");

var IS_PICKING_UP = false;
var lastMouseX, lastMouseY;

Math.seededRandom = function(max, min) {
    max = max || 1;
    min = min || 0;
 
    Math.seed = (Math.seed * 9301 + 49297) % 233280;
    var rnd = Math.seed / 233280;
 
    return min + rnd * (max - min);
}

function Draggable(x,y){
	
	var self = this;
	self.x = x;
	self.y = y;
	self.gotoX = x;
	self.gotoY = y;

	var offsetX, offsetY;
	var pickupX, pickupY;
	self.pickup = function(){

		IS_PICKING_UP = true;

		pickupX = (Math.floor(self.x/TILE_SIZE)+0.5)*TILE_SIZE;
		pickupY = (Math.floor(self.y/TILE_SIZE)+0.5)*TILE_SIZE;
		offsetX = Mouse.x-self.x;
		offsetY = Mouse.y-self.y;
		self.dragged = true;

		// Dangle
		self.dangle = 0;
		self.dangleVel = 0;

		// Draw on top
		var index = draggables.indexOf(self);
		draggables.splice(index,1);
		draggables.push(self);

	};

	self.drop = function(){

		IS_PICKING_UP = false;

		var px = Math.floor(Mouse.x/TILE_SIZE);
		var py = Math.floor(Mouse.y/TILE_SIZE);
		if(px<0) px=0;
		if(px>=GRID_SIZE) px=GRID_SIZE-1;
		if(py<0) py=0;
		if(py>=GRID_SIZE) py=GRID_SIZE-1;
		var potentialX = (px+0.5)*TILE_SIZE;
		var potentialY = (py+0.5)*TILE_SIZE;

		var spotTaken = false;
		for(var i=0;i<draggables.length;i++){
			var d = draggables[i];
			if(d==self) continue;
			var dx = d.x-potentialX;
			var dy = d.y-potentialY;
			if(dx*dx+dy*dy<10){
				spotTaken=true;
				break;
			}
		}

		if(spotTaken){
			self.gotoX = pickupX;
			self.gotoY = pickupY;
		}else{
			
			STATS.steps++;
			writeStats();

			self.gotoX = potentialX;
			self.gotoY = potentialY;
		}

		self.dragged = false;

	}

	var lastPressed = false;
	self.update = function(){

		// Shakiness?
		self.shaking = false;
		self.bored = false;

		if(!self.dragged){
			var neighbors = 0;
			var same = 0;
			for(var i=0;i<draggables.length;i++){
				var d = draggables[i];
				if(d==self) continue;
				var dx = d.x-self.x;
				var dy = d.y-self.y;
				if(dx*dx+dy*dy<DIAGONAL_SQUARED){
					neighbors++;
					if(d.color==self.color){
						same++;
					}
				}
			}
			if(neighbors>0){
				self.sameness = (same/neighbors);
			}else{
				self.sameness = 1;
			}
			if(self.sameness<BIAS || self.sameness>NONCONFORM){
				self.shaking = true;
			}
			if(self.sameness>0.99){
				self.bored = true;
			}
			if(neighbors==0){
				self.shaking = false;
			}
		}

		// Dragging
		if(!self.dragged){
			if((self.shaking||window.PICK_UP_ANYONE) && Mouse.pressed && !lastPressed){
				var dx = Mouse.x-self.x;
				var dy = Mouse.y-self.y;
				if(Math.abs(dx)<PEEP_SIZE/2 && Math.abs(dy)<PEEP_SIZE/2){
					self.pickup();
				}
			}
		}else{
			self.gotoX = Mouse.x - offsetX;
			self.gotoY = Mouse.y - offsetY;
			if(!Mouse.pressed){
				self.drop();
			}
		}
		lastPressed = Mouse.pressed;

		// Going to where you should
		self.x = self.x*0.5 + self.gotoX*0.5;
		self.y = self.y*0.5 + self.gotoY*0.5;

	};

	self.frame = 0;
	self.draw = function(){
		ctx.save();
		ctx.translate(self.x,self.y);
		
		if(self.shaking){
			self.frame+=0.07;
			ctx.translate(0,20);
			ctx.rotate(Math.sin(self.frame-(self.x+self.y)/200)*Math.PI*0.05);
			ctx.translate(0,-20);
		}

		// Draw thing
		var img;
		if(self.color=="triangle"){
			if(self.shaking){
				img = images.sadTriangle;
			}else if(self.bored){
				img = images.mehTriangle;
			}else{
				img = images.yayTriangle;
			}
		}else{
			if(self.shaking){
				img = images.sadSquare;
			}else if(self.bored){
				img = images.mehSquare;
			}else{
				img = images.yaySquare;
			}
		}

		// Dangle
		if(self.dragged){
			self.dangle += (lastMouseX-Mouse.x)/100;
			ctx.rotate(-self.dangle);
			self.dangleVel += self.dangle*(-0.02);
			self.dangle += self.dangleVel;
			self.dangle *= 0.9;
		}

		ctx.drawImage(img,-PEEP_SIZE/2,-PEEP_SIZE/2,PEEP_SIZE,PEEP_SIZE);
		ctx.restore();
	};

}

window.START_SIM = false;

var draggables;
var STATS;
window.reset = function(){

	STATS = {
		steps:0,
		offset:0
	};
	START_SIM = false;

	stats_ctx.clearRect(0,0,stats_canvas.width,stats_canvas.height);

	draggables = [];
    if(DEBUGGING === false){
        for(var x=0;x<GRID_SIZE;x++){
            for(var y=0;y<GRID_SIZE;y++){
                if(Math.random()<(1-window.EMPTINESS)){
                    var draggable = new Draggable((x+0.5)*TILE_SIZE, (y+0.5)*TILE_SIZE);
                    draggable.color = (Math.random()<window.RATIO_TRIANGLES) ? "triangle" : "square";
                    draggables.push(draggable);
                }
            }
        }
    }
    else{
        for(var x=0;x<GRID_SIZE;x++){
            for(var y=0;y<GRID_SIZE;y++){
                if(Math.seededRandom(1,0)<(1-window.EMPTINESS)){
                    var draggable = new Draggable((x+0.5)*TILE_SIZE, (y+0.5)*TILE_SIZE);
                    draggable.color = (Math.seededRandom(1,0)<window.RATIO_TRIANGLES) ? "triangle" : "square";
                    draggables.push(draggable);
                }
            }
        }
    }

	// Write stats for first time
	for(var i=0;i<draggables.length;i++){
		draggables[i].update();
	}
	writeStats();

}

window.render = function(){

	if(assetsLeft>0 || !draggables) return;
	
	// Is Stepping?
	if(START_SIM){
		step();
	}

	// Draw
	Mouse.isOverDraggable = IS_PICKING_UP;
	ctx.clearRect(0,0,canvas.width,canvas.height);
	for(var i=0;i<draggables.length;i++){
		var d = draggables[i];
		d.update();

		if(d.shaking || window.PICK_UP_ANYONE){
			var dx = Mouse.x-d.x;
			var dy = Mouse.y-d.y;
			if(Math.abs(dx)<PEEP_SIZE/2 && Math.abs(dy)<PEEP_SIZE/2){
				Mouse.isOverDraggable = true;
			}
		}

	}
	for(var i=0;i<draggables.length;i++){
		draggables[i].draw();
	}

	// Done stepping?
	if(isDone()){
		doneBuffer--;
		if(doneBuffer==0){
			doneAnimFrame = 30;
			START_SIM = false;
			console.log("DONE");
			writeStats();
		}
	}else if(START_SIM){
		
		STATS.steps++;
		doneBuffer = 30;

		// Write stats
		writeStats();

	}
	if(doneAnimFrame>0){
		doneAnimFrame--;
		var opacity = ((doneAnimFrame%15)/15)*0.2;
		canvas.style.background = "rgba(255,255,255,"+opacity+")";
	}else{
		canvas.style.background = "none";
	}

	// Mouse
	lastMouseX = Mouse.x;
	lastMouseY = Mouse.y;

}
var stats_text = document.getElementById("stats_text");

var tmp_stats = document.createElement("canvas");
tmp_stats.width = stats_canvas.width;
tmp_stats.height = stats_canvas.height;

var curSegregation = -1;
window.writeStats = function(){

	if(!draggables || draggables.length==0) return;

	// Average Sameness Ratio
	var total = 0;
	for(var i=0;i<draggables.length;i++){
		var d = draggables[i];
		total += d.sameness || 0;
	}
	var avg = total/draggables.length;
	if(isNaN(avg)) debugger;

	// If stats oversteps, bump back
	if(STATS.steps>320+STATS.offset){
		STATS.offset += 120;
		var tctx = tmp_stats.getContext("2d");
		tctx.clearRect(0,0,tmp_stats.width,tmp_stats.height);
		tctx.drawImage(stats_canvas,0,0);
		stats_ctx.clearRect(0,0,stats_canvas.width,stats_canvas.height);
		stats_ctx.drawImage(tmp_stats,-119,0);
	}

	// AVG -> SEGREGATION
	var segregation = (avg-0.5)*2;
    if(segregation<0) segregation=0;
    if(curSegregation != -1){
        if(Math.abs(segregation - curSegregation) >= .015){
            //slow down simulation
            animationSpeed = 100000000;
            console.log(curSegregation + ',' + segregation + "," + '"threshold hit",\n');
            kungfuLog.push(curSegregation, segregation, "threshold hit");
        }
        else {
            console.log(curSegregation + ',' + segregation + "," + '"",\n');
            kungfuLog.push(curSegregation, segregation, "");
        }
    }
    curSegregation = segregation;

	// Graph it
	stats_ctx.fillStyle = "#cc2727";
	var x = STATS.steps - STATS.offset;
	var y = 250 - segregation*250+10;
	stats_ctx.fillRect(x,y,1,5);

	// Text
	stats_text.innerHTML = Math.floor(segregation*100)+"%";
	stats_text.style.top = Math.round(y-15)+"px";
	stats_text.style.left = Math.round(x+35)+"px";

	// Button
	if(START_SIM){
		document.getElementById("moving").classList.add("moving");
	}else{
		document.getElementById("moving").classList.remove("moving");
	}

}

var doneAnimFrame = 0;
var doneBuffer = 30;
function isDone(){
	if(Mouse.pressed) return false;
	for(var i=0;i<draggables.length;i++){
		var d = draggables[i];
		if(d.shaking) return false;
	}
    
    if(DEBUGGING === true){
        kungfuTestCase();
        DEBUGGING = false;
    }
    
	return true;
}

function step(){

	// Get all shakers
	var shaking = [];
	for(var i=0;i<draggables.length;i++){
		var d = draggables[i];
		if(d.shaking) shaking.push(d);
	}

	// Pick a random shaker
	if(shaking.length==0) return;
    if(DEBUGGING === false){
        var shaker = shaking[Math.floor(Math.random()*shaking.length)];
    }
    else{
        var shaker = shaking[Math.floor(Math.seededRandom(1,0)*shaking.length)];
    }

	// Go through every spot, get all empty ones
	var empties = [];
	for(var x=0;x<GRID_SIZE;x++){
		for(var y=0;y<GRID_SIZE;y++){

			var spot = {
				x: (x+0.5)*TILE_SIZE,
				y: (y+0.5)*TILE_SIZE
			}

			var spotTaken = false;
			for(var i=0;i<draggables.length;i++){
				var d = draggables[i];
				var dx = d.gotoX-spot.x;
				var dy = d.gotoY-spot.y;
				if(dx*dx+dy*dy<10){
					spotTaken=true;
					break;
				}
			}

			if(!spotTaken){
				empties.push(spot);
			}

		}
	}

	// Go to a random empty spot
    if(DEBUGGING === false){
        var spot = empties[Math.floor(Math.random()*empties.length)];
    }
    else{
        var spot = empties[Math.floor(Math.seededRandom(1,0)*empties.length)];
    }
	if(!spot) return;
    PolygonAnimationSpeed(shaker, spot);

}
var distanceX; var xAnimatedStep;
var distanceY; var yAnimatedStep;
var animationSpeed = 1; // 1,000,000,000
function PolygonAnimationSpeed(shaker, spot){
    distanceX = shaker.x - spot.x;
	distanceY = shaker.y - spot.y;
    xAnimatedStep = distanceX = distanceX / animationSpeed;
    yAnimatedStep = distanceY = distanceY / animationSpeed;
    for(var i = animationSpeed; i > 0; --i){ 
        shaker.gotoX = distanceX; distanceX = distanceX + xAnimatedStep;
        shaker.gotoY = distanceY; distanceY = distanceY + yAnimatedStep;
    }
    shaker.gotoX = spot.x;
	shaker.gotoY = spot.y;
    //reset to normal animation speed
    animationSpeed = 1;
}

var kungfuTestCaseOutput = [
0,0,"",
0,0,"",
0,0,"",
0,0,"",
0,0,"",
0,0,"",
0,0,"",
0,0,"",
0,0,"",
0,0,"",
0,0.0005729955116469121,"",
0.0005729955116469121,0.0014899211218237784,"",
0.0014899211218237784,0.007259713701432302,"",
0.007259713701432302,0.01785957736878019,"",
0.01785957736878019,0.01950530723536903,"",
0.01950530723536903,0.01942120592427421,"",
0.01942120592427421,0.021219203427792932,"",
0.021219203427792932,0.02432077125328691,"",
0.02432077125328691,0.0365468886941287,"",
0.0365468886941287,0.03710926088226785,"",
0.03710926088226785,0.037296718278314156,"",
0.037296718278314156,0.03508131268867509,"",
0.03508131268867509,0.03971175382218384,"",
0.03971175382218384,0.04566590532848269,"",
0.04566590532848269,0.04435436751387756,"",
0.04435436751387756,0.04588810984516556,"",
0.04588810984516556,0.048906904275002994,"",
0.048906904275002994,0.05224218521764579,"",
0.05224218521764579,0.058683903009056904,"",
0.058683903009056904,0.05883971175382241,"",
0.05883971175382241,0.06678042475588541,"",
0.06678042475588541,0.07116564417177917,"",
0.07116564417177917,0.071886259616321,"",
0.071886259616321,0.07520449897750492,"",
0.07520449897750492,0.08291459733177509,"",
0.08291459733177509,0.08612328366929578,"",
0.08612328366929578,0.07835232252410118,"",
0.07835232252410118,0.08800759567630645,"",
0.08800759567630645,0.09261856071672026,"",
0.09261856071672026,0.09948144902132583,"",
0.09948144902132583,0.09866345311130553,"",
0.09866345311130553,0.10416058038757336,"",
0.10416058038757336,0.11536663745252596,"",
0.11536663745252596,0.11431005940208316,"",
0.11431005940208316,0.11682490992306871,"",
0.11682490992306871,0.12445953841659274,"",
0.12445953841659274,0.1278118609406944,"",
0.1278118609406944,0.12891226020060342,"",
0.12891226020060342,0.1334136722173529,"",
0.1334136722173529,0.14166423215502943,"",
0.14166423215502943,0.14607556724121085,"",
0.14607556724121085,0.15108579219008678,"",
0.15108579219008678,0.15762002142370246,"",
0.15762002142370246,0.1626156393027558,"",
0.1626156393027558,0.16796426136916942,"",
0.16796426136916942,0.17336887720323313,"",
0.17336887720323313,0.1722392638036807,"",
0.1722392638036807,0.17941863862109275,"",
0.17941863862109275,0.18251046840003893,"",
0.18251046840003893,0.19607069821793788,"",
0.19607069821793788,0.19050540461583432,"",
0.19050540461583432,0.1917104878761322,"",
0.1917104878761322,0.20093485246859522,"",
0.20093485246859522,0.2055725971370148,"",
0.2055725971370148,0.20108579219008704,"",
0.20108579219008704,0.20711607751485106,"",
0.20711607751485106,0.21864349011588313,"",
0.21864349011588313,0.21802999318336802,"",
0.21802999318336802,0.2222295257571334,"",
0.2222295257571334,0.23633995520498607,"",
0.23633995520498607,0.2296012269938652,"",
0.2296012269938652,0.2254211705131952,"",
0.2254211705131952,0.22318872334209772,"",
0.22318872334209772,0.22561106242087847,"",
0.22561106242087847,0.2306772811374036,"",
0.2306772811374036,0.2351738241308794,"",
0.2351738241308794,0.24203914694712236,"",
0.24203914694712236,0.24297156490408045,"",
0.24297156490408045,0.2419734151329247,"",
0.2419734151329247,0.24513230464150748,"",
0.24513230464150748,0.26231375985977157,"threshold hit",
0.26231375985977157,0.2675869120654395,"",
0.2675869120654395,0.27407001655467855,"",
0.27407001655467855,0.28177037686240114,"",
0.28177037686240114,0.2903057746616027,"",
0.2903057746616027,0.29540851105268273,"",
0.29540851105268273,0.3022957444736589,"",
0.3022957444736589,0.3122066413477451,"",
0.3122066413477451,0.3186946148602592,"",
0.3186946148602592,0.3235173824130879,"",
0.3235173824130879,0.3260151913526146,"",
0.3260151913526146,0.3323035349108967,"",
0.3323035349108967,0.3377738825591585,"",
0.3377738825591585,0.3487730061349692,"",
0.3487730061349692,0.35195734735612016,"",
0.35195734735612016,0.3498441912552339,"",
0.3498441912552339,0.3555872042068362,"",
0.3555872042068362,0.3543967280163598,"",
0.3543967280163598,0.35908316291751863,"",
0.35908316291751863,0.350065731814198,"",
0.350065731814198,0.35767358067971555,"",
0.35767358067971555,0.366997760249294,"",
0.366997760249294,0.368317265556529,"",
0.368317265556529,0.3698583114227283,"",
0.3698583114227283,0.37858603564125093,"",
0.37858603564125093,0.3656514753140523,"",
0.3656514753140523,0.35911481156879965,"",
0.35911481156879965,0.36968059207323,"",
0.36968059207323,0.3778191644756064,"",
0.3778191644756064,0.3898846041484083,"",
0.3898846041484083,0.3907269451747981,"",
0.3907269451747981,0.3948217937481744,"",
0.3948217937481744,0.4028946343363524,"",
0.4028946343363524,0.4027485636381347,"",
0.4027485636381347,0.4059012562080053,"",
0.4059012562080053,0.4052901937871274,"",
0.4052901937871274,0.4067338591878473,"",
0.4067338591878473,0.40409971759665075,"",
0.40409971759665075,0.40481302950628195,"",
0.40481302950628195,0.4071233810497621,"",
0.4071233810497621,0.4203719933781287,"",
0.4203719933781287,0.4258812932125824,"",
0.4258812932125824,0.4252458856753343,"",
0.4252458856753343,0.4238533450189901,"",
0.4238533450189901,0.42326906222611815,"",
0.42326906222611815,0.44107508033888454,"threshold hit",
0.44107508033888454,0.4483128834355832,""];

window.kungfuTestCase = function(){
    
    // Check if the output we got is the same as the expected output
    for(var i = 0; i < kungfuLog.length; i++){
        if(kungfuLog[i] !== kungfuTestCaseOutput[i]){
            console.log("KUNGFU test case failed: " + kungfuLog[i] + " !== " + kungfuTestCaseOutput[i]);
            return;
        }
    }
    
    console.log("KUNGFU test case succeeded.");
}

////////////////////
// ANIMATION LOOP //
////////////////////
window.requestAnimFrame = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	function(callback){ window.setTimeout(callback, 1000/60); };
(function animloop(){
	requestAnimFrame(animloop);
	if(window.IS_IN_SIGHT){
		render();
	}
})();

window.IS_IN_SIGHT = false;

window.onload=function(){
	reset();
}