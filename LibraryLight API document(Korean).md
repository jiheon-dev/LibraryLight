# LibraryLight API
## 기호
 - :x:: **아직 개발되지 않았음**.
 - :star:: **그 부분의 문서화가 덜 되었음**.
 - :boom:: **그 API가 원자적이지 않아서 치명적인 쿼리 충돌(경쟁 상태)을 야기할 수 있음**.

## 조건
 - 하나의 관리자는 오직 하나의 도서관만 관리할 수 있다.
 - 관리자에게 주어진 도서관 ID는 바뀌지 않는다.
 - 계정의 유형은 바뀌지 않는다.
 - API들은 각기 요구되는 권한(인증)이 있어야 동작한다.
 - 모든 API들은 원자적이어야 한다(즉 :boom:이 없어야 한다.).
 - API 루틴이 실행되고 있을 때에 데이터베이스 오류가 나면, `{"success": false, "reason": "Something is wrong with the database."}`가 반환된다.

## 문제점
### **쿼리 충돌을 어떻게 방지할 것인가?**
 - 충돌이 발생할 수 있는(MongoDB의 기능만으로 원자성을 보장할 수 없는) 처리를 하는 API에 대하여, 들어온 API 요청을 어떤 도서관에 대한 정보를 다루는지로 나누어, 각 도서관에 해당하는 _작업 큐_에 넣어 각 도서관마다 순차적으로 처리한다.

