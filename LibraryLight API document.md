# LibraryLight APIs

## Symbols
 - :x:: **it is not developed yet**.
 - :star:: **the documentation is not finished at that part**.
 - :boom:: **the API is not atomic that it can cause critical query confliction(race condition)s**.

## Terms
 - An administrator can manage only one library.
 - Library IDs given to administrators cannot be changed.
 - The type of accounts cannot be changed.
 - The APIs must only work with their corresponding permission(authentication).
 - All the APIs have to be atomic(so there have to not be any :boom:.).
 - If a database error happens when an API routine is working, `{"success": false, "reason": "Something is wrong with the database."}` will be returned.

## Problems
### **How to prevent the query confliction?**
 - For APIs can make their query conflictions(for APIs whose behavior cannot be atomic with MongoDB's features), use a task(a group of queries) queue per library. I thought it would be very hard, but it was actually not that hard.


## General - 3 APIs

  - **To login**
    - Request
      - POST
      - `/API/login`
    - Parameters
      - `ID`
      - `password`
    - Behavior
      1. Validates the inputs.
      2. Checks if the input is correct.
      3. `request.session.loggedInAs = ID`
    - Returns
      - `{"success": false, "reason": "The ID is not valid."}`
      - `{"success": false, "reason": "The password is not valid."}`
      - When the password is wrong or the account to log-in does not exist, `{"success": false, "reason": "Could not log-in."}`.
      - `{"success": false, "reason": "An error occurred when comparing the password with the hash!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "There is no library that has the library API token!"}`
      - `{"success": true, "type": (the type of the user)}`
    - Notes
      - You can log in when you are logged in.

  - **To logout**
    - Request
      - POST
      - `/API/logout`
    - Parameters
      - `noGET`: must be truthy.
    - Behavior
      1. Checks if `noGET` is truthy. If is not, returns `{"success": false, "reason": "noGET is not truthy."}`.
      2. `request.session.loggedInAs = null`.
      3. Returns `{"success": true}`.
    - Returns
      - `{"success": true}`
      - `{"success": false, "reason": "noGET is not truthy."}`

  - **To get the image of a book**
    - Request
      - GET
      - `/API/bookImage/(the ISBN of a book to get its image)`
    - Parameters
      - _(none)_
    - Behavior
      1. Checks if ISBN input is valid; if it is not a valid ISBN, returns `{"success": false, "reason": "The ISBN is not valid."}`.
      2. Sends an image file of the book whose ISBN is the ISBN input; if the image file does not exist, returns with HTTP status code of 404.
    - Returns
      - _(an image file of the book whose ISBN is the ISBN input)_
      - _(a response with HTTP status code of 404)_
      - `{"success": false, "reason": "The ISBN is not valid."}`


## For Raspberry Pi(bookcase)s - 2 API
  - **To update information of books within bookcases**
    - Request
      - POST
      - `/API/takeMyBooks`
    - Parameters
      - `libraryAPIToken`
      - `bookcaseNumber`: the bookcase's number. This should be unique in the library.
      - `bookCodes`: an array of book codes that can be read from the books' RFID tag.
    - Behavior
      1. Validates the inputs: `bookcaseNumber` cannot be a null.
      2. Gets the library ID: `db.libraries.findOne({libraryAPIToken: (the library API token)}, {libraryID: 1}).libraryID`. Returns `{"success": false, "reason": "There is no library that has the library API token!"}` if there is no library that has the specified library API token.
      3. `global.TaskManager.addTask((a function that contains the process below), "takeMyBooks", (the library ID));`
      4. Takes off its ownership from the books owned: `db.books.update({libraryID: (the library ID), bookcaseNumber: (the bookcase number)}, {$set: {bookcaseNumber: null}}, {multi: true})`.
      5. Owns the specified books: `db.books.update({libraryID: (the library ID), bookCode: {$in: (the array of the book codes)}}, {$set: {bookcaseNumber: (the bookcase number)}}, {multi: true})`.
    - Returns
      - `{"success": true, "count_unowned": (the number of the books were in the bookcase), "count_owned": (the number of the books that the bookcase have owned), "count_nonexistence": (the number of the nonexistent books among the specified)}`
      - `{"success": false, "reason": "The library API token is not valid."}`
      - `{"success": false, "reason": "The bookcase number is not valid."}`
      - ``{"success": false, "reason": "The `bookCodes` is not valid. Note that they must be strings."}``
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "There is no library that has the library API token!"}`

  - **To get information about lighting requests to a certain bookcase**
    - Request
      - POST
      - `/API/getMyLights`
    - Parameters
      - `libraryAPIToken`
      - `bookcaseNumber`: the bookcase's number. This should be unique in the library.
    - Behavior
      1. Validates the inputs.
      2. Gets the library ID: `db.libraries.findOne({libraryAPIToken: (the library API token)}, {libraryID: 1}).libraryID`. Returns `{"success": false, "reason": "There is no library that has the library API token!"}` if there is no library that has the specified library API token.
      3. Gets information about lighting requests to the bookcase: `global.db.collection("lights").find({libraryID: libraryID, bookcaseNumber: bookcaseNumber})`.
      4. Returns `{"success": true, "lightColor": null}` if there is no lighting requests to the bookcase, otherwise, returns ``{"success": true, "lightColor": (the `lightColor` of one of the lighting requests)}``.
    - Returns
      - `{"success": false, "reason": "The library API token is not valid."}`
      - `{"success": false, "reason": "The bookcase number is not valid."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "There is no library that has the library API token!"}`
      - `{"success": true, "lightColor": (the color of the light the bookcase should light.)}`
    - Notes
      - `lightColor` can be a `null`; this means the bookcase should turn the light off.
      - The response example: `{"success": true, "lightColor": "#BE8CDF"}`.


## For users - 5 APIs

  - **To register**
    - Request
      - POST
      - `/API/user/register`
    - Parameters
      - ID
      - password
    - Behavior
      1. Validates the inputs.
      2. Not strictly, checks if the ID is unique; `db.accounts.findOne({ID: (the ID)}, {"_id": 1})`. If isn't, returns `{"success": false, "reason": "The account already exists."}`.
      3. Generates a hash for the password. This work costs a lot of process resources.
      4. Creates an account if the account doesn't exist: `db.accounts.updateOne({ID: (the ID)}, {$setOnInsert: {ID: (the ID), passwordHash: (the hash for the password), type: "user", information: {usingLibraries: []}}}, {upsert: true})`.
      5. Returns `{"success": true}` if the `"upsertedId"` property of the object which the query in step 4 returned exist; otherwise, returns `{"success": false, "reason": "The account already exists."}`.
    - Returns
      - `{"success": true}`
      - `{"success": false, "reason": "The ID is not valid."}`
      - `{"success": false, "reason": "The password is not valid."}`
      - `{"success": false, "reason": "The account already exists."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`

  - **To own user-code**
    - Request
      - POST
      - `/API/user/ownUserCode`
    - Parameters
      - `libraryID`: the ID of the library where the user-code is valid.
      - `userCode`: a user-code to own.
    - Behavior
      1. Validates the inputs.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`.
      3. Checks if `theAccount.type === "user"`. If it isn't, returns `{"success": false, "reason": "You are not a user!"}`.
      4. If the user has a user code for the library(`db.userCodes.findOne({libraryID: (the library ID), userID: request.session.loggedInAs})`), returns `{"success": false, "reason": "You already have a user code for the library."}`.
      5. Owns the user code if it exists and isn't owned: `queryResult = db.userCodes.updateOne({libraryID: (the library ID), userCode: (the user code), userID: null}, {$set: {userID: request.session.loggedInAs}})`.
      6. If `queryResult.modifiedCount === 1`, returns `{"success": true}`.
      7. Else if `queryResult.modifiedCount === 0`, returns `{"success": false, "reason": "The user-code does not exist, or is already owned by another user."}`.
    - Returns
      - `{"success": false, "reason": "The library ID is not valid."}`
      - `{"success": false, "reason": "The user code is not valid."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "You already have a user code for the library."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "The user-code does not exist, or is already owned by another user."}`
      - `{"success": true}`

  - **To get the user codes belonging to the user**
    - Request
      - POST
      - `/API/user/getMyUserCodes`
    - Parameters
      - `noGET`: must be truthy.
    - Behavior
      1. Checks if `noGET` is truthy. If it isn't, returns `{"success": false, "reason": "noGET is not truthy."}`.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. Checks if `theAccount.type === "user"`. If it isn't, returns `{"success": false, "reason": "You are not a user!"}`.
      4. Queries `global.db.collection("userCodes").find({userID: request.session.loggedInAs}, {"_id": 0}).toArray(...)`, and forms the result into `{"success": true, "userCodes": [{"libraryID": (the ID of a library the user is using), "userCode": (the user code), "userID": (the user account ID), "permission": {"borrowable": (permission to borrow books in the library), "lightable": (permission to light bookcases in the library)}}, ...]}`, and returns it.
    - Returns
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true, "userCodes": [{"libraryID": (the ID of a library the user is using), "userCode": (the user code), "userID": (the user account ID), "permission": {"borrowable": (permission to borrow books in the library), "lightable": (permission to light bookcases in the library)}}, ...]}`

  - **To search books**
    - Request
      - POST
      - `/API/user/searchBooks`
    - Parameters
      - `libraries`: an array of the IDs of the library that can have the searching books.
      - `searchBy`: a string indicates what to search by(`"ISBN"` or `"title"`).
      - `searchingFor`: _the ISBN string of the searching books_ if `searchBy` is `"ISBN"`, _a portion of the title of the searching books_ if `searchBy` is `"title"`.
    - Behavior
      1. Validates the inputs.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`.
      3. Checks if `theAccount.type === "user"`. If it isn't, returns `{"success": false, "reason": "You are not a user!"}`.
      4. If `libraries` contains libraries the user isn't using, returns `{"success": false, "reason": "Some of the libraries do not have the user's user code."}`.
      5. If `searchBy` is `"ISBN"`, gets the information, including the position, the status, etc., of the books that have the ISBN and are in one of the specified libraries: `books = global.db.collection("books").find({libraryID: {$in: libraries}, ISBN: searchingFor}, {"_id": 0})`.
      6. Then, gets the information of the book whose ISBN is `searchingFor`: `bookInformation = global.db.collection("bookInformation").findOne({ISBN: searchingFor}, {"_id": 0})`.
      7. Else, if `searchBy` is `"title"`, escapes `searchingFor` to make it suitable for Mongo DB regular expression syntax, and gets information of the books whose titles contain the string specified by `searchingFor`: ``bookInformation = global.db.collection("bookInformation").find({title: {$regex: (the escaped `searchingFor`), $options: "i"}}, {"_id": 0})``.
      8. Then makes an array consists of the ISBNs of the books.
      9. Then gets the information, including the position, the status, etc., of the books that have one of the ISBNs and are in one of the specified libraries: `books = global.db.collection("books").find({libraryID: {$in: libraries}, ISBN: {$in: (the ISBN array)}}, {"_id": 0})`.
      10. Forms `books` and `bookInformation` into `{"success": true, "books": [{"ISBN": (the ISBN of the book), "libraryID": (the library ID), "bookcaseNumber": (the bookcase number), "bookcaseUpdatedAt": (the time of the recent update of the information about the books in the bookcase), "available": (if the book is in bookcases of the library and the user has permission of "borrowable" so that the user can borrow the book)}, ...], "bookInformation": {(the ISBN of the book): {"title": (the title of the book), "author": (the author of the book), "description": (a description for the book)}, ...}}` and returns it. For books that don't have any information(unknown to the server), puts objects whose `title`·`author`·`description` properties are `null` to `bookInformation`. And, makes `bookInformation` contain only information of books specified by `books`.
    - Returns
      - `{"success": true, "books": [{"ISBN": (the ISBN of the book), "libraryID": (the library ID), "bookcaseNumber": (the bookcase number), "bookcaseUpdatedAt": (the time of the recent update of the information about the books in the bookcase), "available": (if the book is in bookcases of the library and the user has permission of "borrowable" so that the user can borrow the book)}, ...], "bookInformation": {(the ISBN of the book): {"title": (the title of the book), "author": (the author of the book), "description": (a description for the book)}, ...}}`
      - ``{"success": false, "reason": "The `libraries` is not valid."}``
      - ``{"success": false, "reason": "The `searchBy` is not valid."}``
      - ``{"success": false, "reason": "The `searchingFor` is not valid."}``
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "Some of the libraries do not have the user's user code."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
    - Notes
      - The values of `title`·`author`·`description` properties can be `null`, for books whose information is unknown to the server.
      - The response example: `{"success":true,"bookInformation":{"9788970507644":{"title":null,"author":null,"description":null}},"books":[{"ISBN":"9788970507644","libraryID":"10","bookcaseNumber":100,"bookcaseUpdatedAt":"2016-09-23T10:04:30.919Z","available":true}]}`.

  - **To request a light to a bookcase that has a specific book.** :star: (the API is currently working, but the documentation is yet.)
    - Request
      - POST
      - `/API/user/light`
    - Parameters
      - `libraryID`: 점등할 책장이 있는 도서관의 ID.
      - `ISBN`: 점등할 책장 안에 있는 책의 ISBN.
    - Behavior :star:
      1. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      2. `theAccount.type === "user"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not a user!"}`를 반환한다.
      3. ?
    - Returns
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "The library ID is not truthy."}`
      - `{"success": false, "reason": "The ISBN is not truthy."}`
      - `{"success": false, "reason": "You do not have a user code for the library!"}`
      - `{"success": false, "reason": "You do not have permission to light the library!"}`
      - `{"success": false, "reason": "You are already lighting a library."}`
      - `{"success": false, "reason": "There is no book has the ISBN in a bookcase of the library."}`
      - `{"success": true, "lightColor": (the color of the light), "lightedBookcaseNumber": (the number of the bookcase should be lighted)}`
    - Note
      - The response example: `{"success": true, "lightColor": "#BE8CDF", "lightedBookcaseNumber": 1}`.


## For administrators - 7 APIs

  - **To add a book in their libraries**
    - Request
      - POST
      - `/API/administrator/addBook` or `/API/admin/addBook`
    - Parameters
      - ISBN: a string that contains the book's International Standard Book Number(EAN-13).
      - bookCode: should be stored in the book's RFID tag.
    - Behavior
      1. Validates the inputs.
      2. Gets the ID of the administrator's library: `db.accounts.fineOne({ID: request.session.loggedInAs}).information.libraryID`.
      3. Adds the book if the book was not added(if the book does not exist): `db.books.updateOne({libraryID: (the library ID), bookCode: (the book code)}, {$setOnInsert: {libraryID: (the library ID), bookCode: (the book code), bookcaseNumber: null, ISBN: (the ISBN), bookcaseUpdatedAt: null}}, {upsert: true})`.
      4. Returns `{"success": true}` if the `"upsertedId"` property of the object which the query in step 3 returned exist; otherwise, returns `{"success": false, "reason": "The book already exists."}`.
    - Returns
      - `{"success": false, "reason": "The ISBN is not valid."}`
      - `{"success": false, "reason": "The book code is not valid."}`
      - `{"success": false, "reason": "The book already exists."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true}`

  - **To get the information about the administrator's library**
    - Request
      - POST
      - `/API/administrator/getLibraryInformation` or `/API/admin/getLibraryInformation`
    - Parameters
      - `noGET`: must be truthy.
    - Behavior
      1. Checks if `noGET` is truthy. If it isn't, returns `{"success": false, "reason": "noGET is not truthy."}`.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. Checks if `theAccount.type === "administrator"`. If it isn't, returns `{"success": false, "reason": "You are not an administrator of a library!"}`.
      4. `theLibraryInformation = db.libraries.findOne({"libraryID": theAccount.information.libraryID}, {"_id": 0})`
      5. Returns `JSON.stringify({"success": true, "libraryID": theLibraryInformation.libraryID, "libraryAPIToken": theLibraryInformation.libraryAPIToken})`.
    - Returns
      - `{"success": false, "reason": "noGET is not truthy."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true, "libraryID": (the library ID), "libraryAPIToken": (the library API token)}`

  - **To get the information about the user codes for the administrator's library**
    - Request
      - `/API/administrator/getUserCodes` or `/API/admin/getUserCodes`
    - Parameters
      - `noGET`: must be truthy.
    - Behavior
      1. Checks if `noGET` is truthy. If it isn't, returns `{"success": false, "reason": "noGET is not truthy."}`.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. Checks if `theAccount.type === "administrator"`. If it isn't, returns `{"success": false, "reason": "You are not an administrator of a library!"}`.
      4. `theUserCodes = db.userCodes.find({"libraryID": theAccount.information.libraryID}, {"libraryID": 1, "userCode": 1, "userID": 1, "permission": 1, "_id": 0})`
      5. Returns `JSON.stringify({"success": true, "userCodes": theUserCodes})`.
    - Returns
      - `{"success": false, "reason": "noGET is not truthy."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true, "userCodes": [{"libraryID": (the library ID), "userCode": (a user code), "userID": (a user ID), "permission": {"borrowable": (a boolean value), "lightable": (a boolean value)}}, ...]}`

  - **To generate a user-code and make it under control**
    - Request
      - POST
      - `/API/administrator/newUserCode` or `/API/admin/newUserCode`
    - Parameters
      - `noGET`: must be truthy.
    - Behavior
      1. Checks if `noGET` is truthy. If it isn't, returns `{"success": false, "reason": "noGET is not truthy."}`.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. Checks if `theAccount.type === "administrator"`. If it isn't, returns `{"success": false, "reason": "You are not an administrator of a library!"}`.
      4. Generates a random user code: `(length => (Math.random().toString(36).substring(2, 2 + length) + '0'.repeat(length)).substring(0, length))(20).toUpperCase()`.
      5. Adds the user code if the user code for the library does not exist.: `queryResult = db.userCodes.updateOne({libraryID: theAccount.information.libraryID, "userCode": (the newly generated user code)}, {$setOnInsert: {libraryID: theAccount.information.libraryID, "userCode": (the newly generated user code), userID: null, permission: {"borrowable": false, "lightable": false}}}, {upsert: true})`.
      6. If the user code has been added(`if(queryResult && queryResult.upsertedCount === 1)`), returns `{"success": true, "theNewUserCode": (the newly generated user code)}`.
      7. Else, returns `{"success": false, "reason": "Could not generate a new user code. Please try again."}`.
    - Returns
      - `{"success": false, "reason": "noGET is not truthy."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "Could not generate a new user code. Please try again."}`
      - `{"success": true, "theNewUserCode": (the newly generated user code)}`

  - **To set permissions of a specific user-code.**
    - Request
      - POST
      - `/API/administrator/setPermissions` or `/API/admin/setPermissions`
    - Parameters
      - `userCode`
      - `borrowable`
      - `lightable`
    - Behavior
      1. Validates the inputs.
      2. Checks if the client is an administrator.
      3. Gets the library ID: `db.accounts.findOne({ID: request.session.loggedInAs}, {information: 1}).information.libraryID`.
      4. `db.userCodes.updateOne({libraryID: (the library ID), "userCode": (the user code to set its permissions)}, {$set: {"permission": (permissions to set)}})`. If the returned object's property `modifiedCount` is not `1`, returns `{"success": false, "reason": "The user code does not exist."}`.
      5. Else, returns `{"success": true}`.
    - Returns
      - `{"success": false, "reason": "The user code is not valid."}`
      - `{"success": false, "reason": "The ``borrowable`` is not valid."}`
      - `{"success": false, "reason": "The ``lightable`` is not valid."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "The user code does not exist."}`
      - `{"success": true}`

  - **To delete a specific user-code for an administrator's library**
    - Request
      - POST
      - `/API/administrator/deleteUserCode` or `/API/admin/deleteUserCode`
    - Parameters
      - `userCode`: a user-code, to delete, for the administrator's library.
    - Behavior
      1. Validates the inputs.
      2. Checks if the client is an administrator. If it isn't, returns `{"success": false, "reason": "You are not an administrator of a library!"}`.
      3. Gets the library ID: `db.accounts.findOne({ID: request.session.loggedInAs}, {information: 1}).information.libraryID`.
      4. Removes the user's lights: `db.lights.remove({libraryID: (the library ID), lighter: (the user code to delete)})`.
      5. Queries `db.userCodes.remove({libraryID: (the library ID), userCode: (the user code to delete)}, {justOne: true})`; if the returned does not have `deletedCount` property is `1`, returns `{"success": false, "reason": "The user code does not exist."}`.
      6. Returns `{"success": true}`.
    - Returns
      - `{"success": false, "reason": "The user code is not valid."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "The user code does not exist."}`
      - `{"success": true}`

  - **To generate a new library API token and update it**
    - Request
      - POST
      - `/API/administrator/newLibraryAPIToken` or `/API/admin/newLibraryAPIToken`
    - Parameters
      - `noGET`: must be truthy.
    - Behavior
      1. Checks if `noGET` is truthy.
      2. Checks if `theAccount.type === "administrator"`. If it isn't, returns `{"success": false, "reason": "You are not an administrator of a library!"}`.
      3. Generates a new random long string, which will be the new library API token.
      4. Checks if the new one is different than the existing(current) one. If it is, goes to step 3(c).
      5. Gets the ID of the administrator's library: `db.accounts.findOne({ID: request.session.loggedInAs}).information.libraryID`.
      6. `db.libraries.updateOne({libraryID: (the library ID)}, {$set: {libraryAPIToken: (the new library API token)}})`.
    - Returns
      - `{"success": true, "libraryAPIToken": (the newly generated library API token)}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`


## For developers - 1 API

  - **To get the server log**
    - Request
      - GET
      - `/test/log`
    - Parameters
      - _(none)_
    - Behavior
      1. Hooks into `process.stdout.write` in order to accumulate the output as a string.
      2. Returns it.
    - Returns
      - _(The server log)_



# About optimization

## What method am I using in order to check if a document exists?
 According to [this article](https://blog.serverdensity.com/checking-if-a-document-exists-mongodb-slow-findone-vs-find/), `findOne` is much slower than `find` with `limit` in order to do this. But I am using `node-mongodb-native` module, whose `findOne` consists of `find` with `limit` internally. So I'm to use just `findOne` to do this.
 ```javascript
 // https://github.com/mongodb/node-mongodb-native/blob/c41966c1b1834c33390922650e582842dbad2934/lib/collection.js#L833
 
 Collection.prototype.findOne = function() {    
  var self = this;
  var args = Array.prototype.slice.call(arguments, 0);
  var callback = args.pop();
  var cursor = this.find.apply(this, args).limit(-1).batchSize(1);

  // Return the item
  cursor.next(function(err, item) {
    if(err != null) return handleCallback(callback, toError(err), null);
    handleCallback(callback, null, item);
  });
}
 ```



# LibraryLight DB structure
DB:
  - LibraryLight
    - accounts
      - ID
      - passwordHash
      - type: "administrator" | "developer" | "user"
      - information: {libraryID} | {} | {}
    - libraries
      - libraryID
      - libraryAPIToken
    - userCodes
      - libraryID: (the ID of the library where the user code is valid)
      - userCode: (a string consists of 20 alphanumeric characters)
      - userID: null | "something"
      - permission: {"borrowable": true|false, "lightable": true|false}
    - lights
      - libraryID
      - bookcaseNumber
      - lightColor
      - ISBN
      - lighter
      - createdAt // [At first, I considered applying MongoDB's TTL index to this. However, since MongoDB checks the expiration at intervals of a minute, I thought it's not an appropriate way to do it. So I've implemented the expiration by querying incessantly.](http://blog.naver.com/wlzla000/220822430625)
    - books
      - ISBN
      - libraryID
      - bookcaseNumber: <Raspberry Pi>
      - bookcaseUpdatedAt: $currentDate
      - bookCode: <RFID>
      - borrower
    - bookInformation
      - ISBN
      - title
      - author
      - description

## MongoDB documents inserted when initializing the database
See [initialize_database.js](https://github.com/wlzla000/LibraryLight/blob/master/Source/LibraryLight/utils/initialize_database.js).

## The significance of *user code*s
 If there is no _user code_, you have to submit your account ID to library administrators, in order to get the permissions to use the libraries. At that time, if you submit **others**' ID, the administrators will grant the permissions to their accounts and they will be the libraries' user. But this is not what they desired, therefore this is not a good way. To resolve this problem, I adopted a concept called ‘_user code_’; I resovled the problem above, by make one have to register his/her user codes with the IDs of the libraries that the user codes're from, to his/her account, in order to be a user of the libraries.
