
function requestFullScreen(element) {
    // Supports most browsers and their versions.
    var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;

    if (requestMethod) { // Native full screen.
        requestMethod.call(element);
    } else if (typeof window.ActiveXObject !== "undefined") { // Older IE.
        var wscript = new ActiveXObject("WScript.Shell");
        if (wscript !== null) {
            wscript.SendKeys("{F11}");
        }
    }
  };

    // HTML 문서가 모두 준비되면
    jQuery(document).ready(function() {

        var socket = io.connect();

        // 채팅 창으로 접속 및 전환
        jQuery("#startChatting").click(function() {

	  		var s_Room_name = $('#inputRoom').val();
	  		var s_Room_PW = $('#roomPW').val();


			if($('#roomPW').val() == ""){
				s_Room_PW = "0000";
			}

	  		$.ajax({
		  		data : {inputRoom : s_Room_name,
				roomPW : s_Room_PW },
		  		url : "/event/create_chatroom",
		  		type : 'POST',
		  		success : function(data){
            if(data == '0')
            {
              socket.emit("access", {
                    room : jQuery("#inputRoom").val()
                  , name : opener.$('#nickname').text()
              });
              var elem = document.body;

              requestFullScreen(elem);
              location.href = "#"+jQuery("#inputRoom").val();
              $("#chatpage").attr('id',jQuery("#inputRoom").val());

              jQuery("#roomName").html(jQuery("#inputRoom").val());
				
			  $(window).bind("beforeunload", function (){
				var s_Room_name = $('#inputRoom').val();
				$.ajax({
					data : {inputRoom : s_Room_name},
						url : "/event/leave_chatroom",
						type : 'POST',
						success : function(data){
					}
				})
			});
            }
            else if(data =='1')
            {
              alert('이미 개설된 방입니다.');
            }
		  		}
	  		})
        });

        // 이벤트를 연결합니다.
        socket.on("message", function(data) {
            pushMessage(data.name, data.message, data.date);
        });

        // 채팅방 접속 or 퇴장시 실행되는 알림 메세지
        socket.on("contact", function(data) {

            jQuery("#userCount").html(data.count);
            pushMessage(data.name, data.message, new Date().toUTCString());
        });

        // 채팅 메시지를 전송한다.
        jQuery("#submit").click(function() {
            if(document.querySelector('#inputMessage').value !== ""){
                socket.emit("message", {
                      room : jQuery("#inputRoom").val()
                    , name : opener.$("#nickname").text()
                    , message : jQuery("#inputMessage").val()
                    , date : new Date().toUTCString()
                });
                console.log(document.querySelector('#inputMessage').value);
                jQuery("#inputMessage").val("");
            }
        });

		jQuery("#exit").click(function(){
			var s_Room_name = $('#inputRoom').val();
				$.ajax({
					data : {inputRoom : s_Room_name},
		  			url : "/event/leave_chatroom",
		  			type : 'POST',
		  			success : function(data){
						if(data=="0"){
							window.close();
						}else{
							alert('에러');
						}
					}
				})
		});
    });

    function pushMessage(pushName, pushMsg, pushDate) {
		if(pushName == opener.$('#nickname').text()){

			// 입력할 문자 메시지
			var output = "";
			output += "<li>";
			output += "<h3>" + pushName + "</h3>";
			output += "<p>" + pushMsg + "</p>";
			output += "<p>" + pushDate + "</p>";
			output += "</li>";

			// 문서 객체를 추가합니다.
			jQuery(output).appendTo("#content");
			jQuery("#content").listview('refresh');
		}else{
			var output = "";
			output += "<li><a>";
			output += "<h3>" + pushName + "</h3>";
			output += "<p>" + pushMsg + "</p>";
			output += "<p>" + pushDate + "</p>";
			output += "</a></li>";

			// 문서 객체를 추가합니다.
			jQuery(output).appendTo("#content");
			jQuery("#content").listview('refresh');
		}
    };
	$(document).ready(function(){
            $("#inputMessage").keypress(function(event){
                if(event.which == '13'){
                    if(!event.shiftKey){
                        $("#submit").click();
                    }
                }
            });
        });