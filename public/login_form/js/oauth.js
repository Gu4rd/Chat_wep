function AJAX_OAUTH(s_email, what){
  $.ajax({
      data : { email : s_email},
      url : "/event/check_Email_Oauth",
      type : "POST",
      success : function(data){
          if(data == '0')
          {
              alert('you already have ID');

          }
          else if(data == '1')
          {
              var Oauth_email
              $.ajax({
                  data : { email : s_email },
                  url : "/event/send_emailInfo",
                  type : "POST",
                  success : function(data){
                      Oauth_email = data;
                      window.location.href = '/public/OauthLogin.html' + '#' + Oauth_email;
                  }
              });
              if(what == "gauth")
                gauth.signOut();
              if(what == "fauth")
                FB.logout();
          }
          if(what == "gauth")
            gauth.signOut();
          if(what == "fauth")
            FB.logout();
      }
  });
}

function checkGLoginStatus(){
    var loginBtn = document.querySelector('#G_login');
        if(gauth.isSignedIn.get()){
            console.log('logined');
            var s_email = gauth.currentUser.get().getBasicProfile().getEmail();
            AJAX_OAUTH(s_email, "gauth");
            loginBtn.value = 'Logout';
        }else{
            console.log('logouted');
            loginBtn.value = 'Login';
        }
}

function init(){
    gapi.load('auth2', function() {
        window.gauth = gapi.auth2.init({
            client_id:'395553994189-3ssk5v0kseudo3ns8kuqu3acs5bh2fke.apps.googleusercontent.com'
        })
        gauth.then(function(){
            console.log('googleAuth Success');
            checkGLoginStatus();
        }, function(){
            console.log('googleAuth Fail');
            checkGLoginStatus();
        });
    });
}

window.fbAsyncInit = function() {
    FB.init({
      appId      : '308664953715754',
      cookie     : true,                     // Enable cookies to allow the server to access the session.
      xfbml      : true,                     // Parse social plugins on this webpage.
      version    : 'v8.0'           // Use this Graph API version for this call.
    });


    FB.getLoginStatus(function(response) {   // Called after the JS SDK has been initialized.
        statusChangeCallback(response);        // Returns the login status.
    });
  };

  function statusChangeCallback(response) {  // Called with the results from FB.getLoginStatus().
    console.log('statusChangeCallback');
    console.log(response);                   // The current login status of the person.
    if (response.status === 'connected') {   // Logged into your webpage and Facebook.
        document.querySelector('#F_login').value = 'Logout';
        FB.api(
        '/me',
        'GET',
        {"fields" : "email"},
        function(response){
          var s_email = response.email;
          AJAX_OAUTH(s_email, "fauth");
        })
    }else{                                 // Not logged into your webpage or we are unable to tell.
        document.querySelector('#F_login').value = 'Login';
    }
  }


  function checkLoginState() {               // Called when a person is finished with the Login Button.
    FB.getLoginStatus(function(response) {   // See the onlogin handler
      statusChangeCallback(response);
    });
  }
