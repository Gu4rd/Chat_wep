var express = require('express');
var http = require('http');
var path = require('path');
var ejs = require("ejs");
var bodyParser = require('body-parser');
var serveStatic = require('serve-static');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var mysql = require('mysql');
var nodemailer = require('nodemailer');
var smtpTransporter = require('nodemailer-smtp-transport');
var crypto = require('crypto');
var socket = require('socket.io');
var fs = require('fs');

const rateLimit = require('express-rate-limit');

//======================== 기본설정 파트 ======================== //
//======================== 기본설정 파트 ======================== //
//======================== 기본설정 파트 ======================== //

// 로그인 제한 설정 
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 얼마 동안
    max : 10, // 몇 회 시도
    message : "You tried to log in several times in a short time. We blocked you for a moment to protect user's information. please try later" // 차단 시 전송 메시지
});


// 프로세스를 위한 데이터베이스 연결
var pool = mysql.createPool({
    connectionLimit : 10,
    host : 'localhost',
    user : 'root',
    password : 'Jschatwep1!',
    database : 'information_guests',
    debug : false
});

var app = express();

// express js를 사용하기 위한 기본 설정
const server = http.createServer(app);
app.use('/public', serveStatic(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());


app.use(cookieParser());

var MySQLStore = require('express-mysql-session')(expressSession);

// 세션 연결을 위한 데이터베이스 연결
var options = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password : 'Jschatwep1!',
    database : 'information_guests',
};

var sessionStore = new MySQLStore(options); // 세션이 저장될 변수

// 세션 키와 쿠키의 생존 시간 설정
app.use(expressSession({
    key: "JsSession1!",
    secret:'JsChatwep1!',
    resave: true,
    saveUninitialized:true,
    cookie: {maxAge: 1000*60*60},
    store: sessionStore
}));



var router = express.Router(); // 1번 라우트 
var router2 = express.Router(); // 2번 라우트


//======================== 라우터 파트 ======================== //
//======================== 라우터 파트 ======================== //
//======================== 라우터 파트 ======================== //


//======================== 로그인 관련 파트 ======================== //
//======================== 로그인 관련 파트 ======================== //
//======================== 로그인 관련 파트 ======================== //
// 로그인 시 라우터
app.post('/process/login', loginLimiter, function(req, res){
	console.log('로그인 호출');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramID = req.body.id;
    var paramPW = req.body.password;
    
    
    var hashed_password = crypto.createHash('sha256').update(paramPW).digest('base64'); // 패스워드 해시화
    console.log('id: ' + paramID + ', pramPW: ' + hashed_password);
    
    // 로그인 함수 호출
    login(paramID, hashed_password, function(err, rows, result, result2){
       
       // 로그인 알 수 없는 에러 발생 시
       if (err){
           console.log('로그인 에러 발생');
            res.writeHead(200,{ "Content-Type": "text/html;charset=utf-8"});
            res.write('<h1>에러 발생</h1>');
            res.write('<br><a href="/public/index.html">메인 화면으로 이동</a>');
            res.end();
            return;
       }
       // 사용자가 존재 할 시
        if (rows) {
            // 세션 등록
            req.session.uid = rows[0].id;
            req.session.nickname = rows[0].nickname;
            req.session.isLogined = true;
            
            // 로비 페이지로 이동, 로비 페이지에 정보 전달
            res.render("lobby.ejs", {
             id : rows[0].id,
             nickname : rows[0].nickname,
             rooms : result,
             users : result2
            });
        }
        // 사용자가 없을 시
        else{
            console.log(rows);
            res.sendFile(path.join(__dirname, '/public', 'fail_login.html'));
        }
    });    
});


// Oauth 접속 시 이메일별 닉네임 확인
router2.route('/check_Email_Oauth').post(function(req, res){
    console.log('Oauth 로그인 이메일 check');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramEmail = req.body.email;
    
    // 아무런 정보를 받지 않았을 시
    if(paramEmail == "")
    {
        var isNull = "";
        res.end(isNull);
    }
    
    // 이메일별 닉네임 확인 함수 호출
    else{
        console.log('Email : ' + paramEmail);

        check_nickname_Oauth(paramEmail, function(err, result){
            res.end(result);
        });
    }
});


// 로그아웃 시 라우터
router.route('/process/logout').post(function(req, res){
    var paramNickname = req.body.nickname;
    // 세션삭제 과정
    console.log(paramNickname);
    req.session.destroy(function(err){
        if(err) console.error('err', err);
        res.clearCookie("JsSession1!"); // 쿠키를 삭제함
        clear_userlist(paramNickname);
    });
});


