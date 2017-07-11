const M_bcrypt = require("bcrypt");
const M_path = require("path");
let M_Express = require("express");

let R_general = M_Express.Router();
console.info("The router is ready: general.");

R_general.post("/login", (request, response) => {
		const ID = request.body.ID, password = request.body.password;
		if(!(global.validateID(ID))) global.responseWith(request, response, {success: false, reason: "The ID is not valid."});
		else if(!(global.validatePassword(password))) global.responseWith(request, response, {success: false, reason: "The password is not valid."});
		else
		{
			global.db.collection("accounts").findOne({ID: ID}, {passwordHash: 1, type: 1}).then(function(userAccount) {
					if(!userAccount)
					{
						global.responseWith(request, response, {success: false, reason: "Could not log-in."}); // The account does not exist.
						return;
					}

					M_bcrypt.compare(password, userAccount.passwordHash, function(error, matched) {
							if(error)
							{
								console.error("M_bcrypt.compare error:", error);
								global.responseWith(request, response, {success: false, reason: "An error occurred when comparing the password with the hash!"});
							}
							else if(matched)
							{
								request.session.loggedInAs = ID;
								global.responseWith(request, response, {success: true, type: userAccount.type});
							}
							else
								global.responseWith(request, response, {success: false, reason: "Could not log-in."}); // The password is wrong.
						});
				}).catch((databaseError) => global.dbErrorOccurred(response, databaseError));
		}
	});

R_general.post("/logout", (request, response) => {
		if(request.body.noGET)
		{
			request.session.loggedInAs = null;
			global.responseWith(request, response, {success: true});
		}
		else
			global.responseWith(request, response, {success: false, reason: "noGET is not truthy."});
	});

R_general.get("/bookImage/:ISBN", (request, response) => {
		const inputISBN = request.params.ISBN;
		if(!(global.validateISBN(inputISBN)))
		{
			global.responseWith(request, response, {success: false, reason: "The ISBN is not valid."});
			return;
		}

		response.sendFile(`${inputISBN}.png`, {
				root: M_path.join(__dirname, "../bookImages"),
				acceptRanges: false,
				headers: {
						"x-timestamp": Date.now(),
						"x-sent": true
					}
			}, function finish(error) {
				if(error)
				{
					console.error(`===== Response(${request["SEQUENCE_NUMBER"]}) error =====\n${error}\n${'='.repeat(70)}`);
					response.status(error.status).end();
				}
				else
					console.log(`===== Responsed (${request["SEQUENCE_NUMBER"]}) with an image file =====`);
			});
	});

module.exports = R_general;