## 일반적인 것 - 3개의 API가 문서화되었음.

  - **로그인 하기**
    - 요청
      - POST
      - `/API/login`
    - 인자
      - `ID`
      - `password`: 암호.
    - 동작
      1. 입력된 인수가 유효한지 확인한다.
      2. 입력된 계정 정보가 맞는지 확인한다.
      3. `request.session.loggedInAs = ID`
    - 반환 값
      - `{"success": false, "reason": "The ID is not valid."}`
      - `{"success": false, "reason": "The password is not valid."}`
      - 암호가 잘못되었거나 로그인 하려는 계정이 존재하지 않을 때에, `{"success": false, "reason": "Could not log-in."}`.
      - `{"success": false, "reason": "An error occurred when comparing the password with the hash!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true, "type": (그 사용자의 유형)}`
    - 비고
      - 로그인된 상태에서 로그인할 수 있다.

  - **로그아웃 하기**
    - 요청
      - POST
      - `/API/logout`
    - 인자
      - `noGET`: 반드시 참 값이어야 한다.
    - 동작
      1. `noGET`이 참 값인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "noGET is not truthy."}`를 반환한다.
      2. `request.session.loggedInAs = null`.
      3. `{"success": true}`를 반환한다.
    - 반환 값
      - `{"success": true}`
      - `{"success": false, "reason": "noGET is not truthy."}`

  - **책 사진 구하기**
    - 요청
      - GET
      - `/API/bookImage/(그 사진을 구하고자 하는 책의 ISBN)`
    - 인자
      - _(없음.)_
    - 동작
      1. 입력된 ISBN이 올바른지 검사하고 올바르지 않으면 `{"success": false, "reason": "The ISBN is not valid."}`을 반환한다.
      2. 입력된 ISBN에 해당하는 책의 사진 파일을 보낸다. 이때에 이 사진 파일이 없으면 HTTP 상태 코드를 404로 하여 응답한다.
    - 반환 값
      - _(입력된 ISBN에 해당하는 책의 사진 파일)_
      - _(HTTP 상태 코드가 404인 응답)_
      - `{"success": false, "reason": "The ISBN is not valid."}`


## Raspberry Pi(책장)을 위한 것 - 2개의 API가 문서화되었음.
  - **책장 안에 있는 책의 정보를 갱신하기**
    - 요청
      - POST
      - `/API/takeMyBooks`
    - 인자
      - `libraryAPIToken`
      - `bookcaseNumber`: 책장 번호이다. 이것은 그 도서관에서 유일해야 한다.
      - `bookCodes`: 이것은 그 책들의 RFID 태그에서 읽힌 책 코드들로 이루어진 배열이다.
    - 동작
      1. 입력이 유효한지 검사한다. 이때에 `bookcaseNumber`는 `null`이면 안 된다.
      2. 도서관 ID를 얻는다: `db.libraries.findOne({libraryAPIToken: (그 도서관 API 토큰)}, {libraryID: 1}).libraryID`. 이때에 명시된 도서관 API 토큰에 해당하는 도서관이 없으면 `{"success": false, "reason": "There is no library that has the library API token!"}`을 반환한다.
      3. `global.TaskManager.addTask((이후의 처리가 담긴 함수), "takeMyBooks", (그 도서관 ID));`
      4. 꽂혀(소유하고) 있던 책에 대한 소유권을 제거한다: `db.books.update({libraryID: (그 도서관 ID), bookcaseNumber: (그 책장 번호)}, {$set: {bookcaseNumber: null}}, {multi: true})`.
      5. 인수에 명시된 책을 소유한다: `db.books.update({libraryID: (그 도서관 ID), bookCode: {$in: (그 책 코드들로 이루어진 배열)}}, {$set: {bookcaseNumber: (그 책장 번호)}}, {multi: true})`.
    - 반환 값
      - `{"success": true, "count_unowned": (그 책장에 꽂혀 있던 책의 수), "count_owned": (그 책장이 소유한 책의 수), "count_nonexistence": (명시된 책 중에서 존재하지 않는 책의 수)}`
      - `{"success": false, "reason": "The library API token is not valid."}`
      - `{"success": false, "reason": "The bookcase number is not valid."}`
      - ``{"success": false, "reason": "The `bookCodes` is not valid. Note that they must be strings."}``
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "There is no library that has the library API token!"}`

  - **특정한 책장으로 온 점등 요청 정보를 얻기**
    - 요청
      - POST
      - `/API/getMyLights`
    - 인자
      - `libraryAPIToken`
      - `bookcaseNumber`: 책장 번호이다. 이것은 그 도서관에서 유일해야 한다.
    - 동작
      1. 입력이 유효한지 검사한다.
      2. 도서관 ID를 얻는다: `db.libraries.findOne({libraryAPIToken: (그 도서관 API 토큰)}, {libraryID: 1}).libraryID`. 이때에 명시된 도서관 API 토큰에 해당하는 도서관이 없으면 `{"success": false, "reason": "There is no library that has the library API token!"}`을 반환한다.
      3. 명시된 책장으로 온 점등 요청 정보를 얻는다: `global.db.collection("lights").find({libraryID: libraryID, bookcaseNumber: bookcaseNumber})`.
      4. 점등 요청이 없으면 `{"success": true, "lightColor": null}`을 반환하고, 점등 요청이 있으면 ``{"success": true, "lightColor": (그 점등 요청 가운데 하나의 `lightColor`)}``를 반환한다.
    - 반환 값
      - `{"success": false, "reason": "The library API token is not valid."}`
      - `{"success": false, "reason": "The bookcase number is not valid."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "There is no library that has the library API token!"}`
      - `{"success": true, "lightColor": (점등해야 하는 빛의 색깔)}`
    - 비고
      - `lightColor`는 `null`일 수 있다. 이는 소등하여야 함을 의미한다.
      - 응답 예: `{"success": true, "lightColor": "#BE8CDF"}`.