//======================== 회원가입 관련 파트 ======================== //
//======================== 회원가입 관련 파트 ======================== //
//======================== 회원가입 관련 파트 ======================== //

// 회원가입 시 라우터
router.route('/process/signUp').post(function(req, res){
    console.log('회원가입 시도');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramID = req.body.id || req.query.id;
    var paramPW = req.body.password || req.query.password;
    var paramNickname = req.body.nickname || req.query.nickname;
    var paramGender = req.body.gender || req.query.gender;
    var paramEmail = req.body.email || req.query.email;
    var hashed_password = crypto.createHash('sha256').update(paramPW).digest('base64'); // 패스워드 해시화

    console.log('id: ' + paramID + ', paramPW: ' + hashed_password + ', paramNickname: ' + paramNickname + ', paramGender: ' + paramGender + ', paramEmail: ' + paramEmail);

    // 회원가입 함수 호출
    signUp(paramID, hashed_password, paramNickname, paramGender, paramEmail, function(err, result){
        
        // 회원가입 도중 에러 발생 시
        if (err){
            console.log('회원가입 도중 에러 발생');
            res.writeHead(200,{ "Content-Type": "text/html;charset=utf-8"});
            res.write('<h1>에러 발생</h1>');
            res.write('<br><a href="/public/index.html">메인 화면으로 이동</a>');
            res.end();
            return;
        }
        
        // 회원가입 성공 시
        if (result){
            console.dir(result);
            res.sendFile(path.join(__dirname, '/public', 'login.html'));
        }
        
        // 회원가입 실패 시
        else{
            console.log('회원가입 시 DB 추가 에러');
            res.writeHead(200,{ "Content-Type": "text/html;charset=utf-8"});
            res.write('<h1>DB 추가 에러</h1>');
            res.write('<br><a href="/public/index.html">메인 화면으로 이동</a>');
            res.end();
        }
    });
});

// 회원가입을 위한 코드 전송 시 라우터
router2.route('/send_code_signUp').post(function(req, res){
  console.log('회원가입 코드 전송');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
  var paramEmail = req.body.email;
  var code = Math.random().toString(36).slice(6).toUpperCase(); // 코드 생성

  console.log('Email : ' + paramEmail);

  send_mail_certification(paramEmail, code); // 생성한 코드 전송
    
    // 코드 전송 함수 호출
  send_code_signUp_function(paramEmail, code, function(err, result){
    res.end(result);
  });
});

// 회원가입을 위한 코드 인증 시 라우터
router2.route('/check_code_signUp').post(function(req, res){
  console.log('회원가입 코드 인증');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
  var paramEmail = req.body.email;
  var paramCode = req.body.code;

  console.log('Code : ' + paramCode);
    
    // 코드 인증 함수 호출
  check_code_signUp_function(paramEmail, paramCode, function(err, result){
    res.end(result);
  });
});

// 회원가입 시 ID 중복 확인(비동기 구현)
router2.route('/check_ID').post(function(req, res){
    console.log('ID 중복 확인');
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramID = req.body.id;
    
    // 아무런 정보를 받지 않았을 시
    if(paramID == "")
    {
        var isNull = "";
        res.end(isNull);
    }
    
    // ID중복 체크 함수 호출
    else
    {
        console.log('ID: ' + paramID);

        check_duplicate_ID(paramID, function(err, result){
            res.end(result);
        });
    }

});

// 회원가입 시 닉네임 중복 확인(비동기 구현)
router2.route('/check_Nickname').post(function(req, res){
    console.log('닉네임 중복 확인');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramNickname = req.body.nickname;
    
    // 아무런 정보를 받지 않았을 시
    if(paramNickname == "")
    {
        var isNull = "";
        res.end(isNull);
    }
    
    // 닉네임 중복 체크 함수 호출
    else{
        console.log('Nickname : ' + paramNickname);

        check_duplicate_Nickname(paramNickname, function(err, result){
            res.end(result);
        });
    }

});


// 회원가입 시 이메일 중복 확인(비동기 구현)
router2.route('/check_Email').post(function(req, res){
    console.log('이메일 중복 확인');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramEmail = req.body.email;
    
    // 아무런 정보를 받지 않았을 시
    if(paramEmail == "")
    {
        var isNull = "";
        res.end(isNull);
    }
    // 이메일 중복 체크 함수 호출
    else{
        console.log('Email : ' + paramEmail);

        check_duplicate_Email(paramEmail, function(err, result){
            res.end(result);
        });
    }
});

