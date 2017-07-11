process.on("uncaughtException", function(error) {
		console.error("A FATAL UNCAUGHT ERROR HAS OCCURRED!", error);
	});

/************************************************************************************************************************/

function socketManager()
{
	this.sockets = [];
	this.currentSocketID = 0;
}
socketManager.prototype = {
		addSocket: function addSocket(socket) {
				var that = this;

				const socketID = this.currentSocketID++;
				this.sockets[socketID] = socket; // Add a newly connected socket.
				socket.once("close", function unsubscribeTheSocket() {
						delete that.sockets[socketID];
					});
			},
		destroyAllTheSocket: function destroyAll() {
				this.sockets.forEach(function(socket) {
						socket.destory();
					});
			}
	};
var socketManager_HTTP = new socketManager, socketManager_HTTPS = new socketManager;

const cleanUpTheServer = function cleanUpTheServer() {
		console.info("Closing gracefully. Wait a while please.");

		var cleanUpPromise_HTTP = global.httpServer ? new Promise(function(resolve, reject) {
						console.info("Trying closing HTTP server.");
						global.httpServer.close(resolve);
						socketManager_HTTP.destroyAllTheSocket();
					}) : true;
		var cleanUpPromise_HTTPS = global.httpsServer ? new Promise(function(resolve, reject) {
						console.info("Trying closing HTTPS server.");
						global.httpsServer.close(resolve);
						socketManager_HTTPS.destroyAllTheSocket();
					}) : true;
		Promise.all([cleanUpPromise_HTTP, cleanUpPromise_HTTPS]).then(function() {
				if(global.db)
				{
					console.info("Trying closing the connection to the MongoDB server.");
					global.db.close(true); // Force closing the connection
				}
				console.info("The process is to be terminated.");
				process.exit();
			});
	};
const exitRequest = (function closure() {
		let exitRequestCount = 0;
		return function exitRequest() {
				if(++exitRequestCount >= 3)
				{
					console.info("Force closing the process.");
					process.exit();
				}
				else
					cleanUpTheServer();
			};
	})();
process.on("SIGINT", exitRequest);
process.on("SIGTERM", exitRequest);

// If the connections are alive too many, this application will not work without any information message.
/************************************************************************************************************************/

//http://blog.saltfactory.net/node/implements-nodejs-based-https-server.html
//http://zetawiki.com/wiki/%EC%9C%88%EB%8F%84%EC%9A%B0_openssl_%EC%84%A4%EC%B9%98
//http://stackoverflow.com/questions/14459078/unable-to-load-config-info-from-usr-local-ssl-openssl-cnf

global.debugging = true;

const M_MongoDB = require("mongodb");
const M_expressSession = require("express-session");
const M_connectMongo = require("connect-mongo");
const M_HTTP = require("http");
const M_HTTPS = require("https");
const M_express = require("express");
const M_bodyParser = require("body-parser");
const M_cookieParser = require("cookie-parser");
const M_FS = require("fs");
const M_path = require("path");
const M_expressForceSSL = require("express-force-ssl");

const MongoStore = M_connectMongo(M_expressSession);
var app = M_express();
app.use(M_cookieParser());
app.use(M_bodyParser.urlencoded({limit: "10kb", extended: false}));
app.use(M_bodyParser.json({limit: "10kb", strict: false}));
app.use(M_expressForceSSL);
app.set("forceSSLOptions", {enable301Redirects: true, trustXFPHeader: false, httpsPort: 31337, sslRequiredMessage: "SSL required."});