## 사용자(도서관 이용자)를 위한 것 - 6개의 API가 문서화되었음.

  - **회원 가입하기**
    - 요청
      - POST
      - `/API/user/register`
    - 인자
      - ID
      - password
    - 동작
      1. 입력된 인수가 유효한지 확인한다.
      2. 입력된 ID가 이미 등록된 계정의 ID인지 엄격하지 않게 확인한다: `db.accounts.findOne({ID: (그 계정 ID)}, {"_id": 1})`. 만약 그렇다면, `{"success": false, "reason": "The account already exists."}`를 반환한다.
      3. 입력된 암호에 대한 해시를 생성한다. 이는 연산 비용이 많이 드는 작업이다.
      4. 계정이 이미 있지 않으면 계정을 생성한다: `db.accounts.updateOne({ID: (그 계정 ID)}, {$setOnInsert: {ID: (그 계정 ID), passwordHash: (그 암호에 대한 해시), type: "user", information: {usingLibraries: []}}}, {upsert: true})`.
      5. 4번 단계에서 사용한 쿼리의 반환 값의 `"upsertedId"` 프로퍼티가 존재하면 `{"success": true}`를 반환하고, 아니면 `{"success": false, "reason": "The account already exists."}`를 반환한다.
    - 반환 값
      - `{"success": true}`
      - `{"success": false, "reason": "The ID is not valid."}`
      - `{"success": false, "reason": "The password is not valid."}`
      - `{"success": false, "reason": "The account already exists."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`

  - **사용자 코드를 소유하기**
    - 요청
      - POST
      - `/API/user/ownUserCode`
    - 인자
      - `libraryID`: 그 사용자 코드가 유효한 도서관의 ID이다.
      - `userCode`: 소유할 사용자 코드이다.
    - 동작
      1. 입력된 인수가 유효한지 확인한다.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`.
      3. `theAccount.type === "user"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not a user!"}`를 반환한다.
      4. 그 도서관에 대한 사용자 코드를 이미 가지고 있으면(`db.userCodes.findOne({libraryID: (the library ID), userID: request.session.loggedInAs})`), `{"success": false, "reason": "You already have a user code for the library."}`를 반환한다.
      5. 그 사용자 코드가 존재하고 소유되어 있지 않다면 소유한다: `queryResult = db.userCodes.updateOne({libraryID: (그 도서관 ID), userCode: (그 사용자 코드), userID: null}, {$set: {userID: request.session.loggedInAs}})`.
      6. 만약 `queryResult.modifiedCount === 1`이면, `{"success": true}`를 반환한다.
      7. 그것이 아니고 `queryResult.modifiedCount === 0`이라면, `{"success": false, "reason": "The user-code does not exist, or is already owned by another user."}`를 반환한다.
    - 반환 값
      - `{"success": false, "reason": "The library ID is not valid."}`
      - `{"success": false, "reason": "The user code is not valid."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "You already have a user code for the library."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "The user-code does not exist, or is already owned by another user."}`
      - `{"success": true}`

  - **자신이 이용하는 도서관의 자신의 사용자 코드를 얻기**
    - 요청
      - POST
      - `/API/user/getMyUserCodes`
    - 인자
      - `noGET`: 반드시 참 값이어야 한다.
    - 동작
      1. `noGET`이 참 값인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "noGET is not truthy."}`를 반환한다.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. `theAccount.type === "user"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not a user!"}`를 반환한다.
      4. `global.db.collection("userCodes").find({userID: request.session.loggedInAs}, {"_id": 0}).toArray(...)` 쿼리의 결과를 가공하여 `{"success": true, "userCodes": [{"libraryID": (이용하는 도서관의 ID), "userCode": (그 사용자 코드), "userID": (사용자 계정 ID), "permission": {"borrowable": (그 도서관의 책을 빌릴 수 있는 권한), "lightable": (그 도서관의 책장을 점등할 수 있는 권한)}}, ...]}` 꼴로 만들고 그것을 반환한다.
    - 반환 값
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true, "userCodes": [{"libraryID": (이용하는 도서관의 ID), "userCode": (그 사용자 코드), "userID": (사용자 계정 ID), "permission": {"borrowable": (그 도서관의 책을 빌릴 수 있는 권한), "lightable": (그 도서관의 책장을 점등할 수 있는 권한)}}, ...]}`

  - **책 검색하기**
    - 요청
      - POST
      - `/API/user/searchBooks`
    - 인자
      - `libraries`: 검색하는 책이 있을 수 있는 도서관 ID의 배열.
      - `searchBy`: 무엇으로 검색하는지를 나타내는 문자열(`"ISBN"` 또는 `"title"`).
      - `searchingFor`: `searchBy`가 `"ISBN"`이면 검색하는 책의 ISBN 문자열, `searchBy`가 `"title"`이면 검색하는 책의 제목의 일부에 해당하는 문자열.
    - 동작
      1. 입력된 인수가 유효한지 확인한다.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. `theAccount.type === "user"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not a user!"}`를 반환한다.
      4. `libraries`에 그 사용자가 이용하고 있지 않은 도서관이 포함되어 있다면 `{"success": false, "reason": "Some of the libraries do not have the user's user code."}`를 반환한다.
      5. `searchBy`가 `"ISBN"`이면, 명시된 도서관에 있는 그 ISBN에 해당하는 책의 위치와 상태 등에 대한 정보를 얻는다: `books = global.db.collection("books").find({libraryID: {$in: libraries}, ISBN: searchingFor}, {"_id": 0})`.
      6. 그 다음에, 그 ISBN에 해당하는 책의 정보를 얻는다: `bookInformation = global.db.collection("bookInformation").findOne({ISBN: searchingFor}, {"_id": 0})`.
      7. 그렇지 않고 `searchBy`가 `"title"`이면, 제목에 `searchingFor`에 명시된 문자열이 포함된 책의 정보를 얻는다. 이때에 정규 표현식 문법에서 쓰이는 문자가 있다면 그 문자를 escape한다. (``bookInformation = global.db.collection("bookInformation").find({title: {$regex: (`searchingFor`에 명시된 문자열을 escape한 것), $options: "i"}}, {"_id": 0})``)
      8. 그 다음에, 그 책들의 ISBN으로 이루어진 배열을 만든다.
      9. 그 다음에, 명시된 도서관에 있는, 그 ISBN들에 해당하는 책의 위치와 상태 등에 대한 정보를 얻는다: `books = global.db.collection("books").find({libraryID: {$in: libraries}, ISBN: {$in: (그 ISBN 배열)}}, {"_id": 0})`.
      10. `books`와 `bookInformation`을 `{"success": true, "books": [{"ISBN": (그 책의 ISBN), "libraryID": (그 도서관의 ID), "bookcaseNumber": (그 책장 번호), "bookcaseUpdatedAt": (그 책장에 그 책이 있다는 사실이 확인된 최근 시각), "available": (그 책이 그 도서관의 책장에 꽂혀 있고 그 사용자가 "borrowable" 권한을 가져서 그 사용자가 그 책을 빌릴 수 있는지)}, ...], "bookInformation": {(그 책의 ISBN): {"title": (그 책의 제목), "author": (그 책의 저자), "description": (그 책에 대한 설명)}, ...}}` 꼴로 가공하여 반환한다. 이때에 정보가 없는 책에 대하여, `bookInformation`에 `title`·`author`·`description` 프로퍼티가 `null`인 객체가 들어간다. 또, `books`에 명시되지 않은 책에 대한 정보는 `bookInformation`에 들어가지 않게 한다.
    - 반환 값
      - `{"success": true, "books": [{"ISBN": (그 책의 ISBN), "libraryID": (그 도서관의 ID), "bookcaseNumber": (그 책장 번호), "bookcaseUpdatedAt": (그 책장에 그 책이 있다는 사실이 확인된 최근 시각), "available": (그 책이 그 도서관의 책장에 꽂혀 있고 그 사용자가 "borrowable" 권한을 가져서 그 사용자가 그 책을 빌릴 수 있는지)}, ...], "bookInformation": {(그 책의 ISBN): {"title": (그 책의 제목), "author": (그 책의 저자), "description": (그 책에 대한 설명)}, ...}}`
      - ``{"success": false, "reason": "The `libraries` is not valid."}``
      - ``{"success": false, "reason": "The `searchBy` is not valid."}``
      - ``{"success": false, "reason": "The `searchingFor` is not valid."}``
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "Some of the libraries do not have the user's user code."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
    - 비고
      - 책 정보를 알 수 없는 경우에, `title`·`author`·`description` 프로퍼티는 `null`일 수 있다.
      - 응답 예: `{"success":true,"bookInformation":{"9788970507644":{"title":null,"author":null,"description":null}},"books":[{"ISBN":"9788970507644","libraryID":"10","bookcaseNumber":100,"bookcaseUpdatedAt":"2016-09-23T10:04:30.919Z","available":true}]}`.

  - **특정한 책이 있는 책장에 대한 점등 요청을 보내기** (:star: The API is currently working, but its documentation is yet.)
    - 요청
      - POST
      - `/API/user/light`
    - 인자
      - `libraryID`: 점등할 책장이 있는 도서관의 ID.
      - `ISBN`: 점등할 책장 안에 있는 책의 ISBN.
    - 동작 :star:
      1. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      2. `theAccount.type === "user"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not a user!"}`를 반환한다.
      3. ?
    - 반환 값
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "The library ID is not truthy."}`
      - `{"success": false, "reason": "The ISBN is not truthy."}`
      - `{"success": false, "reason": "You do not have a user code for the library!"}`
      - `{"success": false, "reason": "You do not have permission to light the library!"}`
      - `{"success": false, "reason": "You are already lighting a library."}`
      - `{"success": false, "reason": "There is no book has the ISBN in a bookcase of the library."}`
      - `{"success": true, "lightColor": (그 빛의 색깔), "lightedBookcaseNumber": (점등할 책장의 번호)}`
    - 비고
      - 응답 예: `{"success": true, "lightColor": "#BE8CDF", "lightedBookcaseNumber": 1}`.

  - **도서관의 책 하나를 빌리기** (:star:; The API is currently working, but its documentation is yet.)(:star:; Need to sync with the English ver.)
    - 요청
      - POST
      - `/API/user/borrowBook`
    - 인자
      - `libraryID`: 빌릴 책이 있는 도서관의 ID이다.
      - `bookCode`: 이 값은 그 빌릴 책의 RFID 태그에 기록되어 있는 값이다.
    - 동작
      - :star: ...
    - 반환 값
      - `{"success": false, "reason": "The library ID is not valid."}`
      - `{"success": false, "reason": "The book code is not valid."}`
      - `{"success": false, "reason": "The library ID is not valid."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not a user!"}`
      - `{"success": false, "reason": "You do not have a user code for the library!"}`
      - `{"success": false, "reason": "You are not permitted to borrow a book of the library!"}`
      - `{"success": false, "reason": "The book that has the book code does not exist."}`
      - `{"success": false, "reason": "The book is already borrowed."}`
      - `{"success": true}`


## 도서관 관리자를 위한 것 - 7개의 API가 문서화되었음.

  - **도서관에 책 추가하기**
    - 요청
      - POST
      - `/API/administrator/addBook` 또는 `/API/admin/addBook` (:star:; Need to sync with the English ver.)
    - 인자
      - `ISBN`: 추가할 책의, EAN-13 형식의 국제 표준 도서 번호를 담고 있는 문자열이다.
      - `bookCode`: 이것은 그 책의 RFID 태그에 기록되어 있어야 한다.
    - 동작
      1. 입력된 인수가 유효한지 확인한다.
      2. 요청자가 로그인하였는지 확인한다.
      3. 요청자가 도서관 관리자인지 확인한다.
      4. 그 관리자(요청자)의 도서관의 ID를 얻는다: `db.accounts.fineOne({ID: request.session.loggedInAs}).information.libraryID`.
      5. 그 책이 이미 있지 않으면 그 책을 추가한다: `db.books.updateOne({libraryID: (그 도서관 ID), bookCode: (그 책 코드)}, {$setOnInsert: {libraryID: (그 도서관 ID), bookCode: (그 책 코드), bookcaseNumber: null, ISBN: (그 국제 표준 도서 번호), bookcaseUpdatedAt: null}}, {upsert: true})`.
      6. 5번 단계에서 사용한 쿼리의 반환 값의 `"upsertedId"` 프로퍼티가 존재하면 `{"success": true}`를 반환하고, 아니면 `{"success": false, "reason": "The book already exists."}`를 반환한다.
    - 반환 값
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "The ISBN is not valid."}`
      - `{"success": false, "reason": "The book code is not valid."}`
      - `{"success": false, "reason": "The book already exists."}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true}`

  - **그 관리자(요청자)의 도서관에 대한 정보 얻기**
    - 요청
      - POST
      - `/API/administrator/getLibraryInformation` 또는 `/API/admin/getLibraryInformation`
    - 인자
      - `noGET`: 반드시 참 값이어야 한다.
    - 동작
      1. `noGET`이 참 값인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "noGET is not truthy."}`를 반환한다.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. `theAccount.type === "administrator"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not an administrator of a library!"}`를 반환한다.
      4. `theLibraryInformation = db.libraries.findOne({"libraryID": theAccount.information.libraryID}, {"_id": 0})`
      5. `JSON.stringify({"success": true, "libraryID": theLibraryInformation.libraryID, "libraryAPIToken": theLibraryInformation.libraryAPIToken, "userCodes": theLibraryInformation.userCodes})`를 반환한다.
    - 반환 값
      - `{"success": false, "reason": "noGET is not truthy."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true, "libraryID": (그 도서관 ID), "libraryAPIToken": (그 도서관 API 토큰)}`

  - **그 관리자(요청자)의 도서관의 사용자 코드에 대한 정보 얻기**
    - 요청
      - `/API/administrator/getUserCodes` 또는 `/API/admin/getUserCodes`
    - 인자
      - `noGET`: 반드시 참 값이어야 한다.
    - 동작
      1. `noGET`이 참 값인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "noGET is not truthy."}`를 반환한다.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. `theAccount.type === "administrator"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not an administrator of a library!"}`를 반환한다.
      4. `theUserCodes = db.userCodes.find({"libraryID": theAccount.information.libraryID}, {"libraryID": 1, "userCode": 1, "userID": 1, "permission": 1, "_id": 0})`
      5. `JSON.stringify({"success": true, "userCodes": theUserCodes})`를 반환한다.
    - 반환 값
      - `{"success": false, "reason": "noGET is not truthy."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": true, "userCodes": [{"libraryID": (그 도서관 ID), "userCode": (사용자 코드), "userID": (사용자 ID), "permission": {"borrowable": (true 또는 false), "lightable": (true 또는 false)}}, ...]}`

  - **사용자 코드를 생성하고 관리하에 두기**
    - 요청
      - POST
      - `/API/administrator/newUserCode` 또는 `/API/admin/newUserCode`
    - 인자
      - `noGET`: 반드시 참 값이어야 한다.
    - 동작
      1. `noGET`이 참 값인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "noGET is not truthy."}`를 반환한다.
      2. `theAccount = db.accounts.findOne({ID: request.session.loggedInAs}, {type: 1, information: 1})`
      3. `theAccount.type === "administrator"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not an administrator of a library!"}`를 반환한다.
      4. 무작위의 사용자 코드를 생성한다: `(length => (Math.random().toString(36).substring(2, 2 + length) + '0'.repeat(length)).substring(0, length))(20).toUpperCase()`.
      5. 생성된 사용자 코드가 그 도서관에 존재하지 않으면 그 사용자 코드를 추가한다.: `queryResult = db.userCodes.updateOne({libraryID: theAccount.information.libraryID, "userCode": (새롭게 생성된 사용자 코드)}, {$setOnInsert: {libraryID: theAccount.information.libraryID, "userCode": (새롭게 생성된 사용자 코드), userID: null, permission: {"borrowable": false, "lightable": false}}}, {upsert: true})`.
      6. 그 사용자 코드가 추가되었으면(`if(queryResult && queryResult.upsertedCount === 1)`), `{"success": true, "theNewUserCode": (새롭게 생성된 사용자 코드)}`를 반환한다.
      7. 아니면, `{"success": false, "reason": "Could not generate a new user code. Please try again."}`을 반환한다.
    - 반환 값
      - `{"success": false, "reason": "noGET is not truthy."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "Could not generate a new user code. Please try again."}`
      - `{"success": true, "theNewUserCode": (새롭게 생성된 사용자 코드)}`

  - **특정한 사용자 코드의 권한 설정하기**
    - 요청
      - POST
      - `/API/administrator/setPermissions` 또는 `/API/admin/setPermissions`
    - 인자
      - `userCode`
      - `borrowable`
      - `lightable`
    - 동작
      1. 입력된 인수가 유효한지 확인한다.
      2. 요청자가 관리자인지 확인한다.
      3. 그 관리자(요청자)의 도서관의 ID를 얻는다: `db.accounts.findOne({ID: request.session.loggedInAs}, {information: 1}).information.libraryID`.
      4. `db.userCodes.updateOne({libraryID: (그 도서관 ID), "userCode": (권한을 설정할 사용자 코드)}, {$set: {"permission": (설정할 권한들)}})` 후에, 만약 반환된 객체의 `modifiedCount`가 `1`이 아니면, `{"success": false, "reason": "The user code does not exist."}`를 반환한다.
      5. 그렇지 않으면, `{"success": true}`를 반환한다.
    - 반환 값
      - `{"success": false, "reason": "The user code is not valid."}`
      - `{"success": false, "reason": "The ``borrowable`` is not valid."}`
      - `{"success": false, "reason": "The ``lightable`` is not valid."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "The user code does not exist."}`
      - `{"success": true}`

  - **그 도서관의 특정한 사용자 코드 제거하기**
    - 요청
      - POST
      - `/API/administrator/deleteUserCode` 또는 `/API/admin/deleteUserCode`
    - 인자
      - `userCode`: 제거할, 그 도서관에 존재하는 사용자 코드이다.
    - 동작
      1. 입력된 인수가 유효한지 확인한다.
      2. 요청자가 관리자인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not an administrator of a library!"}`를 반환한다.
      3. 그 관리자(요청자)의 도서관의 ID를 얻는다: `db.accounts.findOne({ID: request.session.loggedInAs}, {information: 1}).information.libraryID`.
      4. 그 사용자의 점등을 무효화한다: `db.lights.remove({libraryID: (그 도서관 ID), lighter: (제거할 사용자 코드)})`.
      5. `db.userCodes.remove({libraryID: (그 도서관 ID), userCode: (제거할 사용자 코드)}, {justOne: true})` 후에, 만약 그 반환 값에 `1`의 값을 가진 `deletedCount` 속성이 없으면, `{"success": false, "reason": "The user code does not exist."}`를 반환한다.
      6. `{"success": true}`를 반환한다.
    - 반환 값
      - `{"success": false, "reason": "The user code is not valid."}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`
      - `{"success": false, "reason": "The user code does not exist."}`
      - `{"success": true}`

  - **새로운 도서관 API 토큰을 생성하여 그것을 도서관 API 토큰으로 하기**
    - 요청
      - POST
      - `/API/administrator/newLibraryAPIToken` 또는 `/API/admin/newLibraryAPIToken`
    - 인자
      - `noGET`: 반드시 참 값이어야 한다.
    - 동작
      1. `noGET`이 참 값인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "noGET is not truthy."}`를 반환한다.
      2. `theAccount.type === "administrator"`인지 확인한다. 그렇지 않다면, `{"success": false, "reason": "You are not an administrator of a library!"}`를 반환한다.
      3. 새로운 도서관 API 토큰이 될 무작위의 긴 문자열을 생성한다.
      4. 그것이 기존의 도서관 API 토큰과 같은지 확인한다. 만약 그렇다면, 3번 동작(c)으로 간다.
      5. 그 관리자(요청자)의 도서관의 ID를 얻는다: `db.accounts.findOne({ID: request.session.loggedInAs}).information.libraryID`.
      6. `db.libraries.updateOne({libraryID: (그 도서관 ID)}, {$set: {libraryAPIToken: (그 새로운 도서관 API 토큰)}})`
    - 반환 값
      - `{"success": true, "libraryAPIToken": (새로 생성된 도서관 API 토큰)}`
      - `{"success": false, "reason": "You have to log-in!"}`
      - `{"success": false, "reason": "You are not an administrator of a library!"}`
      - `{"success": false, "reason": "Something is wrong with the database."}`


## 개발자를 위한 것 - 1개의 API가 문서화되었음.

  - **서버 기록 보기**
    - 요청
      - GET
      - `/test/log`
    - 인자
      - _(없음.)_
    - 동작
      1. `process.stdout.write`를 hook하여 그 내용을 모두 저장해 둔다.
      2. 그것을 반환한다.
    - 반환 값
      - _(서버 기록)_



# 최적화에 대하여

## 특정한 문서가 있는지 확인할 때
 [이 글](https://blog.serverdensity.com/checking-if-a-document-exists-mongodb-slow-findone-vs-find/)에 따르면, 특정한 문서가 있는지 확인할 때에, `findOne`은 `find`와 `limit`의 조합보다 매우 느리다고 한다. 그러나 나는 `node-mongodb-native` 모듈을 쓰고 이 모듈의 `findOne`은 내부적으로 `find`와 `limit`의 조합으로 구현되어 있기 때문에, 특정한 문서가 있는지 확인하기 위해 `findOne`을 쓰겠다.
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



# LibraryLight 데이터베이스 구조
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
      - libraryID: (그 사용자 코드가 유효한 도서관의 ID)
      - userCode: (20 자의, 반각 숫자 또는 라틴 알파벳으로 이루어진 문자열)
      - userID: null | "이 사용자 코드에 해당하는 계정의 ID"
      - permission: {"borrowable": true|false, "lightable": true|false}
    - lights
      - libraryID
      - bookcaseNumber
      - lightColor
      - ISBN
      - lighter
      - createdAt // [본래 이것은 MongoDB TTL index를 적용하려고 하였으나 MongoDB는 1분 간격으로 만료 여부를 검사하기에 문서 유지 시간이 10초인 경우에는 부적합하다고 판단하여 직접 쿼리를 함으로써 문서의 만료를 구현하였다.](http://blog.naver.com/wlzla000/220822430625)
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

## 데이터베이스 초기화 시에 삽입되는 항목
[initialize_database.js](https://github.com/wlzla000/LibraryLight/blob/master/Source/LibraryLight/utils/initialize_database.js)를 보시오.

## *사용자 코드*의 의의
 _사용자 코드_가 없다고 가정하면, 도서관 관리자에게 그 도서관을 이용할 권한을 받기 위해 계정 ID를 제출하여야 할 것이고, 이때에 **타인** A의 ID를 제출하면 그 도서관의 관리자가 그 ID에 그 권한을 부여하여 A가 그 도서관의 이용자가 될 것이다. 그런데 이는 A의 요청에 의한 것이 아니므로, 이런 방식은 바람직하지 않다. 이에 ‘_사용자 코드_’라는 개념을 도입하여, 특정한 계정을 가진 자가 특정한 도서관의 이용자가 되려면 그 도서관에서 발급한 사용자 코드를 그 계정으로 로그인한 상태에서 도서관 ID와 함께 등록해야 하게 만듦으로써 상기된 방식의 문제점을 해결하였다.