// Oauth 회원가입 시 이메일 정보 전송
router2.route('/send_emailInfo').post(function(req, res){
    console.log('이메일 정보 전송');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramEmail = req.body.email;
    console.log(paramEmail);
    
    // 페이지 변경 함수 호출
    change_page(paramEmail, function(err, result){
        console.log(result);
        res.end(result);
    });
});

//======================== 아이디 찾기 관련 파트 ======================== //
//======================== 아이디 찾기 관련 파트 ======================== //
//======================== 아이디 찾기 관련 파트 ======================== //

// 아이디 찾았을 시 라우터
router.route('/process/findID').post(function(req, res){
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramEmail = req.body.email || req.query.email;
    
    // 아이디 찾기 함수 호출
    find_id(paramEmail, function(err, result){
        // 결과를 showID페이지로 전달
          res.render("showID.ejs", {
             result : result
          });
    });
});

// 아이디 찾기 시 이메일 코드전송 라우터
router.route('/process/getCode').post(function(req, res){
    console.log('ID 찾기 이메일 코드 전송');
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramEmail = req.body.email || req.query.email;
    
    var code = Math.random().toString(36).slice(6).toUpperCase(); // 코드 생성

    console.log('인증할 이메일 : ' + paramEmail + '전송된 코드 : ' + code);
    send_mail_certification(paramEmail, code); // 생성한 코드 전송
    
    // email 별 코드 사전할당 함수
    get_mailcode(paramEmail, code, function(err, result){
        console.log('ID 찾기 사전 작업 완료');
        res.end(result);
    });
});

// ID 찾기를 위해 코드를 인증할 시
router2.route('/check_code').post(function(req, res){
    console.log('ID 찾기 시도');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramCode = req.body.certification_code;
    var paramEmail = req.body.email;

    console.log('Code : ' + paramCode);
    
    // 코드 인증 함수 호출
    check_mailcode(paramEmail, paramCode, function(err, result){
        res.end(result);
    });

});

//======================== 비밀번호 변경 관련 파트 ======================== //
//======================== 비밀번호 변경 관련 파트 ======================== //
//======================== 비밀번호 변경 관련 파트 ======================== //

// 비밀번호 변경 시 라우터
router.route('/process/change_password').post(function(req, res){
    console.log('비밀번호 변경 시도');

    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramID = req.body.id || req.query.id;
    var paramPW = req.body.password || req.query.password;
    var hashed_password = crypto.createHash('sha256').update(paramPW).digest('base64'); // 패스워드 해시화

    // 비밀번호 변경 함수 호출
    changePw(paramID, hashed_password, function(err, result){
        res.sendFile(path.join(__dirname, '/public', 'login.html'));
    });

})


// 비밀번호 변경 시 이메일 코드전송 라우터
router.route('/process/getCode_withID').post(function(req, res){
    console.log('비밀번호 재전송을 위한 이메일 코드 전송');
    
    // 호출한 곳으로 부터 필요한 정보를 받음
    var paramID = req.body.id || req.query.id;
    var paramEmail = req.body.email || req.query.email;
    
    var code = Math.random().toString(36).slice(6).toUpperCase(); // 코드 생성

    console.log('인증할 이메일 : ' + paramEmail + '전송된 코드 : ' + code);
    send_mail_certification(paramEmail, code); // 생성한 코드 전송
    
    // email 별 코드 사전할당 함수
    get_mailcode_withID(paramID, paramEmail, code, function(err, result){
        console.log('비밀번호 재전송 사전 작업 완료');
        res.end(result);
    });
});

router2.route('/create_chatroom').post(function(req, res){
	var paraminputRoom = req.body.inputRoom || req.query.inputRoom;
	var paramroomPW = req.body.roomPW || req.request.roomPW;
	
	console.log('Room_name : '+ paraminputRoom +', paramroomPW : ' + paramroomPW);
	
	createRoom(paraminputRoom, paramroomPW, function(err, result){
		res.end(result);
	});
});

router2.route('/join_chatroom').post(function(req, res){
	var paraminputRoom = req.body.inputRoom || req.query.inputRoom;
	var paramroomPW = req.body.roomPW || req.request.roomPW;
	
	console.log('Room_name : '+ paraminputRoom +', paramroomPW : ' + paramroomPW);
	
	joinRoom(paraminputRoom, paramroomPW, function(err, result){
		res.end(result);
	});
});