(new Promise((resolve, reject) => {
		M_MongoDB.MongoClient.connect("mongodb://localhost:27017/LibraryLight?connectTimeoutMS=60000&socketTimeoutMS=60000",
				{
					db: {
							bufferMaxEntries: 10
						},
					server: {
							logger: {
									error: function mongoError(message, object) {console.error("MongoDB(error): ", message, object);},
									log: function mongoLog(message, object) {console.log("MongoDB(log): ", message, object);},
									debug: function mongoDebug(message, object) {console.info("MongoDB(debug): ", message, object);}
								},
							socketOptions: {
									connectTimeoutMS: 60000,
									socketTimeoutMS: 60000
								}
						},
					replSet: {
							noDelay: true,
							keepAlive: false,
							connectTimeoutMS: 60000,
							socketTimeoutMS: 60000
						}
				},
				function(error, db) {
				if(error)
				{
					console.error("Unable to connect to the MongoDB server. This Node.js process will be exited.\nThe error is:", error);

					reject(process.exit(1));
				}
				else
				{
					global.db = db;
					console.log("MongoDB: connection established to mongodb://localhost:27017/LibraryLight.");

					db.on("close", _ => console.info(`[${new Date}] A socket closed against a single server or mongos proxy.`));
					db.on("error", _ => console.info(`[${new Date}] An error occurred against a single server or mongos proxy.`));
					db.on("reconnect", _ => console.info(`[${new Date}] The driver has reconnected and re-authenticated.`));
					db.on("timeout", _ => console.info(`[${new Date}] A socket timeout occurred against a single server or mongos proxy.`));
					// http://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#event:close

					resolve(db);
				}
			});
	})).then(_MongoDBInstance => {
		app.use(M_expressSession({
				cookie: {
						secure: true,
						maxAge: 100 * 60 * 1000 // Session lifetime in miliseconds, which is updated when you request.
					},
				//name: "LibraryLightSession",
				proxy: false,
				resave: true,
				rolling: true,
				saveUninitialized: true,
				secret: "LibraryLight secret!",
				store: new MongoStore({db: _MongoDBInstance, ttl: 100 * 60})
			}));


		let sequenceRequest = (function closure() {
				let sequenceNumber = 0;
				return request => {
						if(!("SEQUENCE_NUMBER" in request))
						{
							sequenceNumber += 1;
							Object.defineProperty(request, "SEQUENCE_NUMBER", {value: sequenceNumber});
						}
					};
			})();
		app.use(function handleBadRequest(error, request, response, next) { // If the request is valid, this is not runned.
				sequenceRequest(request);

				let errorMessage = error;
				if(error.name === "SyntaxError") errorMessage = `Failed to parse a JSON string: ${error.body}\n\t${error.message}.`;
				console.error(`===== Error(${request["SEQUENCE_NUMBER"]}) [${new Date}]\n` +
						`\t${errorMessage}\n` +
						`${'='.repeat(70)}`);

				response.sendStatus(400);
				next(`===== Responded (${request["SEQUENCE_NUMBER"]}) with status code 400(Bad Request). =====`);
				/*
					If you pass anything to the next() function (except the string 'route'),
					Express regards the current request as being in error
					and will skip any remaining non-error handling routing and middleware functions.
					( from http://expressjs.com/en/guide/error-handling.html )
				*/
			});
		app.use(function logRequest(request, response, next) {
				sequenceRequest(request);

				let stringifiedRequestBody;
				try
				{
					stringifiedRequestBody = JSON.stringify(request.body);
				}
				catch(stringifyingError) {}
				console.log(`===== Request(${request["SEQUENCE_NUMBER"]}) [${new Date}]\n` +
						`\tMethod: ${request.method}\n` +
						`\tURI: ${request.originalUrl}\n` +
						`\tContent-Type: ${request.get("Content-Type")}\n` +
						`\tRequest body: ${stringifiedRequestBody === undefined ? "(Failed to stringify)" : stringifiedRequestBody}\n` +
						`${'='.repeat(70)}`);
				next();
			});

		(require(M_path.resolve(__dirname, "modules/global")))();
		app.use("/API", require(M_path.resolve(__dirname, "routers/general")));
		app.use("/API", require(M_path.resolve(__dirname, "routers/bookcase")));
		app.use("/API/user", require(M_path.resolve(__dirname, "routers/user")));
		app.use("/API/admin(istrator)?", require(M_path.resolve(__dirname, "routers/administrator")));
		app.use("/test", require(M_path.resolve(__dirname, "routers/test")));
		app.get("/", function(request, response) {
				response.writeHead(200, {"Content-Type": "text/html"});
				response.end("Hello world, is it secure? " + request.secure);
			});
		app.use((request, response) => {
				global.responseWith(request, response, "Error: nonexistent URI.", "text/plain", true, true, 404);
			});

		var httpsSecureOptions = {
				ca: M_FS.readFileSync(M_path.resolve(__dirname, "SSL/ll_0o0_moe.ca-bundle")),
				key: M_FS.readFileSync(M_path.resolve(__dirname, "SSL/ll_0o0_moe.key")),
				cert: M_FS.readFileSync(M_path.resolve(__dirname, "SSL/ll_0o0_moe.crt"))
			};
		(global.httpsServer = M_HTTPS.createServer(httpsSecureOptions, app)
			.listen(31337, function() {
				console.info("The HTTPS server is listening on port 31337.");
			})).on("error", function(error) {
				console.error(error);
			});
	}).catch(function anErrorOccurredInThePromise(error) { // Errors occurred in promises have to be catched by `.catch`.
		console.error("An error occurred when initializing!", error);
		exitRequest();
	});

(global.httpServer = M_HTTP.createServer(app).listen(31335, function() {
		console.info("The HTTP server is listening on port 31335.");
	})).on("error", function(error) {
		console.error(error);
	}); // In order to make this process keep work.