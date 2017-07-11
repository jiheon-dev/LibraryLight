let M_Express = require("express");

let R_test = M_Express.Router();
console.info("The router is ready: test.");

if(true) // DEBUGGING
{
	R_test.post("/run", function(request, response) {
			console.log("Run this code: ", request.body.code);
			global.responseWith(request, response, eval(request.body.code).toString(), "text/plain");
		});
}

R_test.get("/log", function(request, response) {
		global.responseWith(request, response, global.serverLog, "text/plain", false);
	});

module.exports = R_test;