router2.route('/leave_chatroom').post(function(req, res){
	var paraminputRoom = req.body.inputRoom || req.query.inputRoom;
	
	console.log('채팅방 퇴장');
	
	leaveRoom(paraminputRoom, function(err, result){
		res.end(result);
	});
});
//======================== 라우터 파트 끝 ======================== //
//======================== 라우터 파트 끝 ======================== //
//======================== 라우터 파트 끝 ======================== //

// 라우터 설정
app.use('/', router);
app.use('/event', router2);


// 메인 홈페이지
app.get('/', function(req, res){
    res.sendFile(path.join(__dirname, '/public', 'index.html'));
});


//======================== 함수 파트 ======================== //
//======================== 함수 파트 ======================== //
//======================== 함수 파트 ======================== //



//======================== 로그인 관련 함수 파트 ======================== //
//======================== 로그인 관련 함수 파트 ======================== //
//======================== 로그인 관련 함수 파트 ======================== //

// 일반적인 로그인 함수
var login = function(id, password, callback) {
    console.log('로그인 시도');
    
    // 데이터 베이스 연결
    pool.getConnection(function(err, poolConn){
        if (err)
            {
                if(poolConn){
                    poolConn.release();
                }
                callback(err, null);
                return;
            }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB 연결에 필요한 정보
        var tablename = 'users';
        var columns = ['id', 'nickname'];
        var column = 'nickname';

        // 사용자가 있는지 검색
        var exec = poolConn.query("select ?? from ?? where id = ? and password = ?", [columns, tablename, id, password], function(err, rows){
            poolConn.release();
            console.log('실행된 sql : ' + exec.sql);

            if (err){
                callback(err, null);
                return;
            }

            if (rows.length > 0){
                var exec5 = poolConn.query("delete from showusers where nickname IN (select nickname from ?? where id = ?)", [tablename, id], function(err, result4){
                    if(err){
                        console.log(err);
                    }
                    else console.log('로그인전 유저 리스트 비우기 성공');
                });
                var exec3 = poolConn.query("insert into showusers select ?? from users where id = ?", [column, id], function(err, result3){
                    
                    if(err){
                        console.log(err);
                        console.log('이미 접속중인 사용자');
                    }
                    if(result3)
                    {
                        
                        var exec2 = poolConn.query("select * from rooms", function(err, result){
                            if(err){
                                console.log(err);
                                console.log('방 목록 불러올 수 없음');
                            }
                            else{
                                var exec4 = poolConn.query("select * from showusers", function(err, result2){
                                    if(err){
                                        console.log(err);
                                        console.log('유저목록 불러올 수 없음');
                                    }
					                console.log(rows);
                                    console.log('사용자 찾음');
					                console.log(result);
                                    console.log(result2);
                                    if(err){
                                        console.log(err);
                                    }
                                    else callback(null, rows, result, result2);
                                });                        
                            }
                        });   
                    }
                    else{
                        console.log('사용자 없음');
                    }
                });
            }
            else{
                console.log('사용자 없음');
                callback(null, null);
            }
        });
    });
};

// Oauth 로그인 시 닉네임 확인 함수
var check_nickname_Oauth = function(email, callback){
    console.log('check_nickname_Oauth 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if (err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB 연결에 필요한 정보
        var tablename = 'users';
        var column = 'nickname';
        
        // 닉네임이 존재하는지 확인
        var exec = poolConn.query("select ?? from ?? where email = ?", [column, tablename, email], function(err, result){
            poolConn.release();
            console.log('실행된 SQL : ' + exec.sql);

            if(err){
                console.log('sql 에러');
                callback(err, null);
                return;
            }
            if(result.length > 0)
            {
                callback(null, '0');
            }
            else{
                callback(null, '1')
            }
		});
	});
}

