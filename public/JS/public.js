window.onload = function(){
socket.on("eror", msg => {
    console.error(`500 internal server error. Server responded with the following message: ${msg}`)
    alert(`500 internal server error: ${msg}`)
})
socket.on("sendMSG", (msg) => {
    alert(msg)
})
socket.on("redir", loc => {
    window.location.href= loc
})
}
function redir(loc){
    window.location.href=loc
}
function check(needAdmin, superAdmin){
    var username
    var key
    if (sessionStorage.getItem("username") && sessionStorage.getItem("key")) {
        username = sessionStorage.getItem("username")
        key = sessionStorage.getItem("key")
    }
    else if (localStorage.getItem("username") && localStorage.getItem("key")) {
         username = localStorage.getItem("username")
         key = localStorage.getItem("key")
    }
    else{
        window.location.href="Logg-Inn.html"
    }
    if(username && key){
        socket.emit("check", username, key, needAdmin, superAdmin)
    }
}
function getKeys(){
    var username
    var key
    if (sessionStorage.getItem("username") && sessionStorage.getItem("key")) {
        username = sessionStorage.getItem("username")
        key = sessionStorage.getItem("key")
    }
    else if (localStorage.getItem("username") && localStorage.getItem("key")) {
         username = localStorage.getItem("username")
         key = localStorage.getItem("key")
    }
    else{
        return false;
    }
    return [username, key]
}