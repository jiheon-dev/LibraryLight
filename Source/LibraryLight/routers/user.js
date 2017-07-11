const M_bcrypt = require("bcrypt");
const M_color = require("color");
var M_Express = require("express");

var R_user = M_Express.Router();
console.info("The router is ready: user.");

R_user.post("/register", function(request, response) {
		const ID = request.body.ID, password = request.body.password;
		if(!(global.validateID(ID))) global.responseWith(request, response, {success: false, reason: "The ID is not valid."});
		else if(!(global.validatePassword(password))) global.responseWith(request, response, {success: false, reason: "The password is not valid."});
		else
		{
			global.db.collection("accounts").findOne({ID: ID}, {"_id": 1}).then(matchedAccount => {
					if(matchedAccount)
					{
						global.responseWith(request, response, {"success": false, "reason": "The account already exists."});
						return;
					}	

					M_bcrypt.hash(password, 12, function(error, resultHash) {
							if(error)
							{
								global.responseWith(request, response, {success: false, reason: "An error occurred when generating a hash for the password."});
								return;
							}

							global.db.collection("accounts").updateOne({ID: ID},
								{$setOnInsert: {
									ID: ID,
									passwordHash: resultHash,
									type: "user",
									information: {usingLibraries: []}
								}}, {upsert: true}).then(function(queryResult) {
									if(queryResult && queryResult.upsertedCount === 1) global.responseWith(request, response, {success: true});
									else
										global.responseWith(request, response, {success: false, reason: "The account already exists."});
								}).catch(databaseError => global.dbErrorOccurred(response, databaseError))
						});
				}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
		}
	});

R_user.post("/ownUserCode", function(request, response) {
		const libraryID = request.body.libraryID, userCode = request.body.userCode;
		if(!(global.validateLibraryID(libraryID))) global.responseWith(request, response, {success: false, reason: "The library ID is not valid."});
		else if(!(global.validateUserCode(userCode))) global.responseWith(request, response, {success: false, reason: "The user code is not valid."});
		else
		{
			global.checkAccountType(response, "user", request.session.loggedInAs).then(_ => {
					global.db.collection("userCodes").findOne({libraryID: libraryID, userID: request.session.loggedInAs}).then(function(alreadyOwnedUserCode) {
							if(alreadyOwnedUserCode)
							{
								global.responseWith(request, response, {"success": false, "reason": "You already have a user code for the library."});
								return;
							}

							global.db.collection("userCodes").updateOne({
									libraryID: libraryID,
									userCode: userCode,
									userID: null
								}, {$set: {
									userID: request.session.loggedInAs
								}}).then(function(queryResult) {
									if(queryResult.result["nModified"] === 1) global.responseWith(request, response, {success: true});
									else
										global.responseWith(request, response, {"success": false, "reason": "The user-code does not exist, or is already owned by another user."});
								}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
						}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
				});
		}
	});

R_user.post("/getMyUserCodes", (request, response) => {
		if(!(request.body.noGET))
		{
			global.responseWith(request, response, {"success": false, "reason": "noGET is not truthy."});
			return;
		}

		global.checkAccountType(response, "user", request.session.loggedInAs).then(account => {
				global.db.collection("userCodes").find({userID: request.session.loggedInAs}, {"_id": 0}).toArray((databaseError, hisUserCodes) => {
						if(databaseError) global.dbErrorOccurred(response, databaseError);
						else
							global.responseWith(request, response, {"success": true, "userCodes": hisUserCodes});
					});
			});
	});

R_user.post("/searchBooks", (request, response) => {
		const libraries = request.body.libraries, searchBy = request.body.searchBy, searchingFor = request.body.searchingFor;
		if(!(Array.isArray(libraries) && libraries.every(inputLibraryID => global.validateLibraryID(inputLibraryID))))
		{
			global.responseWith(request, response, {success: false, reason: "The `libraries` is not valid."});
		}
		else if(!(searchBy === "ISBN" || searchBy === "title"))
		{
			global.responseWith(request, response, {success: false, reason: "The `searchBy` is not valid."});
		}
		else if(!((searchBy === "ISBN" && global.validateISBN(searchingFor)) || (searchBy === "title" && typeof searchingFor === "string")))
		{
			global.responseWith(request, response, {success: false, reason: "The `searchingFor` is not valid."});
		}
		else
		{
			global.checkAccountType(response, "user", request.session.loggedInAs).then(_ => {
					let result = {success: true, bookInformation: {}};
					const unknownBookInfo = {title: null, author: null, description: null};
					if(searchBy === "ISBN")
					{
						global.db.collection("books").find({libraryID: {$in: libraries}, ISBN: searchingFor}, {"_id": 0}).toArray((databaseError, books) => {
								if(databaseError)
								{
									global.dbErrorOccurred(response, databaseError);
									return;
								}

								global.db.collection("bookInformation").findOne({ISBN: searchingFor}, {"_id": 0}).then(bookInformation => {
										result["books"] = books.map(book => ({
												ISBN: searchingFor,
												libraryID: book["libraryID"],
												bookcaseNumber: book["bookcaseNumber"],
												bookcaseUpdatedAt: book["bookcaseUpdatedAt"],
												available: !(book["borrower"])
											}));

										result["bookInformation"][searchingFor] = (bookInformation === null) ? unknownBookInfo : {
												ISBN: searchingFor,
												title: bookInformation["title"],
												author: bookInformation["author"],
												description: bookInformation["description"]
											};
										global.responseWith(request, response, JSON.stringify(result));
									}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
							});
					}
					else if(searchBy === "title")
					{
						global.db.collection("bookInformation").find({
								title: {
										$regex: global.escapePCRE(searchingFor.replace(/[\n\r]/g, "")),
										$options: "i"
									}
							}, {"_id": 0}).toArray((databaseError, bookInformation) => {
									if(databaseError)
									{
										global.dbErrorOccurred(response, databaseError);
										return;
									}

									global.db.collection("books").find({
											libraryID: {$in: libraries},
											ISBN: {$in: bookInformation.map(bookInfo => bookInfo["ISBN"])}
										}, {"_id": 0}).toArray((databaseError, books) => {
												if(databaseError)
												{
													global.dbErrorOccurred(response, databaseError);
													return;
												}

												result["books"] = books.map(book => ({
														ISBN: book["ISBN"],
														libraryID: book["libraryID"],
														bookcaseNumber: book["bookcaseNumber"],
														bookcaseUpdatedAt: book["bookcaseUpdatedAt"],
														available: !(book["borrower"])
													}));
												const libraryBookISBNs = books.map(book => book["ISBN"]);
												bookInformation.forEach(bookInfo => {
														if(libraryBookISBNs.indexOf(bookInfo["ISBN"]) !== -1)
														{ // If the book information is about books exist in the library:
															result["bookInformation"][bookInfo["ISBN"]] = {
																	title: bookInfo["title"],
																	author: bookInfo["author"],
																	description: bookInfo["description"]
																};
														}
													});
												
												// For ISBNs that `books` have but `bookInformation` don't have,
												// an empty `bookInfo` object for the each ISBN to `bookInformation`.
												books.map(book => book["ISBN"]).forEach(bookISBN => {
														if(!(bookISBN in result["bookInformation"])) // If this is a book unknown to the server:
														{
															result["bookInformation"][bookISBN] = unknownBookInfo;
														}
													});
												global.responseWith(request, response, JSON.stringify(result));
											});
								});
					}
				});
		}
	});

R_user.post("/light", (request, response) => {
		const libraryID = request.body.libraryID, ISBN = request.body.ISBN;
		if(!(global.validateLibraryID(libraryID)))
		{
			global.responseWith(request, response, {success: false, reason: "The library ID is not truthy."});
			return;
		}
		if(!(global.validateISBN(ISBN)))
		{
			global.responseWith(request, response, {success: false, reason: "The ISBN is not truthy."});
			return;
		}

		let userCode, bookcaseToBeLighted, lightColor;
		global.checkAccountType(response, "user", request.session.loggedInAs)
			.then(account => {
				return global.db.collection("userCodes").findOne({libraryID: libraryID, userID: request.session.loggedInAs}, {"_id": 0});
			}).then(userCodeQueryResult => {
				return new Promise((resolve, reject) => {
						if(!userCodeQueryResult)
						{
							global.responseWith(request, response, {success: false, reason: "You do not have a user code for the library!"});
						}
						else if(!(userCodeQueryResult["permission"]["lightable"]))
						{
							global.responseWith(request, response, {success: false, reason: "You do not have permission to light the library!"});
						}
						else
						{
							userCode = userCodeQueryResult["userCode"];
							resolve(global.db.collection("lights").findOne({lighter: userCode}));
						}
					});
			}).then(hisLight => {
				return new Promise((resolve, reject) => {
						if(hisLight)
						{
							global.responseWith(request, response, {success: false, reason: "You are already lighting a library."});
							return;
						}

						resolve(new Promise((resolve, reject) => {
								global.db.collection("books").find({libraryID: libraryID, ISBN: ISBN}).toArray((databaseError, books) => {
										if(databaseError) global.dbErrorOccurred(response, databaseError);
										else if(books.length === 0)
										{
											global.responseWith(request, response, {success: false, reason: "There is no book has the ISBN in the library."});
										}
										else
											resolve(books);
									});
							}));
					});
			}).then(books => {
				return new Promise((resolve, reject) => {
						global.db.collection("lights").find({libraryID: libraryID}).toArray((databaseError, libraryLights) => {
								if(databaseError)
								{
									global.dbErrorOccurred(response, databaseError);
									return;
								}

								const bookcaseLights = libraryLights.filter(light => light["ISBN"] === ISBN);
								let availableBooks = {};
								books.map(book => book["bookcaseNumber"]).forEach(bookcaseNumber => {
										availableBooks[bookcaseNumber] = (availableBooks[bookcaseNumber] + 1) || 0;
									});
								bookcaseLights.map(light => light["bookcaseNumber"]).forEach(lightedBookcaseNumber => {
										if(lightedBookcaseNumber in availableBooks) availableBooks[lightedBookcaseNumber]--;
									});
								bookcaseToBeLighted = Number.parseInt(Object.keys(availableBooks).sort((bookcaseA, bookcaseB) => availableBooks[bookcaseA] - availableBooks[bookcaseB])[0]);

								if(bookcaseLights.length === 0) // The bookcase is not lighting, so I have to generate a new color for the new light.
								{
									const libraryColorHues = libraryLights.map(light => M_color(light["lightColor"]).hue());
									const getGoodHue = _ => {
											let newColorHue;
											for(let recommendedHueGap = 60; 20 < recommendedHueGap; recommendedHueGap -= 1)
											{
												newColorHue = Math.floor(Math.random() * 360);
												if(libraryColorHues.every(hue => (Math.abs(hue - newColorHue) >= recommendedHueGap)))
												{
													return {good: true, result: newColorHue};
												}
											}
											return {good: false, result: newColorHue}; // Failed to get the good hue.
										};
									for(let lightness = 0.8; lightness >= 0.5; lightness -= 0.1)
									{
										let goodHueFindingResult = getGoodHue();
										if(goodHueFindingResult.good)
										{
											lightColor = M_color(`hsl(${goodHueFindingResult.result}, ${80.0 + (Math.random() * 20)}%, ${lightness * 100.0}%)`).hexString();
										}
									}
									lightColor = M_color().hsl([Math.random() * 360, 80.0 + (Math.random() * 20), 80]).hexString();
									// Failed to get a good color. So... good luck, my color!
								}
								else
									lightColor = bookcaseLights[0]["lightColor"];

								lightColor = lightColor.toUpperCase();

								resolve(global.db.collection("lights").insertOne({
										libraryID: libraryID,
										bookcaseNumber: bookcaseToBeLighted,
										lightColor: lightColor,
										ISBN: ISBN,
										lighter: userCode,
										createdAt: new Date // MongoDB's TTL field.
									}));
							});
					});
			}).then(_ => {
				global.responseWith(request, response, {
						success: true,
						lightColor: lightColor,
						lightedBookcaseNumber: bookcaseToBeLighted
					});
			}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
	});

module.exports = R_user;