var clear_userlist = function(nickname)
{
    console.log('clear_userlist 함수 호출');
    
    pool.getConnection(function(err, poolConn){
        if(err){
            if(poolConn){
                poolConn.release();
            }
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        var exec = poolConn.query('delete from showusers where nickname = ?', [nickname], function(err, result){
            poolConn.release();
            console.log('실행된 SQL : ' + exec.sql);
            if(err){
                console.log(err)
            }
            if(result){
                console.log('삭제 완료');
            }
        })
    })
}

//======================== 회원가입 관련 함수 파트 ======================== //
//======================== 회원가입 관련 함수 파트 ======================== //
//======================== 회원가입 관련 함수 파트 ======================== //


// 회원가입 함수
var signUp = function(id, password, nickname, gender, email, callback)
{
    console.log('signUp 함수 호출');

    // DB 연결
    pool.getConnection(function(err, poolConn){
        if (err){
            if (poolConn) {
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB연결에 필요한 정보
        var data = { id: id, password: password, nickname: nickname, gender: gender, email: email};
        
        // 회원가입 시 DB에 정보 삽입
        var exec = poolConn.query('insert into users set ?', data, function(err, result){
            poolConn.release();
            console.log('실행된 SQL : ' + exec.sql);

            if (err) {
                console.log('sql 에러');
                callback(err, null);
                return;
            }
            callback(null, result);
        });
    });
};

// 회원가입 시 ID 중복 확인 함수
var check_duplicate_ID = function(id, callback)
{
    console.log('check_duplicate 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if (err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB연결에 필요한 정보
        var tablename = 'users';
        var column = 'id';
        
        // 같은 아이디가 존재하는 지
        var exec = poolConn.query("select ?? from ?? where id = ?", [column, tablename, id], function(err, result){
            poolConn.release();
            console.log('실행된 sql : ' + exec.sql);

            if (err){
                callback(err, null);
                return;
            }

            if(result.length > 0){
                console.log('중복 ID 존재');
                callback(null, '1');
                return '1'
            }
            else{
                console.log('유일한 ID');
                callback(null, '0');
                return '0'
            }
        });
    });
};


// 회원가입 시 닉네임 중복 확인 함수
var check_duplicate_Nickname = function(nickname, callback)
{
    console.log('check_duplicate_Nickname 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if (err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB연결에 필요한 정보
        var tablename = 'users';
        var column = 'nickname';
        
        // 같은 닉네임이 존재하는 지
        var exec = poolConn.query("select ?? from ?? where nickname = ?", [column, tablename, nickname], function(err, result){
            poolConn.release();
            console.log('실행된 sql : ' + exec.sql);

            if (err){
                callback(err, null);
                return;
            }

            if(result.length > 0){
                console.log('중복 닉네임 존재');
                callback(null, '1');
                return '1';
            }
            else{
                console.log('유일한 닉네임');
                callback(null, '0');
                return '0';
            }
        });
    });
};


// 이메일 중복 확인 함수
var check_duplicate_Email = function(email, callback)
{
    console.log('check_duplicate_Email 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if(err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB연결에 필요한 정보
        var tablename = 'users';
        var column = 'email';
        
        // 같은 이메일 존재하는 지
        var exec = poolConn.query("select ?? from ?? where email = ?", [column, tablename, email], function(err, result){
            poolConn.release();
            console.log('실행된 sql : ' + exec.sql);

            if(err){
                callback(err, null);
                return;
            }
            if(result.length > 0){
                console.log('중복 이메일 존재');
                callback(null, '1');
                return '1';
            }
            else{
                console.log('유일한 이메일');
                callback(null, '0');
                return '0';
            }
        });
    });
};

// 회원가입 시 코드 전송 함수
var send_code_signUp_function = function(email, code, callback){
  console.log('send_code_signUp_function 함수 호출');
    
    // DB 연결
  pool.getConnection(function(err, poolConn){
      if(err){
          if(poolConn){
              poolConn.release();
          }
          callback(err, null);
          return;
      }
      console.log('DB연결 : ' + poolConn.threadId);
      
      // DB 연결에 필요한 정보
      var tablename = 'emailandcode';
      
      // 입력한 이메일 임시 생성
      var exec = poolConn.query('insert into ??(email) values (?)', [tablename, email], function(err, result){
          console.log('실행된 SQL : ' + exec.sql);
          console.log(result);
          if(result == ""){
              console.log('sql 에러');
              callback(err, '1');
              return;
          }
          else{
              // 임시 이메일에 코드 전송
              var exec2 = poolConn.query('update ?? set code = ? where email = ?', [tablename, code, email], function(err, result){
              poolConn.release();
              console.log('실행된 SQL : ' + exec2.sql);
              console.log(result);
                  if(err){
                      console.log('sql 에러');
                      callback(err, '1');
                      return;
                  }
                  callback(null, '0');
          });
          }
      });
  });
};


