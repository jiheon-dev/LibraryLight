var M_Express = require("express");

var R_administrator = M_Express.Router();
console.info("The router is ready: administrator.");

R_administrator.post("/addBook", function(request, response) {
		const ISBN = request.body.ISBN, bookCode = request.body.bookCode;
		if(!(global.validateISBN(ISBN))) global.responseWith(request, response, {success: false, reason: "The ISBN is not valid."});
		else if(!(global.validateBookCode(bookCode))) global.responseWith(request, response, {success: false, reason: "The book code is not valid."});
		else
		{
			global.checkAccountType(response, "administrator", request.session.loggedInAs).then(function(account) {
					global.db.collection("books").updateOne({
							libraryID: account.information.libraryID,
							bookCode: bookCode
						}, {$setOnInsert: {
							libraryID: account.information.libraryID,
							bookCode: bookCode,
							bookcaseNumber: null,
							ISBN: ISBN,
							bookcaseUpdatedAt: null
						}}, {upsert: true}).then(function(queryResult) {
							if(queryResult["upsertedId"]) global.responseWith(request, response, {success: true});
							else
								global.responseWith(request, response, {success: false, reason: "The book already exists."});
						}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
				});
		}
	});

R_administrator.post("/getLibraryInformation", function(request, response) {
		if(!(request.body.noGET))
		{
			global.responseWith(request, response, {"success": false, "reason": "noGET is not truthy."});
			return;
		}

		global.checkAccountType(response, "administrator", request.session.loggedInAs).then(function(account) {
				try
				{
					global.db.collection("libraries").findOne({"libraryID": account.information.libraryID}).then(function(theLibraryInformation) {
							global.responseWith(request, response, {
									"success": true,
									"libraryID": theLibraryInformation.libraryID,
									"libraryAPIToken": theLibraryInformation.libraryAPIToken,
									"userCodes": theLibraryInformation.userCodes
								});
						}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
				}
				catch(error) // account.information.libraryID
				{
					console.error("A fatal error occurred. Something may be wrong with the database. The error: ", error);
				}
			});
	});

R_administrator.post("/getUserCodes", function(request, response) {
		if(!(request.body.noGET))
		{
			global.responseWith(request, response, {"success": false, "reason": "noGET is not truthy."});
			return;
		}

		global.checkAccountType(response, "administrator", request.session.loggedInAs).then(function(account) {
				try
				{
					global.db.collection("userCodes").find({
							"libraryID": account.information.libraryID
						}, {
							"libraryID": 1,
							"userCode": 1,
							"userID": 1,
							"permission": 1,
							"_id": 0
						}).toArray(function(databaseError, userCodeDocumentArray) {
							if(databaseError) global.dbErrorOccurred(response, databaseError);
							else
								global.responseWith(request, response, {"success": true, "userCodes": userCodeDocumentArray});
						});
				}
				catch(error) // account.information.libraryID
				{
					console.error("A fatal error occurred. Something may be wrong with the database. The error: ", error);
				}
			});
	});

R_administrator.post("/newUserCode", function(request, response) {
		if(!(request.body.noGET))
		{
			global.responseWith(request, response, {"success": false, "reason": "noGET is not truthy."});
			return;
		}

		global.checkAccountType(response, "administrator", request.session.loggedInAs).then(function(account) {
				try
				{
					const newUserCode = global.generateRandomUppercaseAlphanumericString(7); // 36^7 = 78364164096 cases.
					global.db.collection("userCodes").updateOne({
							libraryID: account.information.libraryID,
							userCode: newUserCode
						}, {$setOnInsert: {
							libraryID: account.information.libraryID,
							userCode: newUserCode,
							userID: null,
							permission: {"borrowable": false, "lightable": false}
						}}, {upsert: true}).then(function(queryResult) {
							if(queryResult && queryResult.upsertedCount === 1) global.responseWith(request, response, {success: true, theNewUserCode: newUserCode});
							else
								global.responseWith(request, response, {success: false, reason: "Could not generate a new user code. Please try again."});
						}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
				}
				catch(error) // account.information.libraryID
				{
					console.error("A fatal error occurred. Something may be wrong with the database. The error: ", error);
				}
			});
	});

R_administrator.post("/setPermissions", function(request, response) {
		const userCode = request.body.userCode;
		const borrowable = global.parseBoolean(request.body.borrowable), lightable = global.parseBoolean(request.body.lightable);

		if(!(global.validateUserCode(userCode))) global.responseWith(request, response, {success: false, reason: "The user code is not valid."});
		else if(borrowable === undefined) global.responseWith(request, response, {success: false, reason: "The `borrowable` is not valid."});
		else if(lightable === undefined) global.responseWith(request, response, {success: false, reason: "The `lightable` is not valid."});
		else
		{
			global.checkAccountType(response, "administrator", request.session.loggedInAs).then(function(account) {
					try
					{
						const libraryID = account.information.libraryID;
						global.db.collection("userCodes").updateOne({
								libraryID: libraryID,
								userCode: userCode
							}, {$set: {
								permission: {borrowable: borrowable, lightable: lightable}
							}}).then(function(queryResponse) {
								if(queryResponse.modifiedCount === 1) global.responseWith(request, response, {success: true});
								else
									global.responseWith(request, response, {success: false, reason: "The user code does not exist."});
							}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
					}
					catch(error) // account.information.libraryID
					{
						console.error("A fatal error occurred. Something may be wrong with the database. The error: ", error);
					}
				});
		}
	});

R_administrator.post("/deleteUserCode", function(request, response) {
		const userCode = request.body.userCode;

		if(!(global.validateUserCode(userCode))) global.responseWith(request, response, {success: false, reason: "The user code is not valid."});
		else
		{
			global.checkAccountType(response, "administrator", request.session.loggedInAs).then(function(account) {
					try
					{
						const libraryID = account.information.libraryID;
						global.db.collection("lights").remove({libraryID: libraryID, lighter: userCode}).then(function() {
							global.db.collection("userCodes").remove({
									libraryID: libraryID,
									userCode: userCode
								}, {justOne: true}).then(function(queryResponse) {
									if(queryResponse.result && queryResponse.result.n === 1) global.responseWith(request, response, {success: true});
									else
										global.responseWith(request, response, {success: false, reason: "The user code does not exist."});
								}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
							}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
					}
					catch(error) // account.information.libraryID
					{
						console.error("A fatal error occurred. Something may be wrong with the database. The error: ", error);
					}
				});
		}
	});

R_administrator.post("/newLibraryAPIToken", function(request, response) {
		if(!(request.body.noGET))
		{
			global.responseWith(request, response, {"success": false, "reason": "noGET is not truthy."});
			return;
		}

		global.checkAccountType(response, "administrator", request.session.loggedInAs).then(function(account) {
				try
				{
					// I have to check if the new token is duplicated, but see, the probability is very low. I would be okay.
					const newLibraryAPIToken = global.generateRandomAlphanumericString(128);
					global.db.collection("libraries").update({
							libraryID: account.information.libraryID
						}, {$set: {
							libraryAPIToken: newLibraryAPIToken
						}}).then(function(queryResult) {
							global.responseWith(request, response, {"success": true, "libraryAPIToken": newLibraryAPIToken});
						}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
				}
				catch(error) // account.information.libraryID
				{
					console.error("A fatal error occurred. Something may be wrong with the database. The error: ", error);
				}
			});
	});

module.exports = R_administrator;