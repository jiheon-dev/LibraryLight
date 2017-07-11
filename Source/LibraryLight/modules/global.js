module.exports = function() {
		"use strict";

		global.serverLog = "";
		process.stdout.write = (function(write) {
				return function(string, encoding, fileDescriptor) {
						global.serverLog += string;
						write.apply(process.stdout, arguments);
					};
			})(process.stdout.write);
		process.stderr.write = (function(write) {
				return function(string, encoding, fileDescriptor) {
						global.serverLog += string;
						write.apply(process.stderr, arguments);
					};
			})(process.stderr.write);

		setInterval(function lightExpirationManager() {
				global.db.collection("lights").remove({"createdAt": {"$lte": new Date(Date.now() - 10 * 1000)}}).then(queryResponse => {
						if(queryResponse.result.n !== 0) console.info(`${queryResponse.result.n} lights have expired!`);
					});
			}, 1000);

		Object.defineProperty(global, "escapePCRE", {value: function escapePerlCompatibleRegularExpression(string) { // MongoDB uses PCRE.
				return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			}});

		Object.defineProperty(global, "generateRandomUppercaseAlphanumericString", {value: function generateRandomUppercaseAlphanumericString(stringLength) {
				// This code works well only for generating a random string that consists of 15 or less characters, in Node.js.
				return (Math.random().toString(36).substring(2, 2 + stringLength) + '0'.repeat(stringLength)).substring(0, stringLength).toUpperCase();
			}});
		Object.defineProperty(global, "generateRandomAlphanumericString", {value: function generateRandomAlphanumericString(stringLength) {
				const alphanumerics = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
				let result = "";
				for(let index = 0; index < stringLength; index++)
					result += alphanumerics[Math.floor(Math.random() * alphanumerics.length)];

				return result;
			}});
		Object.defineProperty(global, "parseBoolean", {value: function parseBoolean(string) {
				if(typeof string === "string") return {"true": true, "false": false}[string.toLowerCase()];
			}});

		Object.defineProperty(global, "validateID", {value: function validateID(string) {
				return typeof string === "string" && /^[a-zA-Z0-9]{3,15}$/.test(string) && string.search(/[a-zA-Z]/) != -1;
			}});
		Object.defineProperty(global, "validatePassword", {value: function validatePassword(string) {
				return typeof string === "string" && /^[a-zA-Z0-9]{3,15}$/.test(string) && string.search(/[a-zA-Z]/) != -1;
			}});
		Object.defineProperty(global, "validateLibraryID", {value: function validateLibraryID(string) {
				return typeof string === "string" && /^[a-zA-Z0-9_]{1,20}$/.test(string);
			}});
		Object.defineProperty(global, "validateUserCode", {value: function validateUserCode(string) {
				return typeof string === "string" && /^[A-Z0-9]{7}$/.test(string);
			}});
		Object.defineProperty(global, "validateISBN", {value: function validateISBN(string) {
				return typeof string === "string" && /^[0-9]{13}$/.test(string)
					&& (
						(
							(Number.parseInt(string[0])
							+ Number.parseInt(string[2])
							+ Number.parseInt(string[4])
							+ Number.parseInt(string[6])
							+ Number.parseInt(string[8])
							+ Number.parseInt(string[10])
							+ Number.parseInt(string[12]))
							+
							(Number.parseInt(string[1])
							+ Number.parseInt(string[3])
							+ Number.parseInt(string[5])
							+ Number.parseInt(string[7])
							+ Number.parseInt(string[9])
							+ Number.parseInt(string[11])) * 3
						) % 10 === 0
					);
			}});
		Object.defineProperty(global, "validateBookCode", {value: function validateBookCode(string) {
				return typeof string === "string" && /^[a-zA-Z0-9_]{1,100}$/.test(string);
			}});
		Object.defineProperty(global, "validateLibraryAPIToken", {value: function validateLibraryAPIToken(string) {
				return typeof string === "string" && /^[a-zA-Z0-9]{128}$/.test(string);
			}});
		Object.defineProperty(global, "validateBookcaseNumber", {value: function validateBookcaseNumber(number) {
				return typeof number === "number" && number <= 99999;
			}});

		Object.defineProperty(global, "dbErrorOccurred", {value: function aDatabaseErrorOccurred(response, databaseError) {
				console.error("A database error occurred", databaseError);
				response.end(JSON.stringify({"success": false, "reason": "Something is wrong with the database."}));
			}});
		Object.defineProperty(global, "checkAccountType", {value: function checkAccountType(response, type, accountID) {
			/*
				{"success": false, "reason": "You have to log-in!"}
				{"success": false, "reason": "You are not a user!"} or {"success": false, "reason": "You are not an administrator of a library!"}
				{"success": false, "reason": "Something is wrong with the database."}
			*/
				return new Promise((resolve, reject) => {
						if(!accountID)
						{
							response.end(JSON.stringify({success: false, reason: "You have to log-in!"}));
							return;
						}

						global.db.collection("accounts").findOne({ID: accountID}, {type: 1, information: 1}).then(account => {
								if(!account) response.end(JSON.stringify({success: false, reason: "You have to log-in!"}));
								else if(account.type === type) resolve(account);
								else
								{
									if(type === "user") response.end(JSON.stringify({success: false, reason: "You are not a user!"}));
									else if(type === "administrator") response.end(JSON.stringify({success: false, reason: "You are not an administrator of a library!"}));
								}
							}).catch(databaseError => global.dbErrorOccurred(response, databaseError));
					});
				
			}});
		Object.defineProperty(global, "addTask", {value: (function closure() {
				let taskChains = {};
				return function addTask(taskChainName, taskPromise) {
						if(!(taskChainName in taskChains)) taskChains[taskChainName] = Promise.resolve();
						taskChains[taskChainName] = taskChains[taskChainName].then(_ => taskPromise);
					};
			})()});

		Object.defineProperty(global, "responseWith", {value: function endResponseAndLogIt(request, response, content = "{}", contentType = "json", logContent = true, endIt = true, status = 200) {
				try
				{
					if(logContent)
					{
						console.log(`===== Response(${request["SEQUENCE_NUMBER"]}) [${new Date}]\n` +
								`\t${typeof content === "object" ? JSON.stringify(content) : content}\n` +
								`${'='.repeat(70)}`);
					}
					else
						throw Error("Do not log the content!");
				}
				catch(unableToLogTheContent)
				{
					console.log(`===== Response(${request["SEQUENCE_NUMBER"]}) [${new Date}] =====`);
				}

				let responseChain = response.status(status).type(contentType).send(content);
				if(endIt) responseChain.end("", "utf8");
				return responseChain;
			}});

		console.info("The global variables & methods are ready.");
	};