// 회원가입 시 코드 인증 함수
var check_code_signUp_function = function(email, code, callback){
  console.log('check_code_signUp_function 함수 호출');
    
    // DB 연결
  pool.getConnection(function(err, poolConn){
      if(err){
          if(poolConn){
              poolConn.release();
          }
          callback(err, null);
          return;
      }
      console.log('DB연결 : ' + poolConn.threadId);
      // DB 연결에 필요한 정보
      var tablename = 'emailandcode';
      var column = 'code'
      
      // 할당된 코드가 일치하는지 검색
      var exec = poolConn.query('select ?? from ?? where email = ? and code = ?', [column, tablename, email, code], function(err, result){
          poolConn.release();
          console.log('실행된 SQL : ' + exec.sql);

          if(err){
              console.log('sql 에러');
              callback(err, null);
              return;
          }
          if(result.length > 0)
          {
              callback(null, '0');
          }
          else{
              callback(null, '1')
          }
      });
  });
};


// Oauth 닉네임 생성 페이지로 이동 함수
var change_page = function(email, callback)
{
    console.log('Oauth 닉네임 생성 페이지 변경');
    var result = email;
    
    callback(null, result);
}

//======================== 아이디 찾기 관련 함수 파트 ======================== //
//======================== 아이디 찾기 관련 함수 파트 ======================== //
//======================== 아이디 찾기 관련 함수 파트 ======================== //

// ID 찾기 함수
var find_id = function(email, callback)
{
    console.log('find_id 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if(err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB 연결에 필요한 정보
        var tablename = 'users';
        
        // 해당 이메일의 ID 검색
        var exec = poolConn.query('select id from ?? where email = ?', [tablename, email], function(err, result){
            poolConn.release();
            console.log('실행된 SQL : ' + exec.sql);

            if(err){
                console.log('sql 에러');
                callback(err, null);
                return;
            }
            console.log(result[0].id);
            callback(null, result[0].id);
        });
    });
};

// ID 찾기 시 코드 전송 함수
var get_mailcode = function(email, code, callback)
{
    console.log('get_mailcode 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if(err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB 연결에 필요한 정보
        var tablename = 'users';
        
        // 이메일별 코드 할당
        var exec = poolConn.query('update ?? set code = ? where email = ?', [tablename, code, email], function(err, result){
            poolConn.release();
            console.log('실행된 SQL : ' + exec.sql);

            if(err){
                console.log('sql 에러');
                callback(err, null);
                return;
            }
            callback(null, '0');
        });
    });
};

// ID 찾기, 비밀번호 변경 시 코드 인증 함수
var check_mailcode = function(email, certification_code, callback){
    console.log('check_mailcode 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if(err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB 연결에 필요한 정보
        var tablename = 'users';
        var column = 'code'
        
        // 이메일별 할당된 코드가 일치하는지 검색
        var exec = poolConn.query('select ?? from ?? where email = ? and code = ?', [column, tablename, email, certification_code], function(err, result){
            poolConn.release();
            console.log('실행된 SQL : ' + exec.sql);

            if(err){
                console.log('sql 에러');
                callback(err, null);
                return;
            }
            if(result.length > 0)
            {
                callback(null, '0');
            }
            else{
                callback(null, '1')
            }
        });
    });
};


//======================== 비밀번호 찾기 관련 함수 파트 ======================== //
//======================== 비밀번호 찾기 관련 함수 파트 ======================== //
//======================== 비밀번호 찾기 관련 함수 파트 ======================== //


// 비밀번호 변경 함수
var changePw = function(id, password, callback){
	console.log('changePw 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if (err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB 연결에 필요한 정보
        var tablename = 'users';
        var column = 'id';

		// modifeid 타임스탬프 갱신과 DB에 변경내용 반영
        var exec = poolConn.query("update ?? set modified = CURRENT_TIMESTAMP, password = ? where id = ?", [tablename, password, id], function(err, result){
            poolConn.release();
            console.log('실행된 sql : ' + exec.sql);
            if (err) {
                console.log('sql 에러');
                callback(err, null);
                return;
            }
            callback(null, result);
		});
	});
}


