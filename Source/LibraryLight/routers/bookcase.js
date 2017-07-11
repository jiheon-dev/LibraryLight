var M_Express = require("express");

var R_bookcase = M_Express.Router();
console.info("The router is ready: bookcase.");

R_bookcase.post("/takeMyBooks", function(request, response) {
		const libraryAPIToken = request.body.libraryAPIToken;
		const bookcaseNumber = Number.parseInt(request.body.bookcaseNumber);
		const bookCodes = request.body.bookCodes;
		try
		{
			if(!(global.validateLibraryAPIToken(libraryAPIToken))) global.responseWith(request, response, {success: false, reason: "The library API token is not valid."});
			else if(!(global.validateBookcaseNumber(bookcaseNumber))) global.responseWith(request, response, {success: false, reason: "The bookcase number is not valid."});
			else if(!(Array.isArray(bookCodes) && bookCodes.every(bookCode => global.validateBookCode(bookCode))))
			{
				global.responseWith(request, response, {success: false, reason: "The `bookCodes` is not valid. Note that they must be strings."});
			}
			else
			{
				global.db.collection("libraries").findOne({libraryAPIToken: libraryAPIToken}, {libraryID: 1}).then(libraryInformation => {
						if(!libraryInformation)
						{
							global.responseWith(request, response, {success: false, reason: "There is no library that has the library API token!"});
							return;
						}

						const libraryID = libraryInformation.libraryID;
						let unowning, owning;
						global.addTask("takeMyBooks_" + libraryID, new Promise(resolve => {
								global.db.collection("books").update({
										libraryID: libraryID,
										bookcaseNumber: bookcaseNumber
									}, {
										$set: {bookcaseNumber: null},
										$currentDate: {bookcaseUpdatedAt: true}
									}, {multi: true}).then(unowningQueryResult => {
										unowning = unowningQueryResult;
										return global.db.collection("books").update({
												libraryID: libraryID,
												bookCode: {$in: bookCodes}
											}, {
												$set: {bookcaseNumber: bookcaseNumber},
												$currentDate: {bookcaseUpdatedAt: true}
											}, {multi: true});
									}).then(owningQueryResult => {
											owning = owningQueryResult;
											global.responseWith(request, response, {
													"success": true,
													"count_unowned": unowning.result.nModified,
													"count_owned": owning.result.nModified,
													"count_nonexistence": bookCodes.length - owningQueryResult.result.nModified
												});
											resolve("DONE. LET THE NEXT TASK WORK.");
									}).catch(databaseError => {
										global.dbErrorOccurred(response, databaseError);
										resolve("I'VE FAILED. BUT IT MAY BE OKAY, JUST LET THE NEXT TASK WORK.");
									});
							}));
					}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
			}
		}
		catch(unexpectedError)
		{
			console.error("A fatal error occurred at takeMyBooks.");
		}
	});

R_bookcase.post("/getMyLights", (request, response) => {
		const libraryAPIToken = request.body.libraryAPIToken;
		const bookcaseNumber = Number.parseInt(request.body.bookcaseNumber);
		if(!(global.validateLibraryAPIToken(libraryAPIToken)))
		{
			global.responseWith(request, response, {success: false, reason: "The library API token is not valid."});
			return;
		}
		if(!(global.validateBookcaseNumber(bookcaseNumber)))
		{
			global.responseWith(request, response, {success: false, reason: "The bookcase number is not valid."});
			return;
		}

		global.db.collection("libraries").findOne({libraryAPIToken: libraryAPIToken}, {libraryID: 1}).then(libraryInformation => {
				if(!libraryInformation)
				{
					global.responseWith(request, response, {success: false, reason: "There is no library that has the library API token!"});
					return;
				}

				const libraryID = libraryInformation.libraryID;

				global.db.collection("lights").find({libraryID: libraryID, bookcaseNumber: bookcaseNumber}).toArray((databaseError, bookcaseLights) => {
						if(databaseError)
						{
							global.dbErrorOccurred(response, databaseError);
							return;
						}

						global.responseWith(request, response, {
								success: true,
								lightColor: (bookcaseLights.length === 0 ? null : bookcaseLights[0]["lightColor"])
							});
					});
			});
	});

module.exports = R_bookcase;