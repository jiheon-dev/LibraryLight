/*
	MIT License

	Copyright (c) 2016 K.(wlzla000@naver.com)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

print("Start the initializing -- ");
	
db = db.getSiblingDB("LibraryLight");
const collections = ["accounts", "bookInformation", "books", "libraries", "lights", "sessions", "userCodes"];
collections.forEach(collectionName => db[collectionName].remove({}));



db.bookInformation.insert([
		{ISBN: "9788935305223", title: "Software engineering", author: "최은만", description: "소프트웨어 공학"},
		{ISBN: "9788998756413", title: "Operating system", author: "구현회", description: "운영 체제"},
		{ISBN: "9788970507644", title: "Java 프로그래밍", author: "황기태·김효수", description: "명품 Java programming"},
		{ISBN: "9788996094050", title: "열혈 C 프로그래밍", author: "윤성우", description: "열혈!"},
		{ISBN: "9788979148046", title: "뇌를 자극하는 TCP/IP 소켓 프로그래밍", author: "윤상배", description: "Sockets!"},
		{ISBN: "9791156641209", title: "우분투 리눅스 - 시스템 & 네트워크", author: "이종원", description: "Yup, it's Linux. :)"},
		{ISBN: "9788960777552", title: "자바 객체 지향 프로그래밍 입문", author: "음두헌", description: "Java OOP"},
		{ISBN: "9791185123080", title: "리눅스 마스터 2급 정복하기", author: "배유미·정성재", description: "Hehe ;)"}
	]);
db.accounts.insert([
		{ID: "abcde12345", passwordHash: "$2a$12$4HHrx.hByHhIB4fV83nse.F9B22Y4ZlxMtnl75Cw9LmijqKqSx562", type: "user", information: {}},
		{ID: "mskang116", passwordHash: "$2a$12$0uSAioBrz7.24PrqOk26wuzx7m2d1H0Ss7xhRoX8Ynt8vHoW6HqMK"/*penguin*/, type: "user", information: {}},
		{ID: "sdk", passwordHash: "$2a$12$dkSTlwJ1AOzPzpelEkJpaeYDHqsHO.xTMBMFu8jj1EsnX8hhaKBPq"/*loginsdk*/, type: "administrator", information: {libraryID: "test_library"}}
	]);


db.libraries.insert({
		libraryID: "test_library",
		libraryAPIToken: "SOMBMsCSDOFKOrUxG3qjTpmpdemj9z1SWKmievcHqU7j7MYmVsTEorBZqfpWWrgD5FQpXePDW6j8LkM5f8qkNW0Rc8HgzmL59rOV575hXMULQNHVO2EljSUiM3ve14QA"
	});
db.books.insert([
		{
			bookCode: "04_1E_45_3A", // Software engineering
			libraryID: "test_library",
			ISBN: "9788935305223",
			bookcaseNumber: null,
			bookcaseUpdatedAt: null,
			borrower: null
		},
		{
			bookCode: "04_27_46_3A", // "Operating system"
			libraryID: "test_library",
			ISBN: "9788998756413",
			bookcaseNumber: null,
			bookcaseUpdatedAt: null,
			borrower: null
		},
		{
			bookCode: "04_15_44_3A", // "Java 프로그래밍"
			libraryID: "test_library",
			ISBN: "9788970507644",
			bookcaseNumber: null,
			bookcaseUpdatedAt: null,
			borrower: null
		},
		{
			bookCode: "04_22_46_3A", // "열혈 C 프로그래밍"
			libraryID: "test_library",
			ISBN: "9788996094050",
			bookcaseNumber: null,
			bookcaseUpdatedAt: null,
			borrower: null
		},
		{
			bookCode: "04_32_46_3A", // "뇌를 자극하는 TCP/IP 소켓 프로그래밍"
			libraryID: "test_library",
			ISBN: "9788979148046",
			bookcaseNumber: null,
			bookcaseUpdatedAt: null,
			borrower: null
		},
		{
			bookCode: "04_2C_46_3A", // "우분투 리눅스 - 시스템 & 네트워크"
			libraryID: "test_library",
			ISBN: "9791156641209",
			bookcaseNumber: null,
			bookcaseUpdatedAt: null,
			borrower: null
		},
		{
			bookCode: "04_1A_44_3A", // "자바 객체 지향 프로그래밍 입문"
			libraryID: "test_library",
			ISBN: "9788960777552",
			bookcaseNumber: null,
			bookcaseUpdatedAt: null,
			borrower: null
		},
		{
			bookCode: "9B_13_27_2B", // "리눅스 마스터 2급 정복하기"
			libraryID: "test_library",
			ISBN: "9791185123080",
			bookcaseNumber: null,
			bookcaseUpdatedAt: null,
			borrower: null
		}
	]);
db.userCodes.insert([
		{
			libraryID: "test_library",
			userCode: "J9O5W8H",
			userID: "mskang116",
			permission: {borrowable: true, lightable: true}
		}
	]);

print("-- Initialized");