// 비밀번호 변경 시 코드 전송 함수
var get_mailcode_withID = function(id, email, code, callback)
{
    console.log('get_mailcode_withID 함수 호출');
    
    // DB 연결
    pool.getConnection(function(err, poolConn){
        if(err){
            if(poolConn){
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        
        // DB 연결에 필요한 정보
        var tablename = 'users';
        
        // 비밀번호를 변경할 ID 검색
        var exec = poolConn.query('select id from ?? where email = ? and id = ?', [tablename, email, id], function(err, result){
            console.log('실행된 SQL : ' + exec.sql);
            console.log(result);
            if(result == ""){
                console.log('sql 에러');
                callback(err, '1');
                return;
            }
            else{
                // ID 존재 시 해당 이메일에 코드 할당
                var exec2 = poolConn.query('update ?? set code = ? where email = ?', [tablename, code, email], function(err, reuslt){
                poolConn.release();
                console.log('실행된 SQL : ' + exec2.sql);
                console.log(result);
                    if(err){
                        console.log('sql 에러');
                        callback(err, '1');
                        return;
                    }
                    callback(null, '0');
            });
            }
        });
    });
};

//======================== 이메일 전송 함수 ======================== //
//======================== 이메일 전송 함수 ======================== //
//======================== 이메일 전송 함수 ======================== //

// 이메일 전송 함수
var send_mail_certification = function(email, certification){
	console.log('send_mail_certification 함수 호출')
    
    // 전송할 이메일 설정
	let transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'developJSG@gmail.com',
			pass: 'jschatwep1!'
		}
	});
 	 let mailOptions = {
		 from: 'developJSG@gmail.com',
		 to: email ,                     // 수신 메일 주소
		 subject: 'CODE from Jschatwep',   // 제목
		 text: certification  // 내용
	 };
    
    // 메일 전송
	transporter.sendMail(mailOptions, function(error, info){
		if (error) {
			console.log(error);
		}

		else {
			console.log('Email sent: ' + info.response);
		}
	});
};

//======================== 수정 ======================== //
//======================== 수정 ======================== //
//======================== 수정 ======================== //

app.get('/chat_room', function(request, response) {
	
	var paraminputRoom = req.body.inputRoom || req.query.inputRoom;
	var paramroomPW = req.body.roomPW || req.request.roomPW;
	
	
	
	console.log('Room_name : '+ paraminputRoom +', paramroomPW : ' + paramroomPW);
	
	createRoom(paraminputRoom, paramroomPW, function(err, result){
        console.log(result);
		res.end(result);
	});
	
})

var createRoom = function(inputRoom, roomPW, callback){
	console.log('createRoom 함수 호출');
	
	pool.getConnection(function(err, poolConn){
        if (err){
            if (poolConn) {
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
        var data = { 
			name : inputRoom,
			password : roomPW 
		};
		
        var exec = poolConn.query('insert into rooms set ?', data, function(err, result){
            poolConn.release();
            console.log('실행된 SQL : ' + exec.sql);

            if (err) {
                console.log('이미 존재하는 방');
                callback(err, '1');
            }
            else {
                callback(null, '0');
            }
        });
    });
}

var joinRoom = function(inputRoom, roomPW, callback){
	console.log('joinRoom 함수 호출');
	
	pool.getConnection(function(err, poolConn){
        if (err){
            if (poolConn) {
                poolConn.release();
            }
            callback(err, null);
            return;
        }
        console.log('DB연결 : ' + poolConn.threadId);
		
        var exec = poolConn.query('select password from rooms where name = ? and password = ?',[inputRoom, roomPW], function(err, result){
            console.log('실행된 SQL : ' + exec.sql);

            if (err) {
                console.log(err);
                callback(err, '1');
            }
            else if(result.length>0) {
				var exec2 = poolConn.query('update rooms set people = people+1 where name = ?',[inputRoom], function(err, sex){
					poolConn.release();
            		console.log('실행된 SQL : ' + exec2.sql);
					if(err){
						console.log(err);
						callback(err,'1');
					}else{
						callback(null,'0');
					}
				});
                callback(null, '0');
            }
			else{
				console.log('비밀번호가 틀렸습니다');
                callback(err, '1');
			}
        });
    });
}

var leaveRoom = function(inputRoom, callback){
	console.log('leaveRoom 함수 호출');
	
	if(inputRoom == null){
		console.log('방 제목이 존재하지않음 : '+inputRoom);
		
	}
	else{
		pool.getConnection(function(err, poolConn){
			if (err){
				if (poolConn) {
					poolConn.release();
				}
				callback(err, null);
				return;
			}
			console.log('DB연결 : ' + poolConn.threadId);

			var exec = poolConn.query('update rooms set people = people-1 where name = ?', inputRoom , function(err, result){
				console.log('실행된 SQL : ' + exec.sql);

				if (err) {
					console.log('DB에러');
					callback(err, '1');
				}
				else {
					var exec2 = poolConn.query('delete from rooms where people = 0' , function(err, result){
						poolConn.release();
						console.log('실행된 SQL : ' + exec2.sql);
						if(err){
							console.log('DB에러');
							callback(err, '1');
						}else{
							callback(null,'0');
						}
					});
					callback(null, '0');
				}
			});
		});
	}
}

  var io = socket.listen(server);

  // 접속한 사용자의 방이름, 사용자명, socket.id값을 저장할 전역변수
  const loginIds = new Array();

  io.sockets.on("connection", function(socket) {

      // 채팅방 입시 실행
      socket.on("access", function(data) {

          // console.log(io.sockets.adapter.rooms);
          socket.leave(socket.id);
          socket.join(data.room);

          loginIds.push({
                socket : socket.id  // 생성된 socket.id
              , room : data.room  // 접속한 채팅방의 이름
              , user : data.name   // 접속자의 유저의 이름
          });

          // 사용자가 페이지 새로고침시 loginIds 변수에 값이 누적되지 않게 동일한 사용자의 socket.id 값을 삭제한다.
          for(var num in loginIds) {

              // 사용자 이름이 같으면서, 기존소켓아이디와 현재 소켓아이디가 다른 값이 있는지 찾아낸다.
              if(loginIds[num]['user'] == data.name && loginIds[num]['socket'] != socket.id) {

                  // loginIds의 해당 순서의 값을 삭제한다.
                  loginIds.splice(num, 1);
              }
          }

          // 클라이언트의 Contact 이벤트를 실행하여 입장한 사용자의 정보를 출력한다.
          io.sockets.in(data.room).emit("contact", {
                count : io.sockets.adapter.rooms[data.room].length
              , name : data.name
              , message : data.name + "님이 채팅방에 들어왔습니다."
          });
      });

      // 채팅방 퇴장시 실행(Node.js에서 사용자의 Disconnect 이벤트는 사용자가 방을 나감과 동시에 이루어진다.)
      socket.on("disconnect", function() {

          var room = "";
          var name = "";
          var socket = "";
          var count = 0;

          // disconnect 이벤트중 socket.io의 정보를 꺼내는데는 에러가 발생하고,
          // 실행중인 node.js Application이 종료된다.
          // 이에따라 try ~ catch ~ finally 로 예외처리해준다.
          try {

              // 생성된 방의 수만큼 반복문을 돌린다.
              for(var key in io.sockets.adapter.rooms) {

                  // loginIds 배열의 값만큼 반복문을 돌린다.
                  var members = loginIds.filter(function(chat) {
                      return chat.room === key;
                  });

                  // 현재 소켓 방의 length와 members 배열의 갯수가 일치하지 않는경우
                  if(io.sockets.adapter.rooms[key].length != members.length) {

                      // 반복문으로 loginIds에 해당 socket.id값의 존재 여부를 확인한다.
                      for(var num in loginIds) {

                          // 일치하는 socket.id의 정보가 없을경우 그 사용자가 방에서 퇴장한것을 알 수 있다.
                          if(io.sockets.adapter.rooms[key].sockets.hasOwnProperty(loginIds[num]['socket']) == false) {

                              // 퇴장한 사용자의 정보를 변수에 담는다.
                              room = key;
                              name = loginIds[num]['user'];

                              // loginIds 배열에서 퇴장한 사용자의 정보를 삭제한다.
                              loginIds.splice(num, 1);
                          }
                      }

                      // 해당 방의 인원수를 다시 구한다.
                      var roomname = io.sockets.adapter.rooms[key]
                      count = io.sockets.adapter.rooms[key].length;
                  }
              }

          } catch(exception) {

              console.log(exception);

          } finally {

              // 클라이언트의 Contact 이벤트를 실행하여 이탈한 사용자가 누군지 알린다.
              io.sockets.in(room).emit("contact", {
                    count : count
                  , name : name
                  , message : name + "님이 채팅방에서 나갔습니다."
              });

          }
		  
    });

      // 메세지 전송 이벤트
      socket.on("message", function(data) {
          // 클라이언트의 Message 이벤트를 발생시킨다.
          io.sockets.in(data.room).emit("message", data);
      });
  });

server.listen(3000, function(){
    console.log('서버가 정상적으로 작동');
});
